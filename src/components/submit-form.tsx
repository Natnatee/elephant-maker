"use client";

import Link from "next/link";
import { ProjectMarkdown } from "@/components/project-markdown";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  emptyDraft,
  loadDraft,
  saveDraft,
  validateStep,
  MAX_BIN_SIZE,
  isCoverMetadata,
  guideFileMetadata,
  type GuideFileMetadata,
  requiresGuide,
  type Draft,
} from "@/lib/drafts";

const stages = ["ข้อมูลทั่วไป", "คู่มือการทำ", "ไฟล์และการแบ่งปัน"];
const inputClass =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] focus:outline-2 focus:outline-[var(--focus)]";
const buttonClass =
  "button rounded-xl border border-[var(--border)] px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-[var(--focus)] disabled:opacity-50";

export default function SubmitForm() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    };
  }, [coverUrl]);
  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const metadata = { name: file.name, size: file.size, type: file.type };
    if (!isCoverMetadata(metadata)) {
      setErrors(["เลือกรูป JPEG, PNG หรือ WebP ที่ไม่ว่างและไม่เกิน 8 MiB"]);
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      setCoverUrl(url);
      update("cover", metadata);
    } catch {
      setErrors(["สร้างตัวอย่างรูปไม่ได้ กรุณาลองเลือกไฟล์อีกครั้ง"]);
    }
  }
  function coverPreview() {
    return (
      <div className="space-y-2">
        {coverUrl && (
          <figure>
            {/* A browser-local object URL is transient and must not use server image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={`ตัวอย่างรูปปก: ${draft.cover?.name ?? "ผลงาน"}`}
              className="max-h-72 w-full rounded-xl object-contain"
            />
          </figure>
        )}
        {draft.cover && (
          <p className="break-words text-sm">
            {draft.cover.name} • {draft.cover.size.toLocaleString()} bytes •{" "}
            {draft.cover.type} (metadata เท่านั้น)
          </p>
        )}
        {draft.cover && !coverUrl && (
          <p className="text-sm font-semibold text-[var(--warning-text)]">
            ไม่มีตัวอย่างรูปในร่างที่เปิด
            กรุณากลับขั้นข้อมูลทั่วไปแล้วเลือกรูปปกใหม่
            เพราะไม่ได้เก็บข้อมูลภาพไว้
          </p>
        )}
      </div>
    );
  }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
    setErrors([]);
  }
  function move(next: number) {
    setStep(next);
    setErrors([]);
    setMessage("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  function save(final = false) {
    try {
      saveDraft(draft, step);
      setMessage("บันทึกร่างในเครื่องแล้ว");
      if (final) setPreview(true);
    } catch {
      setErrors([
        "บันทึกไม่ได้: เบราว์เซอร์อาจปิดกั้นพื้นที่จัดเก็บหรือพื้นที่เต็ม กรุณาเก็บข้อความไว้ก่อนออกจากหน้านี้",
      ]);
    }
  }
  function resume() {
    try {
      const saved = loadDraft();
      if (!saved) {
        setMessage("ยังไม่มีร่างในเบราว์เซอร์นี้");
        return;
      }
      setCoverUrl(null);
      setDraft(saved.draft);
      setStep(saved.step);
      setPreview(false);
      setErrors([]);
      setMessage(
        `เปิดร่างแล้ว • มีเฉพาะข้อมูลไฟล์ ไม่ได้เก็บภาพหรือไฟล์ binary • ต้องเลือกไฟล์คู่มือใหม่เมื่อเปิดร่างต่อ${saved.draft.cover ? " • กรุณาเลือกรูปปกใหม่เพื่อดูตัวอย่าง" : ""}`,
      );
    } catch {
      setErrors([
        "อ่านร่างไม่ได้ หรือรูปแบบร่างไม่รองรับ ข้อมูลเดิมยังไม่ถูกเขียนทับ",
      ]);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues =
      step === 2
        ? [0, 1, 2].flatMap((stage) => validateStep(draft, stage))
        : validateStep(draft, step);
    setErrors(issues);
    setMessage("");
    if (issues.length) return;
    if (step < 2) move(step + 1);
    else save(true);
  }
  function chooseGuideFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const metadata = files.map(guideFileMetadata);
    if (metadata.some((file) => file === null)) {
      setErrors([
        "เลือก JPEG, PNG, WebP, GIF, MP4, WebM, MOV, PDF, TXT หรือ Markdown ที่ไม่ว่างและไม่เกิน 50 MiB ต่อไฟล์",
      ]);
      return;
    }
    if (metadata.length)
      update("guideFiles", [
        ...draft.guideFiles,
        ...(metadata as GuideFileMetadata[]),
      ]);
  }
  function guideFileList(removable = false) {
    return (
      <div className="space-y-2">
        <ul className="space-y-2">
          {draft.guideFiles.map((file, index) => (
            <li
              key={index}
              className="flex flex-wrap items-center gap-3 break-words"
            >
              <span>
                {file.name} • {file.size.toLocaleString()} bytes • {file.kind}
              </span>
              {removable && (
                <button
                  type="button"
                  className={`${buttonClass} secondary`}
                  aria-label={`ลบไฟล์ ${file.name}`}
                  onClick={() =>
                    update(
                      "guideFiles",
                      draft.guideFiles.filter(
                        (_, position) => position !== index,
                      ),
                    )
                  }
                >
                  ลบไฟล์
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="muted text-sm">
          เก็บเฉพาะชื่อ ขนาด และชนิดไฟล์ ไม่มีการอัปโหลดจริง ไม่เก็บเนื้อหาไฟล์
          เมื่อเปิดร่างต่อจะต้องเลือกไฟล์ใหม่
        </p>
      </div>
    );
  }
  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const invalid = files.filter(
      (file) =>
        !/\.bin$/i.test(file.name) ||
        file.size <= 0 ||
        file.size > MAX_BIN_SIZE,
    );
    if (invalid.length || (draft.mode === "merged" && files.length > 1)) {
      setErrors([
        "เลือกเฉพาะ .bin ที่ไม่ว่างและไม่เกิน 16 MiB ต่อไฟล์; merged ใช้ไฟล์เดียว",
      ]);
    } else if (files.length) {
      update(
        "files",
        files.map((file) => ({ name: file.name, size: file.size, offset: "" })),
      );
    }
    event.target.value = "";
  }
  function textField(
    key:
      | "title"
      | "summary"
      | "materials"
      | "compatibilityNotes"
      | "steps"
      | "contact"
      | "chip"
      | "board"
      | "version",
    label: string,
    multiline = false,
    required = true,
  ) {
    return (
      <label className="block" key={key}>
        <span className="font-semibold">
          {label}
          {required ? " *" : " (ไม่บังคับ)"}
        </span>
        {multiline ? (
          <textarea
            className={inputClass}
            rows={key === "steps" ? 7 : 4}
            value={draft[key]}
            onChange={(event) => update(key, event.target.value)}
            required={required}
          />
        ) : (
          <input
            className={inputClass}
            value={draft[key]}
            onChange={(event) => update(key, event.target.value)}
            required={required}
          />
        )}
      </label>
    );
  }
  return (
    <section className="panel space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] sm:p-8">
      <div className="rounded-xl bg-[var(--accent-soft)] p-4 text-sm leading-6">
        <strong>ต้นแบบ • เก็บเฉพาะในเครื่องนี้</strong>
        <p>
          ไม่เผยแพร่ ไม่ส่งข้อมูลขึ้น backend และไม่มีเซิร์ฟเวอร์อัปโหลดหรือแฟลช
          firmware ร่างอยู่ใน localStorage ของเบราว์เซอร์นี้
          อาจหายเมื่อเคลียร์ข้อมูล และไม่ซิงก์ข้ามเครื่อง
          อย่าใส่รหัสผ่านหรือข้อมูลลับ
        </p>
        <p className="font-semibold">ไฟล์ที่เลือกไม่ถูกอัปโหลด</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={`${buttonClass} secondary`}
          onClick={resume}
        >
          เปิดร่างที่บันทึกไว้
        </button>
        <button
          type="button"
          className={`${buttonClass} secondary`}
          onClick={() => save()}
        >
          บันทึกร่างตอนนี้
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="font-semibold text-[var(--success)]"
      >
        {message}
      </p>
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4 text-[var(--danger)]"
        >
          <p className="font-semibold">กรุณาตรวจสอบก่อนดำเนินการ</p>
          <ul className="list-inside list-disc">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {preview ? (
        <div className="space-y-5">
          <h2 className="section-heading text-2xl font-bold">
            ตัวอย่างร่าง • ยังไม่ได้เผยแพร่
          </h2>
          {coverPreview()}
          <h3 className="break-words text-xl font-semibold">{draft.title}</h3>
          <p className="whitespace-pre-wrap break-words">{draft.summary}</p>
          <p className="badge">
            {draft.category} / {draft.readiness}
          </p>
          <h3 className="font-bold">วัสดุและอุปกรณ์</h3>
          <ProjectMarkdown content={draft.materials} />
          <h3 className="font-bold">บทความ / ขั้นตอนการทำ</h3>
          <ProjectMarkdown content={draft.steps} />
          {draft.references.length > 0 && (
            <div>
              <h3 className="font-bold">แหล่งอ้างอิง</h3>
              <ul className="list-inside list-disc">
                {draft.references.map((reference, index) => (
                  <li key={index}>
                    <a href={reference.url} target="_blank" rel="noopener noreferrer">
                      {reference.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {guideFileList()}
          <h3 className="font-bold">ความเข้ากันได้ / ข้อจำกัด</h3>
          <p className="whitespace-pre-wrap break-words">
            {draft.compatibilityNotes || "ไม่ระบุ"}
          </p>
          <p className="break-words">
            ติดต่อ: {draft.contact || "ไม่ระบุ"} • สิทธิ์การใช้งาน:{" "}
            {draft.license || "ยังไม่ระบุ — ไม่ถือว่าอนุญาตให้นำไปใช้"}
          </p>
          {draft.firmware && (
            <div className="space-y-2">
              <h3 className="font-bold">Firmware (ข้อมูลประกอบเท่านั้น)</h3>
              <p>
                {draft.chip} / {draft.board} / {draft.version} / {draft.mode}
              </p>
              <ul>
                {draft.files.map((file, index) => (
                  <li className="break-words" key={index}>
                    {file.name} — {file.size.toLocaleString()} bytes
                    {draft.mode === "multipart" ? ` • ${file.offset}` : ""}
                  </li>
                ))}
              </ul>
              <p>
                ไม่ได้เก็บ binary และยังไม่ได้ยืนยัน manifest หรือทดสอบการแฟลช
              </p>
            </div>
          )}
          <button
            className={`${buttonClass} secondary`}
            type="button"
            onClick={() => {
              setPreview(false);
              move(0);
            }}
          >
            กลับไปแก้ไขร่าง
          </button>
        </div>
      ) : (
        <>
          <ol
            aria-label="ความคืบหน้าการสร้างร่าง"
            className="grid gap-2 sm:grid-cols-3"
          >
            {stages.map((stage, index) => (
              <li
                key={stage}
                aria-current={step === index ? "step" : undefined}
                className={`rounded-xl p-3 text-sm ${step === index ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--surface-soft)]"}`}
              >
                <span className="font-bold">
                  {index + 1}. {stage}
                </span>
                <span className="block">
                  {index < step
                    ? "ผ่านขั้นตอนแล้ว"
                    : index === step
                      ? "ขั้นตอนปัจจุบัน"
                      : "ยังไม่ถึงขั้นตอน"}
                </span>
              </li>
            ))}
          </ol>
          <h2
            ref={heading}
            tabIndex={-1}
            className="section-heading text-2xl font-bold"
          >
            {step + 1}. {stages[step]}
          </h2>
          <p className="muted text-sm">
            * จำเป็นต้องระบุ • บันทึกระหว่างทำได้ แม้ข้อมูลยังไม่ครบ
          </p>
          <form onSubmit={submit} noValidate className="space-y-5">
            {step === 0 && (
              <>
                <div className="space-y-3">
                  <label className="block font-semibold">
                    รูปปก (ไม่บังคับสำหรับร่าง)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={chooseCover}
                      className={`${inputClass} text-sm`}
                      aria-describedby="cover-note"
                    />
                  </label>
                  <p id="cover-note" className="muted text-sm">
                    รับ JPEG, PNG หรือ WebP ไม่เกิน 8 MiB
                    รูปปกจำเป็นก่อนเผยแพร่จริง แต่ต้นแบบนี้บันทึกได้โดยไม่มีรูป
                    เก็บเฉพาะชื่อ ขนาด และชนิดไฟล์ ไม่เก็บภาพ
                    ต้องเลือกใหม่เมื่อเปิดร่าง
                  </p>
                  {coverPreview()}
                  {draft.cover && (
                    <button
                      type="button"
                      className="text-sm text-[var(--danger)] underline"
                      onClick={() => {
                        setCoverUrl(null);
                        update("cover", null);
                      }}
                    >
                      นำรูปปกออกจากร่าง
                    </button>
                  )}
                </div>
                {textField("title", "ชื่อผลงาน")}
                {textField("summary", "คำอธิบายสั้น", true)}
                <div className="grid gap-5 sm:grid-cols-2">
                  {(["category", "readiness"] as const).map((key) => (
                    <label key={key} className="block font-semibold">
                      {key === "category" ? "หมวดหมู่" : "ระดับความพร้อม"} *
                      <select
                        required
                        className={inputClass}
                        value={draft[key]}
                        onChange={(event) => update(key, event.target.value)}
                      >
                        <option value="">กรุณาเลือก</option>
                        {(key === "category"
                          ? [
                              { value: "ยานยนต์", label: "ยานยนต์" },
                              { value: "บ้านและสวน", label: "บ้านและสวน" },
                              { value: "งานพิมพ์ 3D", label: "งานพิมพ์ 3D" },
                              {
                                value: "อิเล็กทรอนิกส์",
                                label: "อิเล็กทรอนิกส์",
                              },
                            ]
                          : [
                              {
                                value: "showcase",
                                label: "โชว์ผลงาน / กำลังพัฒนา",
                              },
                              {
                                value: "ready",
                                label: "พร้อมทำตาม — มีคู่มือครบ",
                              },
                            ]
                        ).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </>
            )}
            {step === 1 && (
              <>
                {textField("materials", "วัสดุและอุปกรณ์", true, false)}
                {textField(
                  "steps",
                  "บทความ / ขั้นตอนการทำ (Markdown)",
                  true,
                  requiresGuide(draft.readiness) &&
                    draft.guideFiles.length === 0,
                )}
                <p className="muted text-sm">
                  บทความและวัสดุรองรับ Markdown: รูป {"![alt](https://example.com/image.jpg)"}
                  {" • "}ลิงก์ / PDF {"[label](https://example.com/guide.pdf)"}
                  {" • "}ใช้ URL ที่เข้าถึงได้อยู่แล้ว ระบบนี้ไม่อัปโหลดรูปหรือ PDF
                </p>
                <fieldset className="space-y-3">
                  <legend className="font-semibold">แหล่งอ้างอิง (ไม่บังคับ)</legend>
                  {draft.references.map((reference, index) => (
                    <div key={index} className="space-y-2">
                      <label className="block">
                        ชื่อแหล่งอ้างอิง {index + 1}
                        <input
                          className={inputClass}
                          value={reference.label}
                          required
                          onChange={(event) => update("references", draft.references.map((item, position) =>
                            position === index ? { ...item, label: event.target.value } : item,
                          ))}
                        />
                      </label>
                      <label className="block">
                        URL แหล่งอ้างอิง {index + 1} (http / https)
                        <input
                          type="url"
                          className={inputClass}
                          value={reference.url}
                          required
                          onChange={(event) => update("references", draft.references.map((item, position) =>
                            position === index ? { ...item, url: event.target.value } : item,
                          ))}
                        />
                      </label>
                      <button type="button" className={buttonClass}
                        onClick={() => update("references", draft.references.filter((_, position) => position !== index))}>
                        ลบแหล่งอ้างอิง {index + 1}
                      </button>
                    </div>
                  ))}
                  <button type="button" className={buttonClass}
                    onClick={() => update("references", [...draft.references, { label: "", url: "" }])}>
                    เพิ่มแหล่งอ้างอิง
                  </button>
                </fieldset>
                <label className="block font-semibold">
                  ไฟล์ประกอบคู่มือ (ไม่บังคับหากมีข้อความขั้นตอน)
                  <input
                    type="file"
                    multiple
                    className={inputClass}
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/markdown,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.pdf,.txt,.md"
                    onChange={chooseGuideFiles}
                  />
                </label>
                <p className="muted text-sm">
                  รองรับ JPEG, PNG, WebP, GIF, MP4, WebM, MOV, PDF, TXT และ
                  Markdown ไม่เกิน 50 MiB ต่อไฟล์
                </p>
                {guideFileList(true)}
                {textField(
                  "compatibilityNotes",
                  "ความเข้ากันได้ / ข้อจำกัด",
                  true,
                  false,
                )}
                <p className="muted text-sm">
                  งานพร้อมทำตาม (ready)
                  ต้องมีข้อความขั้นตอนหรือไฟล์คู่มืออย่างน้อยหนึ่งไฟล์
                  งานโชว์ไม่บังคับคู่มือ วัสดุและรุ่นรถหรืออุปกรณ์ไม่บังคับ
                  สถานะนี้ไม่ใช่การรับรองความปลอดภัย
                </p>
              </>
            )}
            {step === 2 && (
              <>
                {textField("contact", "ช่องทางติดต่อ", false, false)}
                <label className="block font-semibold">
                  สิทธิ์การใช้งาน (ไม่บังคับ)
                  <select
                    className={inputClass}
                    value={draft.license}
                    onChange={(event) => update("license", event.target.value)}
                  >
                    <option value="">ยังไม่ระบุ</option>
                    <option>CC BY 4.0 (เนื้อหา/คู่มือ)</option>
                    <option>CC BY-SA 4.0 (เนื้อหา/คู่มือ)</option>
                    <option>MIT (โค้ดที่คุณมีสิทธิ์อนุญาต)</option>
                    <option>ต้องขออนุญาตเจ้าของก่อน</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--accent)]"
                    checked={draft.firmware}
                    onChange={(event) =>
                      update("firmware", event.target.checked)
                    }
                  />
                  เพิ่มข้อมูลไฟล์ firmware .bin (ไม่บังคับ)
                </label>
                {draft.firmware && (
                  <fieldset className="space-y-5 rounded-xl border border-[var(--border)] p-4">
                    <legend className="px-2 font-bold">ข้อมูล Firmware</legend>
                    <Link
                      className="font-semibold text-[var(--accent)] underline"
                      href="/submit/firmware-guide"
                    >
                      อ่านคู่มือเตรียม firmware สำหรับผู้เริ่มต้น
                    </Link>
                    <p className="text-sm">
                      รับเฉพาะ .bin ไม่เกิน 16 MiB ต่อไฟล์ เก็บเพียงชื่อและขนาด
                      ไม่อ่านหรือเก็บ binary ไม่อัปโหลด ไม่แฟลช
                      และไม่ตรวจยืนยันความเข้ากันได้ อย่าเดา offset จากบอร์ดอื่น
                    </p>
                    <div className="grid gap-5 sm:grid-cols-3">
                      {textField("chip", "รุ่นชิป")}
                      {textField("board", "รุ่นบอร์ด")}
                      {textField("version", "เวอร์ชัน")}
                    </div>
                    <label className="block font-semibold">
                      รูปแบบไฟล์
                      <select
                        className={inputClass}
                        value={draft.mode}
                        onChange={(event) => {
                          update("mode", event.target.value as Draft["mode"]);
                          update("files", []);
                        }}
                      >
                        <option value="merged">
                          Merged: .bin รวมไฟล์เดียว
                        </option>
                        <option value="multipart">
                          Multipart: หลายไฟล์พร้อม offset
                        </option>
                      </select>
                    </label>
                    <p className="text-sm">
                      เปลี่ยนรูปแบบแล้วต้องเลือกไฟล์ใหม่ สำหรับ merged
                      ให้ยืนยันตำแหน่งแฟลชจาก manifest ของ build ด้วย
                      ไม่ถือว่าเริ่มที่ตำแหน่งใดโดยอัตโนมัติ
                    </p>
                    <label className="block font-semibold">
                      เลือกไฟล์ .bin *
                      <input
                        type="file"
                        accept=".bin"
                        multiple={draft.mode === "multipart"}
                        onChange={chooseFiles}
                        className={`${inputClass} text-sm`}
                      />
                    </label>
                    <ul className="space-y-4">
                      {draft.files.map((file, index) => (
                        <li
                          key={index}
                          className="rounded-xl bg-[var(--surface)] p-3"
                        >
                          <p className="break-words">
                            {file.name} • {file.size.toLocaleString()} bytes
                            (metadata เท่านั้น)
                          </p>
                          {draft.mode === "multipart" && (
                            <label className="mt-2 block">
                              Offset ของ {file.name} *
                              <input
                                className={inputClass}
                                placeholder="0x… จาก flash_args/manifest"
                                value={file.offset}
                                onChange={(event) =>
                                  update(
                                    "files",
                                    draft.files.map((item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            offset: event.target.value,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                spellCheck={false}
                                required
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            className="mt-3 text-sm text-[var(--danger)] underline"
                            onClick={() =>
                              update(
                                "files",
                                draft.files.filter((_, i) => i !== index),
                              )
                            }
                          >
                            นำ {file.name} ออกจากร่าง
                          </button>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                )}
              </>
            )}
            <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--border)] pt-5">
              <button
                type="button"
                disabled={step === 0}
                className={`${buttonClass} secondary`}
                onClick={() => move(step - 1)}
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                className={`${buttonClass} primary border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]`}
              >
                {step === 2 ? "บันทึกร่างและดูตัวอย่าง" : "ถัดไป"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
