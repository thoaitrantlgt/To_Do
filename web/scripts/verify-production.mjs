import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.env.CLOUDTASK_URL || 'https://cloudtask-neon.pages.dev';
const origin = new URL(base).origin;
if (new URL(origin).protocol !== 'https:')
  throw new Error('Production verification requires HTTPS');
const report = { url: origin, checkedAt: new Date().toISOString(), checks: [], accountsCreated: 0 };
const check = (condition, name) => {
  if (!condition) throw new Error(name);
  report.checks.push(name);
  console.log('PASS ' + name);
};
async function call(path, method = 'GET', body, cookie = '', requestOrigin = origin) {
  return fetch(origin + path, {
    method,
    headers: {
      Origin: requestOrigin,
      Cookie: cookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const cookieOf = (response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
const accounts = ['A', 'B'].map((name) => ({
  name: 'Deployment check ' + name,
  email: `verify-${randomUUID()}@example.com`,
  password: randomBytes(24).toString('base64url'),
}));
const cookies = [],
  ids = [];
let browser;
try {
  const home = await call('/');
  check(home.ok && (await home.text()).includes('CloudTask'), 'Pages serves application');
  const health = await call('/api/health');
  check(health.status === 200 && (await health.json()).ok, 'Pages → Worker → remote D1 health');
  check((await call('/api/tasks')).status === 401, 'Unauthenticated access rejected');
  for (const account of accounts) {
    const response = await call('/api/auth/sign-up/email', 'POST', account);
    if (!response.ok)
      throw new Error(`Signup HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    check(response.status === 200, 'HTTPS signup ' + account.name.at(-1));
    report.accountsCreated++;
    const setCookies = response.headers.getSetCookie();
    check(
      setCookies.some(
        (c) =>
          /session_token/.test(c) &&
          /httponly/i.test(c) &&
          /secure/i.test(c) &&
          /samesite=lax/i.test(c),
      ),
      'Secure HttpOnly SameSite cookie ' + account.name.at(-1),
    );
    cookies.push(cookieOf(response));
  }
  const created = await call(
    '/api/tasks',
    'POST',
    {
      title: 'Production verification',
      description: 'Temporary deployment smoke test',
      dueDate: '2020-01-01',
    },
    cookies[0],
  );
  check(created.status === 201, 'Create persisted task');
  const { item } = await created.json();
  ids.push(item.id);
  check(item.overdue === true, 'Vietnam calendar overdue flag');
  const own = await call('/api/tasks', 'GET', undefined, cookies[0]);
  check(
    (await own.json()).items.some((t) => t.id === item.id),
    'Read persisted task',
  );
  const foreign = await call('/api/tasks', 'GET', undefined, cookies[1]);
  check(!(await foreign.json()).items.some((t) => t.id === item.id), 'Account isolation');
  check(
    (await call('/api/tasks/' + item.id, 'PATCH', { title: 'Forbidden' }, cookies[1])).status ===
      404,
    'Cross-account update rejected',
  );
  check(
    (await call('/api/tasks/' + item.id, 'DELETE', undefined, cookies[1])).status === 404,
    'Cross-account delete rejected',
  );
  check(
    (await call('/api/tasks', 'POST', { title: 'Blocked' }, cookies[0], 'http://127.0.0.1:8788'))
      .status === 403,
    'Production rejects local Origin',
  );
  check(
    (await call('/api/tasks', 'POST', { title: '  ' }, cookies[0])).status === 400,
    'Validation rejects blank title',
  );
  const updated = await call(
    '/api/tasks/' + item.id,
    'PATCH',
    { status: 'done', description: null, dueDate: null },
    cookies[0],
  );
  const updatedData = await updated.json();
  check(
    updated.status === 200 &&
      updatedData.item.status === 'done' &&
      updatedData.item.dueDate === null,
    'Partial update and completion',
  );
  const filtered = await call('/api/tasks?status=done&due=overdue', 'GET', undefined, cookies[0]);
  check(!(await filtered.json()).items.some((t) => t.id === item.id), 'Combined filters');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  await page.goto(origin);
  await page.getByLabel('Email', { exact: true }).fill(accounts[0].email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(accounts[0].password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('heading', { name: /Chào mừng/ }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: /Chào mừng/ }).waitFor();
  check(true, 'Chrome signin and session survives reload on HTTPS');
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Production mobile 390px has no overflow',
  );
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.getByRole('heading', { name: 'Đăng nhập', exact: true }).waitFor();
  check(true, 'Chrome signout');
  check(
    (await call('/api/tasks/' + item.id, 'DELETE', undefined, cookies[0])).status === 204,
    'Delete persisted task',
  );
  ids.splice(0);
  check(
    (await call('/api/auth/sign-out', 'POST', {}, cookies[0])).status === 200,
    'Revoke API session',
  );
  check(
    (await call('/api/tasks', 'GET', undefined, cookies[0])).status === 401,
    'Signed-out session rejected',
  );
  await mkdir('../docs', { recursive: true });
  await writeFile('../docs/production-verification.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    `Verified ${report.checks.length} checks. Temporary tasks removed. Two verification accounts retained; generated passwords were not saved.`,
  );
} finally {
  if (browser) await browser.close();
  for (const id of ids)
    await call('/api/tasks/' + id, 'DELETE', undefined, cookies[0]).catch(() => {});
  for (const cookie of cookies)
    await call('/api/auth/sign-out', 'POST', {}, cookie).catch(() => {});
}
