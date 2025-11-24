import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:3002',
    headless: false,
    launchOptions: {
      slowMo: 300,
    },
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer - assume it's already running
});
