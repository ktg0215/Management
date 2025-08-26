import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4, // ローカルでは並列実行を増やす
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  outputDir: 'test-results/',
  
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'retain-on-failure', // 失敗時のトレースを保持
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: !!process.env.CI, // CI環境ではヘッドレス
    launchOptions: {
      slowMo: process.env.CI ? 0 : 500, // CI環境では高速化
    },
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
    // APIテスト用の設定
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: 'http://localhost:3001/api',
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      mode: 'strict',
      threshold: 0.2,
    },
  },

  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
});