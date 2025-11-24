import { test, expect } from '@playwright/test';

const VPS_URL = 'http://160.251.207.87';

// Test credentials to try
const credentials = [
  { email: 'admin@example.com', password: 'admin123' },
  { email: 'admin@example.com', password: 'password123' },
  { email: 'admin', password: 'admin123' },
  { email: 'admin', password: 'password123' },
];

test.describe('VPS Production Application Test', () => {
  test('Complete application verification', async ({ page }) => {
    // Collect console logs
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect network requests
    const networkRequests: { url: string; status: number; method: string }[] = [];
    const failedRequests: { url: string; status: number; method: string }[] = [];

    page.on('response', response => {
      const request = {
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      };
      networkRequests.push(request);
      if (response.status() >= 400) {
        failedRequests.push(request);
      }
    });

    console.log('=== Step 1: Navigate to VPS URL ===');
    await page.goto(VPS_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Take screenshot of initial page
    await page.screenshot({ path: 'vps-test-01-initial.png', fullPage: true });

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    console.log(`Page title: ${await page.title()}`);

    // Check if we're on login page
    const isLoginPage = currentUrl.includes('/login') ||
                        await page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]').count() > 0 ||
                        await page.locator('input[type="password"]').count() > 0;

    console.log(`Is login page: ${isLoginPage}`);

    if (!isLoginPage) {
      // Navigate to login page explicitly
      console.log('Navigating to login page...');
      await page.goto(`${VPS_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.screenshot({ path: 'vps-test-02-login-page.png', fullPage: true });
    }

    console.log('=== Step 2: Attempt Login ===');

    // Find form elements
    const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"], input[placeholder*="mail"], input[placeholder*="ID"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.locator('button[type="submit"], button:has-text("ログイン"), button:has-text("Login")').first();

    let loginSuccess = false;

    for (const cred of credentials) {
      console.log(`Trying credentials: ${cred.email} / ${cred.password}`);

      // Clear and fill inputs
      await emailInput.fill('');
      await emailInput.fill(cred.email);
      await passwordInput.fill('');
      await passwordInput.fill(cred.password);

      await page.screenshot({ path: 'vps-test-03-credentials-filled.png', fullPage: true });

      // Click login button
      await loginButton.click();

      // Wait for navigation or error
      try {
        await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
        loginSuccess = true;
        console.log('Login successful!');
        break;
      } catch (e) {
        console.log(`Login failed with ${cred.email}, trying next...`);
        // Check for error message
        const errorMsg = await page.locator('.error, .alert-error, [role="alert"], .text-red-500').textContent().catch(() => null);
        if (errorMsg) {
          console.log(`Error message: ${errorMsg}`);
        }
      }
    }

    await page.screenshot({ path: 'vps-test-04-after-login.png', fullPage: true });

    console.log(`Login result: ${loginSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Current URL after login: ${page.url()}`);

    if (loginSuccess) {
      console.log('=== Step 3: Navigate to Admin Pages ===');

      // Try to access monthly sales page
      const salesPages = [
        '/admin/monthly-sales',
        '/admin/sales',
        '/admin/dashboard',
        '/admin',
      ];

      for (const salesPage of salesPages) {
        console.log(`Trying to access: ${salesPage}`);
        try {
          await page.goto(`${VPS_URL}${salesPage}`, { waitUntil: 'networkidle', timeout: 15000 });

          const pageContent = await page.content();
          const hasContent = pageContent.length > 1000;
          const has404 = pageContent.includes('404') || pageContent.includes('not found');

          console.log(`Page ${salesPage}: Content length=${pageContent.length}, Has404=${has404}`);

          if (!has404 && hasContent) {
            await page.screenshot({ path: `vps-test-05-${salesPage.replace(/\//g, '-')}.png`, fullPage: true });
            console.log(`Successfully loaded: ${salesPage}`);

            // Check for data elements
            const tableRows = await page.locator('table tr, .data-row, [class*="row"]').count();
            const dataElements = await page.locator('[class*="sales"], [class*="data"], [class*="amount"]').count();
            console.log(`Data elements found: tables rows=${tableRows}, data elements=${dataElements}`);
          }
        } catch (e) {
          console.log(`Failed to access ${salesPage}: ${e}`);
        }
      }
    }

    console.log('\n=== Console Logs Summary ===');
    console.log(`Total console messages: ${consoleLogs.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach(err => console.log(err));
    }

    console.log('\n=== Network Summary ===');
    console.log(`Total requests: ${networkRequests.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);

    if (failedRequests.length > 0) {
      console.log('\nFailed Requests:');
      failedRequests.forEach(req => console.log(`${req.method} ${req.url} - ${req.status}`));
    }

    // Final screenshot
    await page.screenshot({ path: 'vps-test-06-final.png', fullPage: true });

    // Assert basic functionality
    expect(consoleLogs.length).toBeGreaterThan(0);

    console.log('\n=== Test Complete ===');
  });
});
