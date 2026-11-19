import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../..',
  testMatch: ['**/apps/app/test/*.spec.ts', '**/tests/e2e/*.spec.ts'],
  workers: 2,
  use: {
    baseURL: process.env.WORKBOARD_TEST_APP_URL ?? 'http://127.0.0.1:3201',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
});
