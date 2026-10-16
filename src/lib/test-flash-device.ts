import type { ESPLoader, Transport } from "esptool-js";
import SparkMD5 from "spark-md5";
import {
  validateTestFlashPackage,
  type TestFlashPackage,
} from "./test-flash-package";

export type FlashDevice = {
  loader: ESPLoader;
  transport: Transport;
  description: string;
  revision: number;
  flashBytes: number;
  flashSize: string;
};

export async function prepareC3DownloadSession(
  loader: Pick<ESPLoader, "writeReg" | "readReg">,
) {
  // C3 RTC watchdog registers are volatile, not eFuse. Prevent USB download-mode resets.
  // Register definitions: Espressif ESP32-C3 RTC_CNTL, as used by esptool's C3 target.
  await loader.writeReg(0x600080a8, 0x50d83aa1);
  try {
    await loader.writeReg(0x60008090, 0);
  } finally {
    await loader.writeReg(0x600080a8, 0);
  }
  await loader.writeReg(0x600080b0, 0x8f1d312a);
  try {
    await loader.writeReg(
      0x600080ac,
      (await loader.readReg(0x600080ac)) | 0x80000000,
    );
  } finally {
    await loader.writeReg(0x600080b0, 0);
  }
}

export async function inspectFlashDevice(
  port: SerialPort,
  log: (line: string) => void,
): Promise<FlashDevice> {
  const { ESPLoader, Transport } = await import("esptool-js");
  const transport = new Transport(port, false);
  const loader = new ESPLoader({
    transport,
    baudrate: 115200,
    romBaudrate: 115200,
    debugLogging: false,
    terminal: { clean() {}, write: log, writeLine: log },
  });
  try {
    // The user has already entered download mode. Do not auto-reset into application code.
    await loader.connect("no_reset", 3);
    if (loader.chip.CHIP_NAME !== "ESP32-C3") {
      throw new Error(
        `พบ ${loader.chip.CHIP_NAME} แต่หน้านี้รองรับ ESP32-C3 เท่านั้น`,
      );
    }
    const security = await loader.getSecurityInfo();
    if (
      security.chipId !== 5 ||
      security.parsedFlags.SECURE_BOOT_EN ||
      security.parsedFlags.SECURE_DOWNLOAD_ENABLE ||
      security.flashCryptCnt !== 0
    ) {
      throw new Error(
        "บอร์ดมีการตั้งค่า Secure Boot / Flash Encryption / Secure Download ที่หน้านี้ไม่รองรับ หยุดก่อนเขียน",
      );
    }
    await prepareC3DownloadSession(loader);
    const description = await loader.chip.getChipDescription(loader);
    const c3 = loader.chip as typeof loader.chip & {
      getMajorChipVersion(loader: ESPLoader): Promise<number>;
      getMinorChipVersion(loader: ESPLoader): Promise<number>;
    };
    const revision =
      (await c3.getMajorChipVersion(loader)) * 100 +
      (await c3.getMinorChipVersion(loader));
    await loader.chip.postConnect?.(loader);
    // This helper executes in RAM only; it does not replace firmware in Flash.
    await loader.runStub();
    if (!loader.IS_STUB)
      throw new Error("เริ่มตัวช่วยใน RAM ไม่สำเร็จ จึงหยุดก่อนเขียน");
    const flashSize = await loader.detectFlashSize();
    if (!flashSize)
      throw new Error("ตรวจขนาด Flash ไม่ได้ จึงยังไม่อนุญาตให้แฟลช");
    const match = /^(1|2|4|8|16)MB$/.exec(flashSize);
    if (!match) throw new Error("ขนาด Flash นี้อยู่นอกขอบเขตทดลอง 1–16 MB");
    const flashBytes = Number(match[1]) * 1024 * 1024;
    if (flashBytes <= 0) throw new Error("ขนาด Flash ที่อ่านได้ไม่ถูกต้อง");
    return { loader, transport, description, revision, flashBytes, flashSize };
  } catch (error) {
    await transport.disconnect().catch(() => {});
    throw error;
  }
}

export function checkFlashCompatibility(
  device: Pick<FlashDevice, "flashBytes" | "revision">,
  bytes: Uint8Array,
  info: TestFlashPackage,
) {
  if (device.flashBytes !== info.flashBytes)
    throw new Error("ขนาด Flash ของบอร์ดไม่ตรงกับชุดเฟิร์มแวร์ หยุดก่อนเขียน");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const offset of [0, info.applicationOffset]) {
    const legacyMinimum = bytes[offset + 14];
    const minimum = view.getUint16(offset + 15, true);
    const maximum = view.getUint16(offset + 17, true);
    const useFull =
      maximum !== 0 &&
      !(maximum === 65535 && minimum === 0 && legacyMinimum !== 0);
    const compatible = useFull
      ? device.revision >= minimum && device.revision <= maximum
      : device.revision % 100 >= legacyMinimum;
    if (!compatible) {
      throw new Error(
        "revision ของชิปไม่อยู่ในช่วงที่เฟิร์มแวร์รองรับ หยุดก่อนเขียน",
      );
    }
  }
}

export async function verifyPackageIntegrity(
  bytes: Uint8Array,
  info: TestFlashPackage,
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const offset of [0, info.applicationOffset]) {
    if (bytes[offset + 23] !== 1) continue;
    let cursor = offset + 24;
    for (let segment = 0; segment < bytes[offset + 1]; segment++) {
      cursor += 8 + view.getUint32(cursor + 4, true);
    }
    const end = offset + Math.ceil((cursor - offset + 1) / 16) * 16;
    const actual = new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes.slice(offset, end).buffer),
    );
    if (!actual.every((value, index) => value === bytes[end + index]))
      throw new Error("SHA-256 ของ firmware image ไม่ตรง ไฟล์อาจเสียหาย");
  }
  for (let cursor = 0x8000; cursor < 0x8c00; cursor += 32) {
    const magic = view.getUint16(cursor, true);
    if (magic === 0xffff) break;
    if (magic === 0xebeb) {
      const actual = SparkMD5.ArrayBuffer.hash(
        bytes.slice(0x8000, cursor).buffer,
      );
      const expected = Array.from(bytes.slice(cursor + 16, cursor + 32), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (actual !== expected)
        throw new Error("MD5 ของ partition table ไม่ตรง ไฟล์อาจเสียหาย");
      break;
    }
  }
}

export async function installFlashPackage(
  device: FlashDevice,
  bytes: Uint8Array,
  reportProgress: (written: number, total: number) => void,
) {
  const info = validateTestFlashPackage(bytes);
  checkFlashCompatibility(device, bytes, info);
  await verifyPackageIntegrity(bytes, info);
  // Recheck cached ROM security information before issuing the first destructive command.
  const security = await device.loader.getSecurityInfo();
  if (
    security.chipId !== 5 ||
    security.parsedFlags.SECURE_BOOT_EN ||
    security.parsedFlags.SECURE_DOWNLOAD_ENABLE ||
    security.flashCryptCnt !== 0
  )
    throw new Error("สถานะความปลอดภัยไม่รองรับ หยุดก่อนเขียน");
  await device.loader.writeFlash({
    fileArray: [{ data: bytes, address: 0 }],
    flashMode: "keep",
    flashFreq: "keep",
    flashSize: "keep",
    eraseAll: true,
    compress: true,
    calculateMD5Hash: (image) =>
      SparkMD5.ArrayBuffer.hash(new Uint8Array(image).buffer),
    reportProgress: (_index, written, total) => reportProgress(written, total),
  });
}
