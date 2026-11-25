import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test',
  workers: 1,
  use: { baseURL: 'http://localhost:8788', headless: true, channel: 'chrome' },
  reporter: 'list',
});
