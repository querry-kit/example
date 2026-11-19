import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  use: {
    baseURL: process.env.WORKBOARD_TEST_APP_URL ?? 'http://127.0.0.1:3201',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
});
