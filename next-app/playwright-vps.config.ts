import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/',

  use: {
    baseURL: 'https://edwtoyama.com',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    headless: true,
    actionTimeout: 30000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  expect: {
    timeout: 15000,
  },
});
