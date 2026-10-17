import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const packagePath = (process.env.PATH ?? "").split(path.delimiter).map((dir) => path.resolve(dir, "../playwright/package.json")).find(existsSync);
if (!packagePath) throw new Error('Run: pnpm --package=playwright --shell-mode dlx "node tests/browser-project-detail.mjs"');
const { chromium } = createRequire(packagePath)("playwright");
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => { if (response.url().includes('.css') && response.status() !== 200) console.log('CSS response', response.status(), response.url()); });
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
const db = JSON.parse(readFileSync(new URL("../src/data/mock-db.json", import.meta.url), "utf8"));
try {
  const flashProject = db.projects.find((item) => item.flashDemo);
  for (const width of [1560, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/projects/${flashProject.slug}`, { waitUntil: "networkidle" });
    await page.locator(".project-detail-hero").waitFor();
    await page.getByRole("button", { name: "Flash", exact: true }).waitFor();
    assert.equal(await page.locator('.project-hero-buttons > .button').count(), 1);
    assert.equal(await page.locator('#safety-title, #author-title').count(), 0);
    assert.equal(await page.locator('.project-related .project-card').count(), 3);
    assert.equal(await page.locator('.project-hero-info').getByText('งบประมาณ', { exact: true }).count(), 0);
    const articleSection = page.locator('section[aria-labelledby="steps-title"]');
    assert.equal(await articleSection.getByRole('button').count(), 0);
    assert.equal(await articleSection.locator('.project-markdown h3').count(), db.steps.filter((step) => step.projectId === flashProject.id).length);
    assert.equal(await page.locator('#files-title').count(), 0);
    assert.equal(await page.locator('.project-material-link').count(), 1);
    assert.equal(await page.locator('.project-reference-list a').count(), 2);
    const layout = await page.evaluate(() => {
      const content = document.querySelector('.project-detail-content').getBoundingClientRect();
      const related = document.querySelector('.project-related').getBoundingClientRect();
      const image = document.querySelector('.project-gallery-main').getBoundingClientRect();
      return { sideBySide: related.left > content.right, below: related.top >= content.bottom, overflow: document.documentElement.scrollWidth > innerWidth, ratio: image.width / image.height, heroDisplay: getComputedStyle(document.querySelector('.project-detail-hero')).display, imageAspect: getComputedStyle(document.querySelector('.project-gallery-main')).aspectRatio };
    });
    assert.equal(layout.overflow, false);
    assert.ok(Math.abs(layout.ratio - 4 / 3) < 0.02, JSON.stringify(layout));
    assert.ok(width > 1100 ? layout.sideBySide : layout.below);
    console.log(`PASS project hero/layout at ${width}px`);
  }
  const modelFile = db.files.find((file) => file.kind === 'model');
  const modelProject = db.projects.find((item) => item.id === modelFile.projectId);
  await page.goto(`${origin}/projects/${modelProject.slug}`, { waitUntil: "networkidle" });
  const download = page.getByRole('button', { name: 'Download 3D', exact: true });
  assert.equal(await download.isDisabled(), true);
  console.log('PASS model demo disabled download');
  await page.goto(`${origin}/submit`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const draft = {
      title: 'Markdown preview', summary: 'Preview test', category: 'อิเล็กทรอนิกส์', readiness: 'showcase', cover: null,
      materials: '- [ESP32-C3](https://www.espressif.com/)',
      steps: '## ต่อวงจร\n\n![ภาพวงจร](/images/kline.svg)\n\n[คู่มือ PDF](https://example.com/guide.pdf)\n\n```cpp\ndigitalWrite(2, HIGH);\n```\n\n[unsafe](javascript:alert(1))\n\n<script>alert(1)</script>',
      references: [{ label: 'GitHub', url: 'https://github.com/espressif/esptool-js' }], guideFiles: [], compatibilityNotes: '', contact: '', license: '', firmware: false, chip: '', board: '', version: '', mode: 'merged', files: [],
    };
    localStorage.setItem('elephant-maker:submission:v1', JSON.stringify({ schema: 1, step: 2, draft }));
  });
  await page.getByRole('button', { name: 'เปิดร่างที่บันทึกไว้', exact: true }).click();
  await page.getByRole('button', { name: 'บันทึกร่างและดูตัวอย่าง', exact: true }).click();
  await page.getByRole('heading', { name: 'ต่อวงจร', exact: true }).waitFor();
  assert.equal(await page.getByRole('img', { name: 'ภาพวงจร', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'คู่มือ PDF', exact: true }).getAttribute('href'), 'https://example.com/guide.pdf');
  assert.equal(await page.locator('.project-markdown pre code').textContent(), 'digitalWrite(2, HIGH);\n');
  assert.equal(await page.locator('.project-markdown a[href^="javascript:"], .project-markdown script').count(), 0);
  assert.equal(await page.getByRole('link', { name: 'GitHub', exact: true }).count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS Markdown images/PDF/code/references and unsafe HTML/link filtering');
} finally {
  await browser.close();
}
