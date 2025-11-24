import { test, expect } from '@playwright/test';

// The Next.js app is served at /bb subdirectory
const VPS_URL = 'https://edwtoyama.com/bb';
const API_URL = 'https://edwtoyama.com/bb/api';

// Test credentials based on VPS deployment guide
const credentials = [
  { employeeId: '0000', password: 'admin123' },
  { employeeId: 'admin', password: 'admin123' },
  { employeeId: 'admin@example.com', password: 'admin123' },
  { employeeId: 'admin@example.com', password: 'password123' },
];

test.describe('VPS Production Application Test - Next.js at /bb', () => {
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

    console.log('=== Step 1: Navigate to VPS Next.js App at /bb ===');
    await page.goto(VPS_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Take screenshot of initial page
    await page.screenshot({ path: 'vps-final-01-initial.png', fullPage: true });

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    console.log(`Page title: ${await page.title()}`);

    // Check if this is a Next.js app
    const content = await page.content();
    const isNextJs = content.includes('__NEXT') || content.includes('_next');
    console.log(`Is Next.js app: ${isNextJs}`);

    console.log('=== Step 2: Check Login Page ===');

    // Navigate to login if not already there
    if (!currentUrl.includes('/login')) {
      await page.goto(`${VPS_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({ path: 'vps-final-02-login-page.png', fullPage: true });
    }

    // Find form elements
    const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"], input[name="employeeId"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.locator('button[type="submit"], button:has-text("ログイン"), button:has-text("Login")').first();

    // Check if form elements exist
    const hasEmailInput = await emailInput.count() > 0;
    const hasPasswordInput = await passwordInput.count() > 0;
    const hasLoginButton = await loginButton.count() > 0;

    console.log(`Form elements found: email=${hasEmailInput}, password=${hasPasswordInput}, button=${hasLoginButton}`);

    let loginSuccess = false;

    if (hasEmailInput && hasPasswordInput && hasLoginButton) {
      console.log('=== Step 3: Attempt Login ===');

      for (const cred of credentials) {
        console.log(`Trying credentials: ${cred.employeeId} / ${cred.password}`);

        // Clear and fill inputs
        await emailInput.fill('');
        await emailInput.fill(cred.employeeId);
        await passwordInput.fill('');
        await passwordInput.fill(cred.password);

        await page.screenshot({ path: 'vps-final-03-credentials-filled.png', fullPage: true });

        // Click login button
        await loginButton.click();

        // Wait for navigation or error
        try {
          await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
          loginSuccess = true;
          console.log('Login successful!');
          break;
        } catch (e) {
          console.log(`Login failed with ${cred.employeeId}`);

          // Check for error message
          const errorMsg = await page.locator('.error, .text-red-500, [role="alert"]').textContent().catch(() => null);
          if (errorMsg) {
            console.log(`Error message: ${errorMsg}`);
          }

          // Return to login page for next attempt
          await page.goto(`${VPS_URL}/login`, { waitUntil: 'networkidle', timeout: 10000 });
          await page.waitForTimeout(500);
        }
      }

      await page.screenshot({ path: 'vps-final-04-after-login.png', fullPage: true });
    } else {
      console.log('Login form elements not found. Page may not be a Next.js login page.');
    }

    console.log(`Login result: ${loginSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Current URL after login: ${page.url()}`);

    if (loginSuccess) {
      console.log('=== Step 4: Navigate to Admin Pages ===');

      // Try to access admin pages
      const adminPages = [
        '/admin/monthly-sales',
        '/admin/sales',
        '/admin/dashboard',
        '/admin',
      ];

      for (const adminPage of adminPages) {
        const fullUrl = `${VPS_URL}${adminPage}`;
        console.log(`Trying to access: ${fullUrl}`);

        try {
          await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });

          const pageContent = await page.content();
          const hasContent = pageContent.length > 1000;
          const has404 = pageContent.toLowerCase().includes('404') || pageContent.toLowerCase().includes('not found');
          const hasData = pageContent.includes('売上') || pageContent.includes('sales') || pageContent.includes('データ');

          console.log(`Page ${adminPage}: Content=${pageContent.length}, Has404=${has404}, HasData=${hasData}`);

          if (!has404 && hasContent) {
            const screenshotName = `vps-final-05${adminPage.replace(/\//g, '-')}.png`;
            await page.screenshot({ path: screenshotName, fullPage: true });
            console.log(`Screenshot saved: ${screenshotName}`);

            // Check for data elements
            const tableRows = await page.locator('table tr').count();
            const inputs = await page.locator('input, select').count();
            console.log(`Elements found: table rows=${tableRows}, inputs/selects=${inputs}`);

            // If we found a working page, we can stop
            if (hasData) {
              break;
            }
          }
        } catch (e) {
          console.log(`Failed to access ${adminPage}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }

    console.log('\n=== Console Logs Summary ===');
    console.log(`Total console messages: ${consoleLogs.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.slice(0, 20).forEach(err => console.log(err));
    }

    console.log('\n=== Network Summary ===');
    console.log(`Total requests: ${networkRequests.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);

    if (failedRequests.length > 0) {
      console.log('\nFailed Requests:');
      failedRequests.forEach(req => console.log(`${req.method} ${req.url} - ${req.status}`));
    }

    // Log API requests
    const apiRequests = networkRequests.filter(req => req.url.includes('/api/'));
    console.log('\nAPI Requests:');
    apiRequests.forEach(req => console.log(`${req.method} ${req.url} - ${req.status}`));

    // Final screenshot
    await page.screenshot({ path: 'vps-final-06-end.png', fullPage: true });

    console.log('\n=== Test Complete ===');
  });
});
