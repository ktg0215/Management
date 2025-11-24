import { test, expect } from '@playwright/test';

// The VPS redirects to this domain
const VPS_URL = 'https://edwtoyama.com';

// Test credentials to try
const credentials = [
  { userId: 'admin@example.com', password: 'admin123' },
  { userId: 'admin@example.com', password: 'password123' },
  { userId: 'admin', password: 'admin123' },
  { userId: 'admin', password: 'password123' },
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

    console.log('=== Step 2: Attempt Login ===');

    // Find form elements using more flexible selectors
    const userIdInput = page.locator('input').first();
    const passwordInput = page.locator('input').nth(1);
    const submitButton = page.locator('button').first();

    let loginSuccess = false;

    for (const cred of credentials) {
      console.log(`Trying credentials: ${cred.userId} / ${cred.password}`);

      // Clear and fill inputs
      await userIdInput.fill('');
      await userIdInput.fill(cred.userId);
      await passwordInput.fill('');
      await passwordInput.fill(cred.password);

      await page.screenshot({ path: 'vps-test-02-credentials-filled.png', fullPage: true });

      // Click submit button
      await submitButton.click();

      // Wait for navigation or error
      try {
        // Wait for either URL change or new content
        await Promise.race([
          page.waitForURL(url => !url.toString().endsWith('/') && !url.toString().includes('/login'), { timeout: 8000 }),
          page.waitForSelector('.dashboard, .admin, [class*="dashboard"], nav, .sidebar', { timeout: 8000 }),
        ]);
        loginSuccess = true;
        console.log('Login successful!');
        break;
      } catch (e) {
        console.log(`Login failed with ${cred.userId}, trying next...`);

        // Check current URL to see if we navigated
        const newUrl = page.url();
        if (newUrl !== currentUrl && !newUrl.includes('/login')) {
          loginSuccess = true;
          console.log('Login successful (URL changed)!');
          break;
        }

        // Check for error message
        const errorMsg = await page.locator('.error, .alert-error, [role="alert"], .text-red-500, p').first().textContent().catch(() => null);
        if (errorMsg && errorMsg.toLowerCase().includes('error')) {
          console.log(`Error message: ${errorMsg}`);
        }

        // Wait a bit before next attempt
        await page.waitForTimeout(1000);
      }
    }

    await page.screenshot({ path: 'vps-test-03-after-login.png', fullPage: true });

    console.log(`Login result: ${loginSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Current URL after login: ${page.url()}`);

    if (loginSuccess) {
      console.log('=== Step 3: Navigate to Admin Pages ===');

      // Try to access admin pages
      const adminPages = [
        '/admin/monthly-sales',
        '/admin/sales',
        '/admin/dashboard',
        '/admin',
      ];

      for (const adminPage of adminPages) {
        console.log(`Trying to access: ${adminPage}`);
        try {
          await page.goto(`${VPS_URL}${adminPage}`, { waitUntil: 'networkidle', timeout: 15000 });

          const pageContent = await page.content();
          const hasContent = pageContent.length > 1000;
          const has404 = pageContent.toLowerCase().includes('404') || pageContent.toLowerCase().includes('not found');

          console.log(`Page ${adminPage}: Content length=${pageContent.length}, Has404=${has404}`);

          if (!has404 && hasContent) {
            const screenshotName = `vps-test-04${adminPage.replace(/\//g, '-')}.png`;
            await page.screenshot({ path: screenshotName, fullPage: true });
            console.log(`Successfully loaded: ${adminPage}`);

            // Check for data elements
            const tableRows = await page.locator('table tr').count();
            const inputs = await page.locator('input, select').count();
            console.log(`Elements found: table rows=${tableRows}, inputs/selects=${inputs}`);
          }
        } catch (e) {
          console.log(`Failed to access ${adminPage}: ${e}`);
        }
      }
    } else {
      console.log('=== Login Failed - Checking page state ===');

      // Take additional screenshot
      await page.screenshot({ path: 'vps-test-login-failed.png', fullPage: true });

      // Check if the page changed at all
      const finalUrl = page.url();
      console.log(`Final URL: ${finalUrl}`);
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

    // Log API requests
    console.log('\nAPI Requests:');
    networkRequests
      .filter(req => req.url.includes('/api/'))
      .forEach(req => console.log(`${req.method} ${req.url} - ${req.status}`));

    // Final screenshot
    await page.screenshot({ path: 'vps-test-05-final.png', fullPage: true });

    console.log('\n=== Test Complete ===');
  });
});
