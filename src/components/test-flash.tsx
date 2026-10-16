"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  SUPERMINI_BOARD,
  explainFlashError,
  type FlashErrorStage,
} from "@/lib/flash-boards";
import type { LocalTestFlashManifest } from "@/lib/test-flash-local";
import {
  validateTestFlashPackage,
  type TestFlashPackage,
} from "@/lib/test-flash-package";
import {
  checkFlashCompatibility,
  inspectFlashDevice,
  installFlashPackage,
  verifyPackageIntegrity,
  type FlashDevice,
} from "@/lib/test-flash-device";

const subscribeCapabilities = () => () => {};
const browserCapabilities = () =>
  window.isSecureContext && "serial" in navigator;
const serverCapabilities = () => null;

type Phase =
  "idle" | "file" | "connecting" | "ready" | "flashing" | "success" | "error";

export type TestFlashProps = {
  embedded?: boolean;
  projectTitle?: string;
  onBusyChange?: (busy: boolean) => void;
};

export default function TestFlash({
  embedded = false,
  projectTitle,
  onBusyChange,
}: TestFlashProps = {}) {
  const supported = useSyncExternalStore(
    subscribeCapabilities,
    browserCapabilities,
    serverCapabilities,
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [project, setProject] = useState("esp32-c3-check");
  const [boardSelected, setBoardSelected] = useState(false);
  const [file, setFile] = useState<{
    name: string;
    bytes: Uint8Array;
    info: TestFlashPackage;
  } | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Pick<
    FlashDevice,
    "description" | "flashSize"
  > | null>(null);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const device = useRef<FlashDevice | null>(null);
  const busy = useRef(false);
  const writing = useRef(false);
  const mounted = useRef(true);
  const disabled =
    phase === "file" || phase === "connecting" || phase === "flashing";

  useEffect(() => {
    mounted.current = true;

    const protect = (event: BeforeUnloadEvent) => {
      if (writing.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const protectNavigation = (event: MouseEvent) => {
      if (
        writing.current &&
        event.target instanceof Element &&
        event.target.closest("a[href]")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", protect);
    document.addEventListener("click", protectNavigation, true);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", protect);
      document.removeEventListener("click", protectNavigation, true);
      if (!writing.current)
        void device.current?.transport.disconnect().catch(() => {});
    };
  }, []);

  function setBusy(value: boolean) {
    busy.current = value;
    onBusyChange?.(value);
  }

  function log(line: string) {
    if (mounted.current) setLogs((old) => [...old.slice(-149), line]);
  }

  async function release() {
    const current = device.current;
    device.current = null;
    if (current) {
      current.transport.setDeviceLostCallback(null);
      await current.transport.disconnect().catch(() => {});
    }
    if (mounted.current) {
      setDeviceInfo(null);
      setConfirmed(false);
    }
  }

  function failure(error: unknown, stage: FlashErrorStage) {
    if (!mounted.current) return;
    const detail = error instanceof Error ? error.message : "ไม่ทราบสาเหตุ";
    log(detail);
    setPhase("error");
    setMessage(explainFlashError(error, stage));
  }

  async function chooseFile(selected?: File) {
    if (!selected || busy.current) return;
    setBusy(true);
    setPhase("file");
    setMessage("");
    setFile(null);
    setConfirmed(false);
    setProgress(0);
    try {
      await release();
      if (selected.size > 16 * 1024 * 1024) throw new Error("ไฟล์เกิน 16 MiB");
      const bytes = new Uint8Array(await selected.arrayBuffer());
      const info = validateTestFlashPackage(bytes);
      await verifyPackageIntegrity(bytes, info);
      if (mounted.current) {
        setFile({ name: selected.name, bytes, info });
        setPhase("idle");
      }
    } catch (error) {
      failure(error, "file");
    } finally {
      setBusy(false);
    }
  }

  async function chooseProject() {
    if (busy.current || !boardSelected || project !== "esp32-c3-check") return;
    setBusy(true);
    setPhase("file");
    setFile(null);
    setConfirmed(false);
    setProgress(0);
    setMessage("กำลังโหลดและตรวจชุด ESP32_C3_CHECK…");
    try {
      await release();
      const options = {
        cache: "no-store" as const,
        headers: { "x-elephant-local-test": "1" },
        signal: AbortSignal.timeout(15000),
      };
      const response = await fetch("/api/test-flash/esp32-c3-check", options);
      if (!response.ok)
        throw new Error(
          "ชุด ESP32_C3_CHECK ใช้เฉพาะ localhost ผ่าน pnpm dev และต้องเตรียมชุดก่อน ยังไม่เปิดไฟล์ส่วนตัวนี้บน Vercel",
        );
      const manifest: LocalTestFlashManifest = await response.json();
      if (
        manifest.id !== project ||
        manifest.chip !== "ESP32-C3" ||
        manifest.scope !== "local-only" ||
        manifest.flashBytes !== 4194304 ||
        manifest.applicationOffset !== 65536 ||
        !Number.isSafeInteger(manifest.byteLength) ||
        manifest.byteLength <= 65536 ||
        manifest.byteLength > manifest.flashBytes ||
        !/^[a-f0-9]{64}$/i.test(manifest.sha256)
      )
        throw new Error("ข้อมูลชุดเฟิร์มแวร์ไม่ถูกต้อง");
      const download = await fetch(
        "/api/test-flash/esp32-c3-check?download=1",
        { ...options, signal: AbortSignal.timeout(15000) },
      );
      if (!download.ok)
        throw new Error("โหลดชุดเฟิร์มแวร์ไม่สำเร็จ กรุณาเลือกโปรเจกต์ใหม่");
      const bytes = new Uint8Array(await download.arrayBuffer());
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      if (
        bytes.length !== manifest.byteLength ||
        digest !== manifest.sha256.toLowerCase()
      )
        throw new Error(
          "ชุดเฟิร์มแวร์เปลี่ยนหรือข้อมูลไม่ครบ กรุณาเลือกโปรเจกต์ใหม่",
        );
      const info = validateTestFlashPackage(bytes);
      if (
        info.flashBytes !== manifest.flashBytes ||
        info.applicationOffset !== manifest.applicationOffset
      )
        throw new Error("ชุดไฟล์ไม่ตรงกับข้อมูลโปรเจกต์");
      await verifyPackageIntegrity(bytes, info);
      if (mounted.current) {
        setFile({ name: "ESP32_C3_CHECK · ชุดทดสอบในเครื่อง", bytes, info });
        setPhase("idle");
        setMessage(
          "เลือก ESP32_C3_CHECK แล้ว เสียบบอร์ด เข้าโหมด BOOT แล้วกดตรวจบอร์ดได้เลย ยังไม่ได้เขียน Flash",
        );
      }
    } catch (error) {
      failure(error, "file");
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (busy.current || !file || !supported || !boardSelected) return;
    setBusy(true);
    setPhase("connecting");
    setMessage("");
    setConfirmed(false);
    setLogs([]);
    try {
      // Request permission directly from the click; never probe arbitrary ports silently.
      const port = await navigator.serial.requestPort();
      await release();
      const current = await inspectFlashDevice(port, log);
      device.current = current;
      checkFlashCompatibility(current, file.bytes, file.info);
      current.transport.setDeviceLostCallback(() => {
        if (mounted.current) {
          setConfirmed(false);
          setDeviceInfo(null);
          setPhase("error");
          setMessage(
            "สาย USB หลุด บอร์ดไม่ได้รับการยืนยันแล้ว กรุณาเชื่อมต่อและตรวจใหม่",
          );
        }
        device.current = null;
      });
      if (!mounted.current) {
        await release();
        return;
      }
      setDeviceInfo({
        description: current.description,
        flashSize: current.flashSize,
      });
      setPhase("ready");
      setMessage(
        "ตรวจชิป ขนาด Flash และ revision ตรงกับไฟล์แล้ว ยังไม่ได้เขียน Flash",
      );
    } catch (error) {
      await release();
      if (error instanceof DOMException && error.name === "NotFoundError") {
        setPhase("idle");
        setMessage("ยกเลิกเลือกพอร์ตแล้ว ยังไม่ได้เขียน Flash");
      } else failure(error, "connect");
    } finally {
      setBusy(false);
    }
  }

  async function flash() {
    const current = device.current;
    if (busy.current || phase !== "ready" || !current || !file || !confirmed)
      return;
    setBusy(true);
    writing.current = true;
    setPhase("flashing");
    setProgress(0);
    setMessage("กำลังล้าง Flash และติดตั้ง ห้ามถอดสายหรือออกจากหน้านี้");
    try {
      await installFlashPackage(current, file.bytes, (written, total) => {
        if (mounted.current)
          setProgress(Math.min(100, Math.floor((written / total) * 100)));
      });
      if (mounted.current) {
        setPhase("success");
        setProgress(100);
        setMessage(
          "เขียนและตรวจ MD5 ของข้อมูลใน Flash ผ่านแล้ว กด RESET บนบอร์ด หรือถอดเสียบ USB เพื่อเริ่มโปรแกรม จากนั้นตรวจ LED / Serial ด้วยตัวเอง — ยังไม่ได้ยืนยันการทำงานของวงจร",
        );
      }
    } catch (error) {
      failure(error, "flash");
    } finally {
      writing.current = false;
      await release();
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="panel space-y-3 p-4 text-lg sm:p-6">
        <p className="font-semibold">
          {projectTitle || "พื้นที่ทดลอง · ESP32_C3_CHECK"}
        </p>
        <p>
          รองรับ ESP32-C3 ผ่าน Chrome / Edge บนคอม ใช้ USB ที่ส่งข้อมูลได้
          และปิด Serial Monitor ก่อน
        </p>
        <p className="text-[var(--warning-text)]">
          การติดตั้งหน้านี้ล้าง Flash ทั้งหมด รวมโปรแกรมเดิม Wi-Fi
          และข้อมูลที่บันทึกไว้ ไม่แตะ eFuse
        </p>
      </div>
      {supported === false && (
        <p
          role="alert"
          className="panel p-4 text-lg text-[var(--danger)] sm:p-6"
        >
          เบราว์เซอร์นี้ใช้ Web Serial ไม่ได้ กรุณาเปิดด้วย Chrome / Edge บนคอม
          ผ่าน HTTPS หรือ localhost
        </p>
      )}
      <section className="panel space-y-5 p-4 sm:p-6">
        <h2 className="text-2xl font-bold">
          {embedded ? "1. เลือกบอร์ด" : "1. เลือกโปรเจกต์และบอร์ด"}
        </h2>
        <fieldset>
          <legend className="mb-3 text-lg font-semibold">บอร์ดที่คุณใช้</legend>
          <label
            className={`flex cursor-pointer flex-col gap-4 rounded-xl border-2 p-4 sm:flex-row sm:items-center ${boardSelected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}
          >
            <Image
              src={SUPERMINI_BOARD.image}
              alt="ภาพถ่ายอ้างอิงบอร์ด ESP32-C3 SuperMini"
              width={467}
              height={467}
              className="h-auto w-full sm:w-64"
            />
            <div className="space-y-2">
              <span className="flex items-center gap-3 text-xl font-bold">
                <input
                  type="radio"
                  name="flash-board"
                  value={SUPERMINI_BOARD.id}
                  checked={boardSelected}
                  disabled={disabled || phase === "ready"}
                  onChange={() => setBoardSelected(true)}
                  className="h-5 w-5 shrink-0"
                />
                {SUPERMINI_BOARD.name}
              </span>
              <p className="text-lg">
                {SUPERMINI_BOARD.chip} · Flash {SUPERMINI_BOARD.flashSize} ·
                USB-C
              </p>
              <p>
                ภาพถ่ายอ้างอิงรุ่นบอร์ด ตำแหน่งปุ่มอาจต่างตามล็อต ตรวจชื่อ BOOT
                / RST (RESET) ที่สกรีนบนบอร์ดจริงก่อนกด
              </p>
            </div>
          </label>
        </fieldset>
        {!embedded && (
          <label className="block space-y-2 text-lg">
            <span className="block">โปรเจกต์สำหรับติดตั้ง</span>
            <select
              value={project}
              onChange={(event) => setProject(event.target.value)}
              disabled={disabled || phase === "ready"}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <option value="esp32-c3-check">
                ESP32_C3_CHECK — ESP32-C3 SuperMini · 4 MB
              </option>
            </select>
          </label>
        )}
        <button
          type="button"
          className="button primary"
          disabled={disabled || !boardSelected}
          onClick={() => void chooseProject()}
        >
          {phase === "file"
            ? "กำลังตรวจไฟล์…"
            : embedded
              ? "ใช้บอร์ดนี้และเตรียมเฟิร์มแวร์"
              : "เลือกโปรเจกต์นี้"}
        </button>
        <p className="text-[var(--muted)]">
          ชุดทดลองนี้เตรียมให้แล้วบน localhost ไม่ต้องรวมไฟล์หรือกรอก offset เอง
          ยังไม่เผยแพร่บน Vercel เพราะ binary อาจฝังรหัส Wi-Fi
        </p>
        {file && (
          <p className="text-lg font-semibold break-all">
            {file.name} · ESP32-C3 · {file.info.flashSizeLabel} ·{" "}
            {(file.info.byteLength / 1024).toFixed(0)} KiB
          </p>
        )}
        <details className="rounded-xl border border-[var(--border)] p-4 sm:p-5">
          <summary className="cursor-pointer text-lg font-semibold">
            ขั้นสูง: เลือกไฟล์ .bin จากคอมเอง
          </summary>
          <div className="mt-4 space-y-4">
            <label className="block text-lg space-y-2">
              <span className="block">
                ไฟล์ .bin แบบรวม bootloader + partition table + โปรแกรม
              </span>
              <input
                type="file"
                accept=".bin"
                disabled={disabled}
                onChange={(event) => {
                  void chooseFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
                className="block w-full rounded-lg border border-[var(--border)] p-3"
              />
            </label>
            <p className="text-[var(--muted)]">
              ไฟล์อยู่ในคอม ไม่อัปโหลดขึ้นเซิร์ฟเวอร์ ไม่รับ firmware.bin
              ที่มีเฉพาะ app และไม่รับชุดที่มี otadata เดิม
            </p>
            <details className="rounded-xl bg-[var(--surface-soft)] p-4">
              <summary className="cursor-pointer font-semibold">
                เตรียมไฟล์จาก ESP32_C3_CHECK อย่างไร?
              </summary>
              <div className="mt-4 space-y-3">
                <p>
                  Build ด้วย PlatformIO แล้วนำ bootloader.bin, partitions.bin
                  และ firmware.bin มารวมด้วย esptool merge-bin โดยใช้ chip
                  ESP32-C3 และ offset จากผล build/upload ของโปรเจกต์จริง ห้ามเดา
                  offset
                </p>
                <p>
                  ชุดทดลองนี้ต้องมี partition table ที่ 0x8000 และ bootloader
                  ที่ 0 เลือก factory หรือ ota_0 โดยไม่ใส่ boot_app0 / otadata
                  และไม่มี app สำรองอื่นในไฟล์
                </p>
                <p className="text-[var(--warning-text)]">
                  โปรเจกต์นี้ใช้ secrets.h: binary อาจฝังรหัส Wi-Fi
                  ใช้ทดสอบในคอมได้ แต่ห้ามแจกไฟล์นั้นก่อนเปลี่ยนเป็นข้อมูลทดสอบ
                </p>
              </div>
            </details>
          </div>
        </details>
      </section>
      <section className="panel space-y-5 p-4 sm:p-6">
        <h2 className="text-2xl font-bold">2. เสียบบอร์ดและตรวจ</h2>
        <h3 className="text-xl font-semibold">
          เข้าโหมดแฟลชสำหรับ {SUPERMINI_BOARD.name}
        </h3>
        <ol className="list-decimal space-y-3 pl-6 text-lg">
          {SUPERMINI_BOARD.prepareSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="rounded-xl bg-[var(--accent-soft)] p-4 text-lg">
          ลำดับสำคัญ: ปล่อย RESET ก่อน แล้วค่อยปล่อย BOOT ไม่ต้องกด BOOT
          ค้างระหว่างเว็บเขียนไฟล์
        </p>
        <p className="text-[var(--muted)]">
          ตรวจชิปจริง ไม่อาศัยชื่อ USB และไม่แฟลชโปรแกรมทดสอบ ตัวช่วยตรวจทำงานใน
          RAM ชั่วคราว ไม่เขียนทับ Flash แต่โปรแกรมเดิมจะหยุดระหว่างตรวจ
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="button primary"
            disabled={
              !supported ||
              !file ||
              !boardSelected ||
              disabled ||
              phase === "ready"
            }
            onClick={() => void connect()}
          >
            {phase === "connecting"
              ? "กำลังตรวจบอร์ด…"
              : "เลือกพอร์ตและตรวจบอร์ด"}
          </button>
          {phase === "ready" && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                if (busy.current) return;
                setBusy(true);
                void (async () => {
                  try {
                    await release();
                    setPhase("idle");
                    setMessage("ตัดการเชื่อมต่อแล้ว ยังไม่ได้เขียน Flash");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              ตัดการเชื่อมต่อ
            </button>
          )}
        </div>
        {deviceInfo && (
          <p className="text-lg font-semibold">
            {deviceInfo.description} · Flash {deviceInfo.flashSize}
          </p>
        )}
      </section>
      <section className="panel space-y-5 p-4 sm:p-6">
        <h2 className="text-2xl font-bold">3. ยืนยันและติดตั้ง</h2>
        {phase === "success" && (
          <div
            className="rounded-xl border-2 border-[var(--success)] bg-[var(--surface)] p-5 space-y-3"
            role="region"
            aria-label="ขั้นตอนหลังติดตั้ง"
          >
            <h3 className="text-2xl font-bold text-[var(--success)]">
              ติดตั้งและตรวจข้อมูลผ่านแล้ว
            </h3>
            <p className="text-xl font-semibold">
              {SUPERMINI_BOARD.afterFlash}
            </p>
            <p className="text-lg">
              สำหรับ ESP32_C3_CHECK ให้ดู LED กระพริบ หากยังไม่เริ่ม
              ให้ถอดแล้วเสียบ USB ใหม่
            </p>
            <p>
              การตรวจข้อมูลผ่านยืนยันการเขียน ไม่ได้ยืนยันว่าวงจรหรือ Wi-Fi
              ทำงานถูกต้อง
            </p>
          </div>
        )}
        <p>
          ชิปตรงไม่ได้แปลว่าผังวงจรตรง ต้องเป็นบอร์ดที่รองรับโปรเจกต์นี้
          ถอดวงจรภายนอกก่อนทดสอบ โดยเฉพาะอุปกรณ์ที่ควบคุมมอเตอร์หรือไฟฟ้า
        </p>
        <label className="flex items-start gap-3 text-lg">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={phase !== "ready"}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1.5 h-5 w-5 shrink-0"
          />
          <span>
            ยืนยันใช้บอร์ดสำหรับทดลอง และยอมรับการล้างโปรแกรมกับข้อมูลทั้งหมดใน
            Flash
          </span>
        </label>
        <button
          type="button"
          className="button primary"
          disabled={phase !== "ready" || !confirmed || disabled}
          onClick={() => void flash()}
        >
          {phase === "flashing" ? "กำลังติดตั้ง…" : "ล้างข้อมูลและติดตั้ง"}
        </button>
        {(phase === "flashing" || phase === "success") && (
          <div>
            <progress
              aria-label="ความคืบหน้าการเขียน"
              value={progress}
              max={100}
              className="w-full"
            />
            <p>
              {progress}% การเขียน{" "}
              {phase === "flashing" && "— ยังต้องตรวจข้อมูลหลังเขียน"}
            </p>
          </div>
        )}
      </section>
      <p
        role="status"
        aria-live="polite"
        className={`text-lg ${phase === "error" ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}
      >
        {message}
      </p>
      <details className="panel p-4 sm:p-6">
        <summary className="cursor-pointer text-lg font-semibold">
          รายละเอียดสำหรับแก้ปัญหา
        </summary>
        <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all text-base">
          {logs.join("\n") || "ยังไม่มีข้อมูลการเชื่อมต่อ"}
        </pre>
      </details>
    </div>
  );
}
