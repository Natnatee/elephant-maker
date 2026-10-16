import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/lib/flash-boards.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const compiledModule = { exports: {} };
new Function("module", "exports", outputText)(
  compiledModule,
  compiledModule.exports,
);
const { SUPERMINI_BOARD: board, explainFlashError: explain } =
  compiledModule.exports;

test("SuperMini profile includes board image, ordered BOOT instructions and reset after flashing", () => {
  assert.equal(board.chip, "ESP32-C3");
  assert.equal(board.prepareSteps.length, 4);
  assert.match(board.prepareSteps[1], /กด BOOT ค้าง/);
  assert.match(board.prepareSteps[2], /ขณะกด BOOT ค้าง.*กดแล้วปล่อย RESET/);
  assert.match(board.prepareSteps[3], /ปล่อย BOOT.*เลือกพอร์ต/);
  assert.match(board.afterFlash, /RESET.*ไม่ต้องกด BOOT/);
  assert.equal(
    existsSync(new URL(`../public${board.image}`, import.meta.url)),
    true,
  );
});
test("file errors never advise resetting hardware and preserve actionable Thai reason", () => {
  const message = explain(new Error("SHA-256 ไม่ตรง"), "file");
  assert.match(message, /SHA-256 ไม่ตรง/);
  assert.match(message, /ยังไม่ได้เขียน Flash/);
  assert.doesNotMatch(message, /RESET/);
});
test("connection timeout explains the board download-mode sequence without claiming a detected port", () => {
  const message = explain(
    new Error("Failed to connect with the device"),
    "connect",
  );
  assert.match(message, /BOOT ค้าง → กดแล้วปล่อย RESET → ปล่อย BOOT/);
  assert.match(message, /ยังไม่ได้เขียน Flash/);
  assert.doesNotMatch(message, /พบพอร์ต/);
});
test("port opening errors advise closing competing serial applications", () => {
  assert.match(
    explain(new Error("Failed to open serial port"), "connect"),
    /เปิดพอร์ตไม่ได้.*Serial Monitor/,
  );
});
test("board compatibility failures do not suggest overriding checks", () => {
  assert.match(
    explain(new Error("พบ ESP32-S3 แต่รองรับ ESP32-C3 เท่านั้น"), "connect"),
    /ตรวจบอร์ดไม่ผ่าน.*อย่าฝืนติดตั้ง/,
  );
});
test("flash errors warn of partial writes instead of pretending flash is unchanged", () => {
  const message = explain(new Error("MD5 mismatch"), "flash");
  assert.match(message, /อาจเขียนไปแล้วบางส่วน/);
  assert.doesNotMatch(message, /ยังไม่ได้เขียน Flash/);
});
