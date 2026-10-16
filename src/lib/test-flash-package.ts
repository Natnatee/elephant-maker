export type TestFlashPackage = {
  flashBytes: number;
  flashSizeLabel: "1MB" | "2MB" | "4MB" | "8MB" | "16MB";
  applicationOffset: number;
  applicationKind: "factory" | "ota_0";
  byteLength: number;
  chip: "ESP32-C3";
};

const TABLE = 0x8000;
const TABLE_END = TABLE + 0xc00;
const MAX_BYTES = 16 * 1024 * 1024;
const LABELS = ["1MB", "2MB", "4MB", "8MB", "16MB"] as const;

/**
 * Experimental provisioning only: caller must confirm a full erase (eraseAll: true).
 * Checks structure and ESP XOR checksum, not partition MD5, app SHA256 or signatures.
 */
export function validateTestFlashPackage(bytes: Uint8Array): TestFlashPackage {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (!(bytes instanceof Uint8Array)) fail("ต้องใช้ข้อมูลไบนารี Uint8Array");
  if (!bytes.length) fail("ไฟล์เฟิร์มแวร์ว่าง");
  if (bytes.length > MAX_BYTES) fail("ไฟล์มีขนาดเกิน 16MiB");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const image = (offset: number, limit: number, name: string) => {
    const requireBytes = (end: number) => {
      if (end > bytes.length || end > limit)
        fail(`${name}: ข้อมูล image ไม่ครบหรือเกินพื้นที่ที่กำหนด`);
    };
    requireBytes(offset + 24);
    if (bytes[offset] !== 0xe9)
      fail(`${name}: magic ไม่ใช่ E9 ต้องเป็น merged binary ที่ offset 0`);
    if (view.getUint16(offset + 12, true) !== 5)
      fail(`${name}: chip ID ไม่ใช่ ESP32-C3`);
    const count = bytes[offset + 1];
    if (count < 1 || count > 16) fail(`${name}: จำนวน segment ไม่ถูกต้อง`);
    const hash = bytes[offset + 23];
    if (hash !== 0 && hash !== 1) fail(`${name}: hash flag ไม่ถูกต้อง`);
    let cursor = offset + 24;
    let checksum = 0xef;
    for (let i = 0; i < count; i++) {
      requireBytes(cursor + 8);
      const length = view.getUint32(cursor + 4, true);
      const dataStart = cursor + 8;
      cursor = dataStart + length;
      requireBytes(cursor);
      for (let j = dataStart; j < cursor; j++) checksum ^= bytes[j];
    }
    // The checksum is the last byte of the next 16-byte image-relative block.
    const end = offset + Math.ceil((cursor - offset + 1) / 16) * 16;
    requireBytes(end + (hash ? 32 : 0));
    if (bytes[end - 1] !== checksum) fail(`${name}: XOR checksum ไม่ถูกต้อง`);
  };
  image(0, TABLE, "Bootloader");
  const sizeCode = bytes[3] >>> 4;
  if (sizeCode > 4) fail("รหัสขนาดแฟลชไม่รองรับ (รองรับ 1/2/4/8/16MB)");
  const flashBytes = 1024 * 1024 * 2 ** sizeCode;
  if (bytes.length > flashBytes) fail("ไฟล์มีขนาดเกินความจุแฟลชใน header");
  if (bytes.length < TABLE_END)
    fail("ไม่มี partition table ครบที่ offset 0x8000: ไม่รับไฟล์ app-only");
  const ranges: { start: number; end: number }[] = [{ start: 0, end: 0x9000 }];
  type Application = { offset: number; end: number; subtype: number };
  const applications: Application[] = [];
  let factory: Application | undefined;
  let ota0: Application | undefined;
  let otadataCount = 0;
  const erased = (offset: number, end: number) =>
    bytes
      .subarray(offset, Math.min(end, bytes.length))
      .every((b) => b === 0xff);
  let entries = 0;
  let terminated = false;
  for (let cursor = TABLE; cursor < TABLE_END; cursor += 32) {
    const magic = view.getUint16(cursor, true);
    if (magic === 0xffff || magic === 0xebeb) {
      if (magic === 0xebeb) {
        if (
          !entries ||
          !bytes.subarray(cursor + 2, cursor + 16).every((b) => b === 0xff)
        )
          fail("รูปแบบ MD5 marker ของ partition table ไม่ถูกต้อง");
        cursor += 32;
      }
      if (!bytes.subarray(cursor, TABLE_END).every((b) => b === 0xff))
        fail("ข้อมูลหลังจุดจบ partition table ไม่ใช่ FF");
      terminated = true;
      break;
    }
    if (magic !== 0x50aa)
      fail("magic ของ partition entry ไม่ถูกต้อง (ต้องเป็น AA 50)");
    const type = bytes[cursor + 2];
    const subtype = bytes[cursor + 3];
    if (type !== 0 && type !== 1 && (type < 0x40 || type > 0xfe))
      fail("ชนิด partition ไม่ถูกต้อง");
    const offset = view.getUint32(cursor + 4, true);
    const size = view.getUint32(cursor + 8, true);
    const end = offset + size;
    if (view.getUint32(cursor + 28, true) & 1)
      fail("ไม่รองรับ encrypted partition flags ในทุก partition");
    if (
      !size ||
      offset % 0x1000 ||
      size % 0x1000 ||
      (type === 0 && offset % 0x10000)
    )
      fail("ตำแหน่งหรือขนาด partition ไม่ตรง alignment");
    if (end > flashBytes) fail("partition เกินความจุแฟลช");
    if (ranges.some((r) => offset < r.end && end > r.start))
      fail("partition ซ้อนทับกันหรือทับพื้นที่ bootloader/partition table");
    ranges.push({ start: offset, end });
    entries++;
    if (type === 1 && subtype === 0) {
      if (++otadataCount > 1)
        fail("พบ otadata partition ซ้ำ ไม่รองรับมากกว่าหนึ่ง partition");
      if (!erased(offset, end))
        fail(
          "otadata ต้องเป็น FF ทั้งหมด: กรุณา merge bootloader+partitions+firmware ใหม่โดยไม่ใส่ boot_app0 / otadata",
        );
    }
    if (type === 0) {
      const app = { offset, end, subtype };
      applications.push(app);
      if (subtype === 0) {
        if (factory)
          fail("พบ factory partition ซ้ำ จึงเลือก application ไม่ได้");
        factory = app;
      } else if (subtype === 0x10) {
        if (ota0) fail("พบ ota_0 partition ซ้ำ จึงเลือก application ไม่ได้");
        ota0 = app;
      }
    }
  }
  if (!terminated) fail("partition table ไม่มี terminator ภายใน 0xc00 bytes");
  const selected = factory ?? ota0;
  if (!selected)
    throw new Error(
      "ต้องมี factory หรือ ota_0 application partition หนึ่งรายการ",
    );
  for (const app of applications) {
    if (app !== selected && !erased(app.offset, app.end))
      fail(
        "ไม่รองรับหลาย application images: ข้อมูล app partition อื่นต้องเป็น FF ทั้งหมด",
      );
  }
  image(
    selected.offset,
    selected.end,
    factory ? "Factory application" : "OTA0 application",
  );
  return {
    flashBytes,
    flashSizeLabel: LABELS[sizeCode],
    applicationOffset: selected.offset,
    applicationKind: factory ? "factory" : "ota_0",
    byteLength: bytes.length,
    chip: "ESP32-C3",
  };
}
