import { test, expect } from '@playwright/test';

test.describe('Monthly Sales Page Debug', () => {
  test('Debug data loading issue', async ({ page }) => {
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
    const networkRequests: any[] = [];

    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/')) {
        let responseBody = '';
        try {
          responseBody = await response.text();
        } catch (e) {
          responseBody = 'Could not read response body';
        }
        console.log(`\n=== API Response ===`);
        console.log(`URL: ${url}`);
        console.log(`Status: ${response.status()}`);
        console.log(`Body: ${responseBody.substring(0, 1000)}`);
        console.log(`===================\n`);
      }
    });

    // Navigate to login page (note: app uses /bb base path)
    console.log('\n=== STEP 1: Navigate to login page ===');
    await page.goto('http://localhost:3002/bb/login');
    await page.waitForLoadState('networkidle');

    // Check if already logged in (redirected to dashboard)
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      // Need to login - wait for form to be ready
      console.log('\n=== STEP 2: Login with credentials ===');

      // Take screenshot to see what's on the page
      await page.screenshot({ path: 'debug-monthly-sales-00-login-page.png' });

      // Wait for the form to be visible (handles isLoading state)
      // Use id selector instead since that's what the HTML has
      const employeeInput = page.locator('#employeeId');
      await employeeInput.waitFor({ state: 'visible', timeout: 15000 });

      await employeeInput.fill('0000');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForURL('**/admin/**', { timeout: 15000 });
      console.log(`After login URL: ${page.url()}`);
    }

    // Navigate to monthly sales page
    console.log('\n=== STEP 3: Navigate to monthly sales page ===');
    await page.goto('http://localhost:3002/bb/admin/monthly-sales');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for store data to load

    console.log(`Monthly sales page URL: ${page.url()}`);

    // Take screenshot before clicking
    await page.screenshot({ path: 'debug-monthly-sales-01-before-load.png' });

    // Check if the page loaded correctly
    const pageTitle = await page.locator('h1').first().textContent();
    console.log(`Page title: ${pageTitle}`);

    // Check if stores are loaded
    const storeStore = await page.evaluate(() => {
      return window.localStorage.getItem('store-storage');
    });
    console.log(`\n=== Store Store State ===`);
    console.log(storeStore ? storeStore.substring(0, 500) : 'No store data in localStorage');

    // Check current storeData state
    const monthlyDataStorage = await page.evaluate(() => {
      return window.localStorage.getItem('monthly-sales-store-data');
    });
    console.log(`\n=== Monthly Sales Store Data ===`);
    console.log(monthlyDataStorage ? monthlyDataStorage.substring(0, 500) : 'No monthly sales data');

    // Find and click the "データ読み込み" button
    console.log('\n=== STEP 4: Click "データ読み込み" button ===');
    const loadButton = page.locator('button:has-text("データ読み込み")');
    const buttonVisible = await loadButton.isVisible();
    console.log(`Button visible: ${buttonVisible}`);

    if (buttonVisible) {
      await loadButton.click();
      console.log('Clicked "データ読み込み" button');

      // Wait for API calls to complete
      await page.waitForTimeout(3000);

      // Take screenshot after clicking
      await page.screenshot({ path: 'debug-monthly-sales-02-after-load.png' });
    } else {
      console.log('WARNING: Load button not visible!');
      await page.screenshot({ path: 'debug-monthly-sales-02-button-not-found.png' });
    }

    // Check localStorage after load
    const monthlyDataAfter = await page.evaluate(() => {
      return window.localStorage.getItem('monthly-sales-store-data');
    });
    console.log(`\n=== Monthly Sales Store Data After Load ===`);
    console.log(monthlyDataAfter ? monthlyDataAfter.substring(0, 1000) : 'No data after load');

    // Check auth token
    const authToken = await page.evaluate(() => {
      return window.localStorage.getItem('auth-token');
    });
    console.log(`\n=== Auth Token ===`);
    console.log(authToken ? `Token exists (length: ${authToken.length})` : 'NO AUTH TOKEN!');

    // Print all console errors
    console.log('\n=== CONSOLE ERRORS ===');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(err => console.log(err));
    } else {
      console.log('No console errors');
    }

    // Print all console logs
    console.log('\n=== ALL CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));

    // Print network requests to /api/monthly-sales
    console.log('\n=== Network Requests to /api/monthly-sales ===');
    const monthlySalesRequests = networkRequests.filter(r => r.url.includes('/api/monthly-sales'));
    if (monthlySalesRequests.length > 0) {
      monthlySalesRequests.forEach(req => {
        console.log(`${req.method} ${req.url} at ${req.timestamp}`);
      });
    } else {
      console.log('NO REQUESTS TO /api/monthly-sales WERE MADE!');
    }

    // Check if the table shows data
    const tableData = await page.evaluate(() => {
      const cells = document.querySelectorAll('td');
      const data: string[] = [];
      cells.forEach(cell => {
        const text = cell.textContent?.trim();
        if (text && text !== '-' && text !== '') {
          data.push(text);
        }
      });
      return data.slice(0, 20); // First 20 non-empty cells
    });
    console.log('\n=== Table Data (first 20 non-empty cells) ===');
    console.log(tableData.length > 0 ? tableData : 'NO DATA IN TABLE');

    // Final screenshot
    await page.screenshot({ path: 'debug-monthly-sales-03-final.png', fullPage: true });

    console.log('\n=== DEBUG COMPLETE ===');
  });
});
