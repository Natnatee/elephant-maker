import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const packagePath = (process.env.PATH ?? "")
  .split(path.delimiter)
  .map((dir) => path.resolve(dir, "../playwright/package.json"))
  .find(existsSync);
if (!packagePath)
  throw new Error(
    'Run: pnpm --package=playwright --shell-mode dlx "node tests/browser-project-flash.mjs"',
  );
const { chromium } = createRequire(packagePath)("playwright");
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";

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

// No real picker, port enumeration, firmware download, or device is permitted.
await page.addInitScript(() => {
  window.projectFlashSerial = { calls: 0, cancel: null };
  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: {
      requestPort: () => {
        window.projectFlashSerial.calls += 1;
        return new Promise((resolve, reject) => {
          window.projectFlashSerial.cancel = () =>
            reject(new DOMException("Cancelled", "NotFoundError"));
        });
      },
      getPorts: () => {
        throw new Error("Unexpected port enumeration");
      },
    },
  });
});
const bytes = mergedFixture();
let releaseMetadata;
const metadataGate = new Promise((resolve) => {
  releaseMetadata = resolve;
});
let metadataCalls = 0;
let downloadCalls = 0;
await page.route("**/api/test-flash/**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  assert.equal(request.method(), "GET");
  assert.equal(url.pathname, "/api/test-flash/esp32-c3-check");
  if (url.searchParams.get("download") === "1") {
    downloadCalls += 1;
    await route.fulfill({
      contentType: "application/octet-stream",
      body: bytes,
    });
  } else {
    metadataCalls += 1;
    await metadataGate;
    await route.fulfill({
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
  }
});
const dialog = page.getByRole("dialog", {
  name: "ติดตั้ง · เทสesp32c3",
  exact: true,
});
const opener = page.getByRole("button", { name: "แฟลช ESP32-C3", exact: true });
const close = dialog.getByRole("button", {
  name: "ปิดหน้าต่างแฟลช",
  exact: true,
});
const prepare = dialog.getByRole("button", {
  name: "ใช้บอร์ดนี้และเตรียมเฟิร์มแวร์",
  exact: true,
});
const board = dialog.getByRole("radio", { name: /ESP32-C3 SuperMini/ });
const connect = dialog.getByRole("button", {
  name: "เลือกพอร์ตและตรวจบอร์ด",
  exact: true,
});
const install = dialog.getByRole("button", {
  name: "ล้างข้อมูลและติดตั้ง",
  exact: true,
});
const confirmation = dialog.getByRole("checkbox");
async function assertModal() {
  assert.equal(
    await dialog.evaluate(
      (node) =>
        node.tagName === "DIALOG" && node.open && node.matches(":modal"),
    ),
    true,
  );
}
async function assertFresh() {
  await dialog.waitFor();
  await assertModal();
  assert.equal(await board.isChecked(), false);
  assert.equal(await prepare.isDisabled(), true);
  assert.equal(await connect.isDisabled(), true);
  assert.equal(await install.isDisabled(), true);
  assert.equal(await confirmation.isDisabled(), true);
  assert.equal(await confirmation.isChecked(), false);
  assert.equal(await dialog.getByText(/KiB/).count(), 0);
  assert.equal(
    await dialog
      .locator('input[type="file"]')
      .evaluate((node) => node.files.length),
    0,
  );
  assert.equal(await dialog.getByRole("combobox").count(), 0);
  const panels = await dialog.locator(".panel").evaluateAll((nodes) =>
    nodes.map((node) => {
      const styles = getComputedStyle(node);
      const expected = innerWidth >= 640 ? 24 : 16;
      return [
        styles.paddingTop,
        styles.paddingRight,
        styles.paddingBottom,
        styles.paddingLeft,
      ].every((value) => parseFloat(value) === expected);
    }),
  );
  assert.ok(
    panels.length >= 5 && panels.every(Boolean),
    "Every flash panel must have responsive internal padding",
  );
  await dialog
    .getByRole("heading", { name: "1. เลือกบอร์ด", exact: true })
    .waitFor();
}
async function assertBusyCannotClose() {
  await page.waitForFunction(
    () => document.querySelector("dialog[open] button")?.disabled,
  );
  assert.equal(await close.isDisabled(), true);
  // Native disabled click is a no-op; Playwright click would wait for enabled.
  await close.evaluate((node) => node.click());
  await page.keyboard.press("Escape");
  await assertModal();
}
async function assertClosed() {
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.textContent.trim() === "แฟลช ESP32-C3",
  );
  assert.equal(
    await opener.evaluate((node) => node === document.activeElement),
    true,
  );
}
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  const card = page.locator(".project-card").filter({
    has: page.getByRole("heading", { name: "เทสesp32c3", exact: true }),
  });
  assert.equal(await card.count(), 1);
  assert.ok(
    (await card.locator('a[href="/projects/test-esp32c3"]').count()) > 0,
  );
  const cover = card.locator("img");
  assert.ok(
    (await cover.getAttribute("src")).includes(
      encodeURIComponent("/board/esp32c3Supermini.webp"),
    ) ||
      (await cover.getAttribute("src")).includes(
        "/board/esp32c3Supermini.webp",
      ),
  );
  await card.getByRole("heading", { name: "เทสesp32c3", exact: true }).click();
  await page.waitForURL("**/projects/test-esp32c3");
  assert.equal(
    await opener.evaluate((button) => {
      const group = button.parentElement;
      const styles = getComputedStyle(group);
      const guide = group.querySelector('a[href="#guide-start"]');
      const primary = button.getBoundingClientRect();
      const secondary = guide.getBoundingClientRect();
      return (
        styles.display === "flex" &&
        parseFloat(styles.columnGap) >= 12 &&
        parseFloat(styles.rowGap) >= 12 &&
        secondary.left - primary.right >= 12
      );
    }),
    true,
    "Project action buttons must have a real 12px gap",
  );
  await opener.click();
  await assertFresh();
  assert.equal(
    await dialog
      .getByRole("heading", { name: "ติดตั้ง · เทสesp32c3", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  const photo = dialog.getByRole("img", {
    name: "ภาพถ่ายอ้างอิงบอร์ด ESP32-C3 SuperMini",
    exact: true,
  });
  await photo.waitFor();
  await photo.evaluate((image) => image.decode());
  assert.equal(
    await photo.evaluate((image) => image.complete && image.naturalWidth > 0),
    true,
  );
  assert.equal(await page.evaluate(() => window.projectFlashSerial.calls), 0);
  assert.equal(metadataCalls, 0);
  await board.check();
  assert.equal(await prepare.isEnabled(), true);
  await page.keyboard.press("Escape");
  await assertClosed();
  await opener.click();
  await assertFresh();
  await board.check();
  await prepare.click();
  await page.waitForFunction(
    () => document.querySelector("dialog[open] button")?.disabled,
  );
  await assertBusyCannotClose();
  assert.equal(metadataCalls, 1);
  assert.equal(downloadCalls, 0);
  assert.equal(await page.evaluate(() => window.projectFlashSerial.calls), 0);
  releaseMetadata();
  await dialog
    .getByRole("status")
    .filter({ hasText: "เลือก ESP32_C3_CHECK แล้ว" })
    .waitFor();
  assert.equal(downloadCalls, 1);
  assert.equal(await connect.isEnabled(), true);
  assert.equal(await close.isEnabled(), true);
  assert.equal(await install.isDisabled(), true);
  await close.click();
  await assertClosed();
  await opener.click();
  await assertFresh();
  await board.check();
  await dialog
    .getByText("ขั้นสูง: เลือกไฟล์ .bin จากคอมเอง", { exact: true })
    .click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "synthetic-merged.bin",
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await dialog.getByText(/synthetic-merged.bin/).waitFor();
  assert.equal(await connect.isEnabled(), true);
  await connect.click();
  await page.waitForFunction(
    () =>
      window.projectFlashSerial.calls === 1 &&
      typeof window.projectFlashSerial.cancel === "function",
  );
  await assertBusyCannotClose();
  await page.evaluate(() => window.projectFlashSerial.cancel());
  await dialog
    .getByRole("status")
    .filter({ hasText: "ยกเลิกเลือกพอร์ต" })
    .waitFor();
  assert.equal(await close.isEnabled(), true);
  assert.equal(await connect.isEnabled(), true);
  assert.equal(await install.isDisabled(), true);
  assert.equal(await confirmation.isDisabled(), true);
  await close.click();
  await assertClosed();
  await opener.click();
  await assertFresh();
  await page.screenshot({ path: ".next/project-flash-modal.png" });
  assert.ok(statSync(".next/project-flash-modal.png").size > 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertFresh();
  const advancedSummary = dialog.getByText(
    "ขั้นสูง: เลือกไฟล์ .bin จากคอมเอง",
    { exact: true },
  );
  await advancedSummary.click();
  assert.equal(
    await advancedSummary.evaluate((summary) => {
      const details = summary.parentElement;
      const content = summary.nextElementSibling;
      return (
        parseFloat(getComputedStyle(details).paddingLeft) >= 16 &&
        content.getBoundingClientRect().top -
          summary.getBoundingClientRect().bottom >=
          16
      );
    }),
    true,
    "Expanded advanced settings must have padding and a content gap",
  );
  await advancedSummary.click();
  await dialog.evaluate((node) => {
    node.scrollTop = 0;
  });
  const mobile = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const before = node.scrollTop;
    node.scrollTop = node.scrollHeight;
    return {
      fits:
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        rect.top >= 0 &&
        rect.bottom <= innerHeight,
      noOverflow:
        document.documentElement.scrollWidth <= innerWidth &&
        node.scrollWidth <= node.clientWidth,
      scrollable:
        node.scrollHeight > node.clientHeight && node.scrollTop > before,
    };
  });
  assert.deepEqual(mobile, { fits: true, noOverflow: true, scrollable: true });
  await page.keyboard.press("Escape");
  await assertClosed();
  await page.goto(`${origin}/projects/k-line-read-only-demo`, {
    waitUntil: "networkidle",
  });
  assert.equal(
    await page
      .getByRole("button", {
        name: "แฟลชไม่ได้ · ไม่มีไบนารีจริง",
        exact: true,
      })
      .isDisabled(),
    true,
  );
  assert.equal(await opener.count(), 0);
  assert.equal(await page.locator('[aria-haspopup="dialog"]').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS project card / native modal focus and reset / held metadata + synthetic checksum / held cancelled serial picker / flash gates / mobile bounds and scrolling / legacy disabled flash (no real firmware or hardware accessed)",
  );
} finally {
  releaseMetadata();
  await browser.close();
}
