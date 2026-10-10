import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Run via pnpm's temporary Playwright package; no browser-test dependency is added to the app.
const packagePath = (process.env.PATH ?? "")
  .split(path.delimiter)
  .map((dir) => path.resolve(dir, "../playwright/package.json"))
  .find(existsSync);
if (!packagePath)
  throw new Error(
    'Run: pnpm --package=playwright --shell-mode dlx "node tests/browser-smoke.mjs"',
  );
const { chromium } = createRequire(packagePath)("playwright");
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".project-card").count(), 6);
  await page.getByRole("button", { name: "ยานยนต์", exact: true }).click();
  assert.equal(await page.locator(".project-card").count(), 1);
  await page.getByRole("button", { name: "ล้างตัวกรองทั้งหมด" }).click();
  await page
    .getByRole("searchbox", { name: "ค้นหาโปรเจกต์" })
    .fill("คำที่ไม่มีในฐานข้อมูล");
  await page
    .getByRole("heading", { name: "ยังไม่พบไอเดียที่ตรงกับคำค้น" })
    .waitFor();
  await page.getByRole("button", { name: "ดูโปรเจกต์ทั้งหมด" }).click();
  assert.equal(await page.locator(".project-card").count(), 6);
  console.log("PASS search/category/reset/empty state");

  await page.goto(`${origin}/projects/k-line-read-only-demo`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "ถัดไป →", exact: true }).click();
  assert.ok(
    (await page.locator('[aria-current="step"]').innerText()).includes("2"),
  );
  await page.getByRole("button", { name: "← ก่อนหน้า", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ดาวน์โหลดการ์ด PNG" }).click(),
  ]);
  assert.ok(download.suggestedFilename().endsWith("-social-card.png"));
  assert.equal(
    await page
      .getByRole("button", { name: "แฟลชไม่ได้ · ไม่มีไบนารีจริง" })
      .isDisabled(),
    true,
  );
  console.log("PASS guide navigation/share PNG/demo flash disabled");

  await page.goto(`${origin}/submit`, { waitUntil: "networkidle" });
  await page
    .getByLabel("ชื่อผลงาน", { exact: false })
    .fill("ทดสอบฝากผลงานจากเบราว์เซอร์");
  await page
    .getByLabel("คำอธิบายสั้น", { exact: false })
    .fill("ข้อมูลสำหรับทดสอบ UX ไม่ใช่ผลงานจริง");
  await page.getByLabel("หมวดหมู่", { exact: false }).selectOption("ยานยนต์");
  await page
    .getByLabel("ระดับความพร้อม", { exact: false })
    .selectOption("showcase");
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page
    .getByRole("button", { name: "บันทึกร่างและดูตัวอย่าง", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "ตัวอย่างร่าง • ยังไม่ได้เผยแพร่" })
    .waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "เปิดร่างที่บันทึกไว้" }).click();
  const draft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("elephant-maker:submission:v1")),
  );
  assert.equal(draft.draft.title, "ทดสอบฝากผลงานจากเบราว์เซอร์");
  assert.equal(draft.draft.readiness, "showcase");
  console.log("PASS wizard showcase/save/resume without forced guide");

  await page.goto(`${origin}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /ทดลองเลือก Google/ }).click();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("elephant-maker:mock-identity:v1"),
    ),
    "Google",
  );
  await page
    .getByRole("button", { name: "ออกจากบัญชีจำลอง", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("elephant-maker:mock-identity:v1"),
    ),
    null,
  );
  console.log("PASS mock account select/logout");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
  await page.getByRole("navigation", { name: "เมนูมือถือ" }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS mobile width/menu/no uncaught page errors");
} finally {
  await browser.close();
}
