import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/lib/test-flash-package.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
const compiledModule = { exports: {} };
new Function("module", "exports", outputText)(
  compiledModule,
  compiledModule.exports,
);
const { validateTestFlashPackage: validate } = compiledModule.exports;

function image(bytes, offset, lengths = [4], hash = 0) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  bytes.fill(0, offset, offset + 24);
  bytes[offset] = 0xe9;
  bytes[offset + 1] = lengths.length;
  bytes[offset + 3] = 0x20;
  view.setUint16(offset + 12, 5, true);
  bytes[offset + 23] = hash;
  let cursor = offset + 24;
  let checksum = 0xef;
  for (const length of lengths) {
    view.setUint32(cursor, 0x3fc80000, true);
    view.setUint32(cursor + 4, length, true);
    bytes.fill(0x12, cursor + 8, cursor + 8 + length);
    for (let i = 0; i < length; i++) checksum ^= 0x12;
    cursor += 8 + length;
  }
  const end = offset + Math.ceil((cursor - offset + 1) / 16) * 16;
  bytes.fill(0, cursor, end);
  bytes[end - 1] = checksum;
  if (hash) bytes.fill(0x42, end, end + 32);
  return end + (hash ? 32 : 0);
}
function entry(bytes, index, type, subtype, offset, size) {
  const cursor = 0x8000 + index * 32;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  bytes.fill(0, cursor, cursor + 32);
  view.setUint16(cursor, 0x50aa, true);
  bytes[cursor + 2] = type;
  bytes[cursor + 3] = subtype;
  view.setUint32(cursor + 4, offset, true);
  view.setUint32(cursor + 8, size, true);
}
function fixture(hash = 0) {
  const bytes = new Uint8Array(0x11000).fill(0xff);
  image(bytes, 0, [4, 16]);
  entry(bytes, 0, 1, 2, 0x9000, 0x6000);
  entry(bytes, 1, 0, 0, 0x10000, 0x100000);
  const end = image(bytes, 0x10000, [4, 16], hash);
  return bytes.slice(0, end);
}
function rejects(change, pattern) {
  const bytes = fixture();
  change(bytes, new DataView(bytes.buffer));
  assert.throws(() => validate(bytes), pattern);
}

test("merged C3 factory image returns capacity and offsets without mutation", () => {
  const bytes = fixture();
  const original = bytes.slice();
  assert.deepEqual(validate(bytes), {
    flashBytes: 4 * 1024 * 1024,
    flashSizeLabel: "4MB",
    applicationOffset: 0x10000,
    applicationKind: "factory",
    byteLength: bytes.length,
    chip: "ESP32-C3",
  });
  assert.deepEqual(bytes, original);
  const wrapped = new Uint8Array(bytes.length + 9);
  wrapped.set(bytes, 5);
  assert.equal(
    validate(wrapped.subarray(5, 5 + bytes.length)).applicationOffset,
    0x10000,
  );
});
test("supports all five capacity codes", () => {
  for (let code = 0; code <= 4; code++) {
    const bytes = fixture();
    entry(bytes, 1, 0, 0, 0x10000, 0x80000);
    bytes[3] = code << 4;
    assert.equal(validate(bytes).flashBytes, 2 ** code * 1024 * 1024);
  }
  rejects((b) => {
    b[3] = 0x50;
  }, /รหัสขนาด/);
});
test("rejects empty, wrong input, oversized and app-only files", () => {
  assert.throws(() => validate(new Uint8Array()), /ว่าง/);
  assert.throws(() => validate([]), /Uint8Array/);
  assert.throws(() => validate(new Uint8Array(16 * 1024 * 1024 + 1)), /16MiB/);
  assert.throws(() => validate(fixture().slice(0x10000)), /partition table/);
  rejects((b) => {
    b[0] = 0;
  }, /magic/);
  rejects((b, v) => v.setUint16(12, 0x105, true), /chip ID/);
  rejects((b, v) => v.setUint16(0x1000c, 9, true), /chip ID/);
  rejects((b) => {
    b[0x10000] = 0;
  }, /magic/);
});
test("rejects malformed or unterminated tables and accepts optional MD5 marker", () => {
  rejects((b) => {
    b[0x8000] = 0;
  }, /magic/);
  rejects((b) => {
    b[0x8042] = 1;
  }, /จุดจบ/);
  rejects((b) => {
    b[0x8002] = 2;
  }, /ชนิด/);
  const bytes = fixture();
  bytes[0x8040] = 0xeb;
  bytes[0x8041] = 0xeb;
  bytes.fill(0x42, 0x8050, 0x8060);
  assert.equal(validate(bytes).chip, "ESP32-C3");
  bytes[0x8042] = 0;
  assert.throws(() => validate(bytes), /MD5 marker/);
  const full = fixture();
  full[3] = 0x40;
  for (let i = 0; i < 96; i++)
    entry(full, i, 1, 2, 0x10000 + i * 0x1000, 0x1000);
  assert.throws(() => validate(full), /terminator/);
});
test("rejects misalignment, zero sizes, overlaps and flash overflow", () => {
  rejects((b, v) => v.setUint32(0x8004, 0x9001, true), /alignment/);
  rejects((b, v) => v.setUint32(0x8024, 0x11000, true), /alignment/);
  rejects((b, v) => v.setUint32(0x8008, 1, true), /alignment/);
  rejects((b, v) => v.setUint32(0x8008, 0, true), /alignment/);
  for (const offset of [0, 0x7000, 0x8000, 0x10000])
    rejects((b, v) => v.setUint32(0x8004, offset, true), /ซ้อนทับ/);
  rejects((b, v) => v.setUint32(0x8028, 0x400000, true), /ความจุ/);
  const bytes = new Uint8Array(0x100001).fill(0xff);
  bytes.set(fixture());
  bytes[3] = 0;
  assert.throws(() => validate(bytes), /ไฟล์มีขนาดเกินความจุ/);
});
test("selects factory first, otherwise exactly one OTA0", () => {
  rejects((b) => {
    b[0x8023] = 0x11;
  }, /factory หรือ ota_0/);
  rejects((b) => {
    b[0x8023] = 0x10;
    entry(b, 2, 0, 0x10, 0x120000, 0x10000);
  }, /ota_0 partition ซ้ำ/);
  rejects((b) => entry(b, 2, 0, 0, 0x120000, 0x10000), /factory partition ซ้ำ/);
  const bytes = fixture();
  entry(bytes, 2, 0, 0x10, 0x120000, 0x10000);
  assert.equal(validate(bytes).applicationOffset, 0x10000);
});
test("OTA0 provisioning accepts erased, absent and partially present otadata", () => {
  const bytes = fixture();
  entry(bytes, 0, 1, 0, 0x9000, 0x2000);
  bytes[0x8023] = 0x10;
  entry(bytes, 2, 0, 0x11, 0x120000, 0x10000);
  assert.equal(validate(bytes).applicationKind, "ota_0");
  assert.equal(validate(bytes).applicationOffset, 0x10000);
  bytes[0x9000] = 0;
  assert.throws(() => validate(bytes), /otadata.*boot_app0/);
  bytes[0x9000] = 0xff;
  entry(bytes, 0, 1, 0, 0x220000, 0x2000);
  assert.equal(validate(bytes).applicationKind, "ota_0");
  entry(bytes, 0, 1, 0, 0x110000, 0x2000);
  const partial = new Uint8Array(0x110001).fill(0xff);
  partial.set(bytes);
  assert.equal(validate(partial).applicationKind, "ota_0");
  partial[0x110000] = 0;
  assert.throws(() => validate(partial), /otadata.*boot_app0/);
  entry(bytes, 3, 1, 0, 0x230000, 0x2000);
  assert.throws(() => validate(bytes), /otadata partition ซ้ำ/);
});
test("rejects any populated alternate app, including with a preferred factory", () => {
  for (const subtype of [0x10, 0x11, 0x20]) {
    const bytes = new Uint8Array(0x120001).fill(0xff);
    bytes.set(fixture());
    entry(bytes, 2, 0, subtype, 0x120000, 0x10000);
    assert.equal(validate(bytes).applicationKind, "factory");
    bytes[0x120000] = 0xe9;
    assert.throws(() => validate(bytes), /หลาย application/);
    bytes[0x8023] = 0x10;
    if (subtype !== 0x10)
      assert.throws(() => validate(bytes), /หลาย application/);
  }
});
test("rejects encrypted flags on apps and data even outside the file", () => {
  for (const index of [0, 1, 2]) {
    rejects((b, v) => {
      if (index === 2) entry(b, 2, 1, 2, 0x220000, 0x1000);
      v.setUint32(0x8000 + index * 32 + 28, 1, true);
    }, /encrypted/);
  }
});
test("validates XOR over every segment payload and stored checksum", () => {
  for (const offset of [0, 0x10000]) {
    const bytes = fixture();
    image(bytes, offset, [3, 5]);
    assert.equal(validate(bytes).chip, "ESP32-C3");
    for (const relative of [32, 43, 47, 63]) {
      const corrupt = bytes.slice();
      corrupt[offset + relative] ^= 1;
      assert.throws(() => validate(corrupt), /XOR checksum/);
    }
  }
});
test("checks complete segment headers, payloads, padding/checksum and hash bytes", () => {
  const bytes = fixture(1);
  assert.equal(validate(bytes).byteLength, bytes.length);
  for (const end of [
    0x10000,
    0x10017,
    0x1001f,
    0x10023,
    bytes.length - 33,
    bytes.length - 1,
  ])
    assert.throws(() => validate(bytes.slice(0, end)), /ข้อมูล image ไม่ครบ/);
  rejects((b, v) => v.setUint32(28, 0xffffffff, true), /Bootloader.*ไม่ครบ/);
  rejects((b, v) => v.setUint32(0x1001c, 0xffffffff, true), /Factory.*ไม่ครบ/);
  rejects((b) => {
    b[1] = 0;
  }, /segment/);
  rejects((b) => {
    b[0x10001] = 17;
  }, /segment/);
  rejects((b) => {
    b[23] = 2;
  }, /hash flag/);
  const bootHash = fixture();
  image(bootHash, 0, [4], 1);
  assert.equal(validate(bootHash).chip, "ESP32-C3");
  // A complete app in the file must still fit its declared partition.
  const large = new Uint8Array(0x12000).fill(0xff);
  large.set(fixture());
  entry(large, 1, 0, 0, 0x10000, 0x1000);
  image(large, 0x10000, [0x1000]);
  assert.throws(() => validate(large), /Factory.*ไม่ครบ/);
});
