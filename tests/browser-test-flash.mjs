import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const packagePath = (process.env.PATH ?? "")
  .split(path.delimiter)
  .map((dir) => path.resolve(dir, "../playwright/package.json"))
  .find(existsSync);
if (!packagePath)
  throw new Error(
    'Run: pnpm --package=playwright --shell-mode dlx "node tests/browser-test-flash.mjs"',
  );
const { chromium } = createRequire(packagePath)("playwright");
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
// Never show a hardware picker or connect to any real device during browser tests.
await page.addInitScript(() =>
  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: {
      requestPort: async () => {
        throw new DOMException("Cancelled", "NotFoundError");
      },
    },
  }),
);
function mergedFixture() {
  const bytes = new Uint8Array(0x10030).fill(0xff);
  const view = new DataView(bytes.buffer);
  for (const offset of [0, 0x10000]) {
    bytes.fill(0, offset, offset + 48);
    bytes[offset] = 0xe9;
    bytes[offset + 1] = 1;
    bytes[offset + 3] = 0x20;
    view.setUint16(offset + 12, 5, true);
    view.setUint32(offset + 24, 0x3fc80000, true);
    view.setUint32(offset + 28, 4, true);
    bytes[offset + 47] = 0xef;
  }
  bytes.fill(0, 0x8000, 0x8020);
  view.setUint16(0x8000, 0x50aa, true);
  view.setUint32(0x8004, 0x10000, true);
  view.setUint32(0x8008, 0x100000, true);
  return Buffer.from(bytes);
}
try {
  await page.goto(
    `${process.env.TEST_BASE_URL || "http://localhost:3000"}/test-flash`,
    { waitUntil: "networkidle" },
  );
  await page
    .getByRole("heading", { name: "ทดลองแฟลช ESP32-C3", exact: true })
    .waitFor();
  const connect = page.getByRole("button", {
    name: "เลือกพอร์ตและตรวจบอร์ด",
    exact: true,
  });
  const install = page.getByRole("button", {
    name: "ล้างข้อมูลและติดตั้ง",
    exact: true,
  });
  assert.equal(await connect.isDisabled(), true);
  assert.equal(await install.isDisabled(), true);
  const chooseProject = page.getByRole("button", {
    name: "เลือกโปรเจกต์นี้",
    exact: true,
  });
  assert.equal(await chooseProject.isDisabled(), true);
  const boardImage = page.getByRole("img", {
    name: /ภาพถ่ายอ้างอิงบอร์ด ESP32-C3 SuperMini/,
  });
  await boardImage.waitFor();
  assert.equal(
    await boardImage.evaluate(
      (image) => image.complete && image.naturalWidth > 0,
    ),
    true,
  );
  await page.getByRole("radio", { name: /ESP32-C3 SuperMini/ }).check();
  assert.equal(await chooseProject.isEnabled(), true);
  await page
    .getByRole("heading", {
      name: "เข้าโหมดแฟลชสำหรับ ESP32-C3 SuperMini",
      exact: true,
    })
    .waitFor();
  const steps = await page.locator("ol li").allTextContents();
  assert.equal(steps.length, 4);
  assert.match(steps[1], /กด BOOT ค้าง/);
  assert.match(steps[2], /กดแล้วปล่อย RESET/);
  assert.match(steps[3], /ปล่อย BOOT/);
  await page
    .getByText("ขั้นสูง: เลือกไฟล์ .bin จากคอมเอง", { exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "app-only.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(64),
  });
  await page.getByRole("status").filter({ hasText: "ทำต่อไม่ได้" }).waitFor();
  assert.equal(await connect.isDisabled(), true);
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic-merged.bin",
    mimeType: "application/octet-stream",
    buffer: mergedFixture(),
  });
  await page.getByText("synthetic-merged.bin", { exact: false }).waitFor();
  assert.equal(await connect.isEnabled(), true);
  assert.equal(await install.isDisabled(), true);
  assert.equal(await page.getByRole("checkbox").isDisabled(), true);
  await connect.click();
  await page
    .getByRole("status")
    .filter({ hasText: "ยกเลิกเลือกพอร์ต" })
    .waitFor();
  assert.equal(await install.isDisabled(), true);
  assert.equal(await connect.isEnabled(), true);
  if (!process.argv.includes("--local-package")) {
    const denied = await page.request.get(
      `${process.env.TEST_BASE_URL || "http://localhost:3000"}/api/test-flash/esp32-c3-check`,
      { headers: { "x-elephant-local-test": "1" } },
    );
    assert.equal(
      denied.status(),
      404,
      "production must never serve the private package",
    );
    assert.equal(denied.headers()["cache-control"], "no-store");
    const bytes = mergedFixture();
    await page.route("**/api/test-flash/esp32-c3-check*", (route) => {
      const download =
        new URL(route.request().url()).searchParams.get("download") === "1";
      return download
        ? route.fulfill({
            contentType: "application/octet-stream",
            body: bytes,
          })
        : route.fulfill({
            json: {
              id: "esp32-c3-check",
              name: "ESP32_C3_CHECK",
              chip: "ESP32-C3",
              board: "ESP32-C3 SuperMini",
              flashBytes: 4194304,
              byteLength: bytes.length,
              sha256: createHash("sha256").update(bytes).digest("hex"),
              applicationOffset: 65536,
              scope: "local-only",
              includesWifiCredentials: true,
              preparedAt: "2026-10-14T00:00:00.000Z",
            },
          });
    });
  }
  await page.getByRole("combobox").selectOption("esp32-c3-check");
  await page
    .getByRole("button", { name: "เลือกโปรเจกต์นี้", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "เลือก ESP32_C3_CHECK แล้ว" })
    .waitFor();
  assert.equal(await connect.isEnabled(), true);
  assert.equal(await install.isDisabled(), true);
  assert.equal(await page.getByRole("checkbox").isDisabled(), true);
  await connect.click();
  await page
    .getByRole("status")
    .filter({ hasText: "ยกเลิกเลือกพอร์ต" })
    .waitFor();
  assert.equal(await install.isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS test-flash project selection / ${process.argv.includes("--local-package") ? "real local firmware" : "production privacy + synthetic firmware"} / file validation / write gating / cancelled port / mobile width (no hardware accessed)`,
  );
} finally {
  await browser.close();
}
