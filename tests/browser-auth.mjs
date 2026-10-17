import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const packagePath = (process.env.PATH ?? "").split(path.delimiter).map((dir) => path.resolve(dir, "../playwright/package.json")).find(existsSync);
if (!packagePath) throw new Error('Run: pnpm --package=playwright --shell-mode dlx "node tests/browser-auth.mjs"');
const { chromium } = createRequire(packagePath)("playwright");
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
let signupCalls = 0;
let recoveryCalls = 0;
let loginCalls = 0;
let registered;
await page.route('**/rest/v1/profiles?**', async (route) => {
  const url = new URL(route.request().url());
  await route.fulfill({ json: url.searchParams.get('username') === 'eq.taken_name' ? [{ id: 'already-used' }] : [] });
});
await page.route('**/auth/v1/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/settings')) {
    await route.fulfill({ json: { external: { email: true, google: false, facebook: false } } });
  } else if (url.pathname.endsWith('/signup')) {
    signupCalls++;
    registered = route.request().postDataJSON();
    await route.fulfill({ json: { id: '11111111-1111-4111-8111-111111111111', email: 'member@example.test', aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString(), user_metadata: registered.data, app_metadata: { provider: 'email' }, identities: [] } });
  } else if (url.pathname.endsWith('/recover')) {
    recoveryCalls++;
    assert.equal(route.request().postDataJSON().email, 'member@example.test');
    const redirect = new URL(url.searchParams.get('redirect_to'));
    assert.equal(redirect.origin, origin);
    assert.equal(redirect.pathname, '/auth/callback');
    assert.equal(redirect.searchParams.get('next'), '/account/password');
    await route.fulfill({ json: {} });
  } else if (url.pathname.endsWith('/token')) {
    loginCalls++;
    await route.fulfill({ status: 400, json: { code: 'invalid_credentials', message: 'private-auth-message' } });
  } else {
    await route.fulfill({ status: 401, json: { message: 'No test session' } });
  }
});
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/login?next=/submit`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
    const form = page.locator('form');
    assert.equal(await form.locator('input').count(), 3);
    await form.getByLabel('อีเมล', { exact: true }).fill('member@example.test');
    await form.getByLabel('รหัสผ่าน', { exact: true }).fill('Example-password-42');
    await form.getByLabel('Username', { exact: true }).fill('admin');
    await form.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'สงวนไว้' }).waitFor();
    await form.getByLabel('Username', { exact: true }).fill('taken_name');
    await form.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'มีคนใช้แล้ว' }).waitFor();
    assert.equal(await form.getByLabel('รหัสผ่าน', { exact: true }).inputValue(), '');
    await form.getByLabel('รหัสผ่าน', { exact: true }).fill('Example-password-42');
    await form.getByLabel('Username', { exact: true }).fill(' Nat_Maker ');
    await form.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'ตรวจสอบอีเมล' }).waitFor();
    assert.deepEqual(registered.data, { username: 'nat_maker', name: 'nat_maker' });
    assert.equal(registered.email, 'member@example.test');
    assert.equal(await form.getByLabel('รหัสผ่าน', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }));
    assert.equal(stored.includes('Example-password-42'), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(`PASS three-field signup, validation and no password persistence at ${width}px`);
  }
  assert.equal(signupCalls, 2);
  await page.getByRole('button', { name: 'ลืมรหัสผ่าน?', exact: true }).click();
  await page.getByLabel('อีเมล', { exact: true }).fill('member@example.test');
  await page.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่าน', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'หากอีเมลนี้' }).waitFor();
  assert.equal(recoveryCalls, 1);
  await page.getByRole('button', { name: 'กลับไปเข้าสู่ระบบ', exact: true }).click();
  await page.getByLabel('อีเมล', { exact: true }).fill('member@example.test');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('Incorrect-example-password');
  await page.locator('form').getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'ทำรายการไม่สำเร็จ' }).waitFor();
  assert.equal(loginCalls, 1);
  assert.equal((await page.locator('body').textContent()).includes('private-auth-message'), false);
  await page.getByRole('button', { name: 'Google', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'ยังไม่เปิดใช้งาน Google' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS recovery callback, sanitized login failure and disabled Google messaging (mocked Auth; no emails sent)');
} finally {
  await browser.close();
}
