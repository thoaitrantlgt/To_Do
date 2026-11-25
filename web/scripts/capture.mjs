import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 1,
});
await mkdir('../docs/screenshots', { recursive: true });
await page.goto('http://localhost:8788');
await page.getByRole('heading', { name: 'Đăng nhập', exact: true }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: '../docs/screenshots/login-desktop.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: '../docs/screenshots/login-mobile.png', fullPage: true });
await page.setViewportSize({ width: 1440, height: 1024 });
await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
await page.getByLabel('Tên hiển thị').waitFor();
await page.screenshot({ path: '../docs/screenshots/register-desktop.png', fullPage: true });
await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
await page.getByLabel('Email', { exact: true }).fill('demo.a@cloudtask.local');
await page.getByLabel('Mật khẩu', { exact: true }).fill('CloudTaskDemo2026!');
await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
await page.getByRole('heading', { name: /Chào mừng/ }).waitFor();
await page.getByRole('status').filter({ hasText: 'Đang tải công việc' }).waitFor({ state: 'hidden' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: '../docs/screenshots/dashboard-desktop.png', fullPage: true });
await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
await page.getByLabel('Tiêu đề').waitFor();
await page.screenshot({ path: '../docs/screenshots/task-form-desktop.png', fullPage: true });
await page.getByRole('button', { name: 'Hủy', exact: true }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: '../docs/screenshots/dashboard-mobile.png', fullPage: true });
const geometry = await page
  .locator('img')
  .evaluateAll((images) =>
    images
      .filter((i) => i.getBoundingClientRect().width > 0)
      .map((i) => ({
        src: new URL(i.src).pathname,
        loaded: i.complete && i.naturalWidth > 0,
        width: i.getBoundingClientRect().width,
        height: i.getBoundingClientRect().height,
      })),
  );
if (geometry.some((i) => !i.loaded))
  throw new Error('Missing design assets: ' + JSON.stringify(geometry));
console.log(
  JSON.stringify(
    {
      viewport: 390,
      noOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      assets: geometry,
    },
    null,
    2,
  ),
);
await browser.close();
