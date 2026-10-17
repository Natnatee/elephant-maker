import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const packagePath = (process.env.PATH ?? '').split(path.delimiter).map(dir => path.resolve(dir, '../playwright/package.json')).find(existsSync);
if (!packagePath) throw new Error('Run: pnpm --package=playwright --shell-mode dlx "node tests/browser-auth.mjs"');
const { chromium } = createRequire(packagePath)('playwright');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const origin = process.env.TEST_BASE_URL || 'http://localhost:3000';
let signupCalls = 0;
let recoveryCalls = 0;
let loginCalls = 0;
let registered;
const profileRequests = [];
await page.route('**/rest/v1/profiles**', async route => {
  profileRequests.push(route.request().url());
  await route.fulfill({ status: 500, json: { message: 'No availability query allowed' } });
});
await page.route('**/auth/v1/**', async route => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/settings')) {
    await route.fulfill({ json: { external: { email: true, google: false } } });
  } else if (url.pathname.endsWith('/signup')) {
    signupCalls++;
    registered = route.request().postDataJSON();
    const redirect = new URL(url.searchParams.get('redirect_to'));
    assert.equal(redirect.origin, origin);
    assert.equal(redirect.pathname, '/auth/callback');
    assert.equal(redirect.searchParams.get('next'), '/submit');
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
    const cardStyle = await page.locator('.auth-card').evaluate(card => ({ width: card.getBoundingClientRect().width, radius: getComputedStyle(card).borderRadius, padding: getComputedStyle(card).paddingTop }));
    assert.ok(cardStyle.width <= 460);
    assert.equal(cardStyle.radius, width === 390 ? '20px' : '24px');
    assert.equal(cardStyle.padding, width === 390 ? '28px' : '36px');
    await page.screenshot({ path: `.next/auth-signup-${width}.png`, fullPage: true });
    const form = page.locator('form');
    assert.equal(await form.locator('input').count(), 3);
    assert.equal(await page.locator('input[name="username"]').count(), 0);
    assert.doesNotMatch(await page.locator('body').innerText(), /username|facebook/i);
    const google = page.getByRole('button', { name: 'ดำเนินการต่อด้วย Google', exact: true });
    assert.equal(await google.locator('svg').count(), 1);
    const colors = await google.locator('svg [fill]').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('fill').toLowerCase()).filter(fill => fill !== 'none'))].sort());
    assert.deepEqual(colors, ['#34a853', '#4285f4', '#ea4335', '#fbbc05']);
    await form.getByLabel('อีเมล', { exact: true }).fill('member@example.test');
    await form.getByLabel('รหัสผ่าน', { exact: true }).fill('Example-password-42');
    await form.getByLabel('ชื่อที่แสดง', { exact: true }).fill('   ');
    await form.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'ชื่อที่แสดงต้องยาว' }).waitFor();
    assert.equal(signupCalls, width === 1440 ? 0 : 1);
    await form.getByLabel('ชื่อที่แสดง', { exact: true }).fill('  ชื่อไทยซ้ำได้  ');
    await form.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'ตรวจสอบอีเมล' }).waitFor();
    assert.deepEqual(registered.data, { name: 'ชื่อไทยซ้ำได้' });
    assert.equal(registered.email, 'member@example.test');
    assert.equal(await form.getByLabel('ชื่อที่แสดง', { exact: true }).inputValue(), '  ชื่อไทยซ้ำได้  ');
    assert.equal(await form.getByLabel('รหัสผ่าน', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }));
    assert.equal(stored.includes('Example-password-42'), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(`PASS three-field signup, duplicate Thai name, Google SVG and no password persistence at ${width}px`);
  }
  assert.equal(signupCalls, 2);
  await page.locator('footer').getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
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
  assert.equal(await page.getByLabel('รหัสผ่าน', { exact: true }).inputValue(), '');
  await page.getByRole('button', { name: 'ดำเนินการต่อด้วย Google', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'ยังไม่เปิดใช้งาน Google' }).waitFor();
  await page.goto(`${origin}/login?error=private-provider-message`, { waitUntil: 'networkidle' });
  await page.getByRole('alert').filter({ hasText: 'เข้าสู่ระบบไม่สำเร็จหรือลิงก์หมดอายุ' }).waitFor();
  assert.doesNotMatch(await page.locator('body').innerText(), /private-provider-message|facebook|username/i);
  assert.deepEqual(profileRequests, []);
  for (const [next, expected] of [['/?legacy=1', '/?legacy=1'], ['https://evil.invalid', '/account'], ['/account/setup?next=/submit', '/account']]) {
    await page.goto(`${origin}/account/setup?next=${encodeURIComponent(next)}`, { waitUntil: 'networkidle' });
    await page.waitForURL(url => url.pathname !== '/account/setup');
    const destination = new URL(page.url());
    assert.equal(destination.origin, origin);
    if (destination.pathname === '/login') assert.equal(destination.searchParams.get('next'), expected);
    else assert.equal(destination.pathname + destination.search, expected);
    assert.equal(await page.locator('input[name="username"], input[name="name"]').count(), 0);
  }
  assert.deepEqual(errors, []);
  console.log('PASS recovery callback, sanitized errors, disabled Google and legacy setup redirects (mocked Auth; no emails sent)');
} finally {
  await browser.close();
}
