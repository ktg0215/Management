import { test, expect } from '@playwright/test';

test.describe('VPS Monthly Sales Page Debug', () => {
  test('Debug VPS data loading issue', async ({ page }) => {
    // Collect console logs
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // Collect network requests
    const networkRequests: any[] = [];
    const apiResponses: any[] = [];

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
        apiResponses.push({
          url,
          status: response.status(),
          body: responseBody
        });
        console.log(`\n=== API Response ===`);
        console.log(`URL: ${url}`);
        console.log(`Status: ${response.status()}`);
        console.log(`Body: ${responseBody.substring(0, 2000)}`);
        console.log(`===================\n`);
      }
    });

    // Navigate to VPS login page
    console.log('\n=== STEP 1: Navigate to VPS login page ===');
    await page.goto('https://edwtoyama.com/bb/login');
    await page.waitForLoadState('networkidle');

    // Check if already logged in
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Take screenshot of login page
    await page.screenshot({ path: 'vps-debug-01-login-page.png' });

    if (currentUrl.includes('/login')) {
      console.log('\n=== STEP 2: Login with credentials ===');

      // Wait for form
      const employeeInput = page.locator('#employeeId');
      await employeeInput.waitFor({ state: 'visible', timeout: 15000 });

      await employeeInput.fill('0000');
      await page.fill('input[name="password"]', 'admin123');

      // Screenshot before login
      await page.screenshot({ path: 'vps-debug-02-credentials-filled.png' });

      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForURL('**/admin/**', { timeout: 15000 });
      console.log(`After login URL: ${page.url()}`);

      // Screenshot after login
      await page.screenshot({ path: 'vps-debug-03-after-login.png' });
    }

    // Navigate to monthly sales page
    console.log('\n=== STEP 3: Navigate to monthly sales page ===');
    await page.goto('https://edwtoyama.com/bb/admin/monthly-sales');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for data to load

    console.log(`Monthly sales page URL: ${page.url()}`);

    // Screenshot of monthly sales page
    await page.screenshot({ path: 'vps-debug-04-monthly-sales-initial.png', fullPage: true });

    // Check page title
    const pageTitle = await page.locator('h1').first().textContent();
    console.log(`Page title: ${pageTitle}`);

    // Check if error page is displayed
    if (pageTitle?.includes('問題が発生しました')) {
      console.log('\n=== ERROR PAGE DETECTED ===');

      // Print all console errors immediately
      console.log('\n=== CONSOLE ERRORS (at error page) ===');
      if (consoleErrors.length > 0) {
        consoleErrors.forEach(err => console.log(err));
      } else {
        console.log('No console errors');
      }

      // Print all console logs for debugging
      console.log('\n=== ALL CONSOLE LOGS (at error page) ===');
      consoleLogs.forEach(log => console.log(log));

      // Print API responses
      console.log('\n=== API RESPONSES (at error page) ===');
      apiResponses.forEach(resp => {
        console.log(`URL: ${resp.url}`);
        console.log(`Status: ${resp.status}`);
        console.log(`Body: ${resp.body.substring(0, 2000)}`);
        console.log('---');
      });

      // Take final screenshot
      await page.screenshot({ path: 'vps-debug-ERROR-page.png', fullPage: true });

      console.log('\n=== DEBUG COMPLETE (ERROR STATE) ===');
      return;
    }

    // Check which store is selected
    console.log('\n=== STEP 4: Check selected store ===');
    const storeSelector = page.locator('select').first();
    const selectedStore = await storeSelector.evaluate((el: HTMLSelectElement) => {
      const option = el.options[el.selectedIndex];
      return option ? option.text : 'No store selected';
    });
    console.log(`Selected store: ${selectedStore}`);

    // Get store ID value
    const storeIdValue = await storeSelector.evaluate((el: HTMLSelectElement) => {
      return el.value;
    });
    console.log(`Store ID value: ${storeIdValue}`);

    // Check if sales badge is visible
    const salesBadge = page.locator('text=売上連携');
    const hasSalesBadge = await salesBadge.isVisible().catch(() => false);
    console.log(`Has "売上連携" badge: ${hasSalesBadge}`);

    // Check year selector
    const yearSelector = page.locator('select').nth(1);
    const selectedYear = await yearSelector.evaluate((el: HTMLSelectElement) => {
      return el.value;
    }).catch(() => 'Not found');
    console.log(`Selected year: ${selectedYear}`);

    // Wait a bit more for data to load
    await page.waitForTimeout(2000);

    // Check localStorage for store data
    console.log('\n=== STEP 5: Check localStorage ===');
    const storeStorage = await page.evaluate(() => {
      return window.localStorage.getItem('store-storage');
    });
    console.log(`Store storage: ${storeStorage ? storeStorage.substring(0, 800) : 'No store data'}`);

    const authStorage = await page.evaluate(() => {
      return window.localStorage.getItem('auth-storage');
    });
    console.log(`Auth storage: ${authStorage ? authStorage.substring(0, 500) : 'No auth data'}`);

    // Check if data is displayed in table
    console.log('\n=== STEP 6: Check table data ===');

    // Get all numeric values in the table (not "-")
    const tableNumericValues = await page.evaluate(() => {
      const cells = document.querySelectorAll('td');
      const values: string[] = [];
      cells.forEach(cell => {
        const text = cell.textContent?.trim();
        // Look for numeric values (including formatted numbers with commas)
        if (text && text !== '-' && /[\d,]+/.test(text)) {
          values.push(text);
        }
      });
      return values.slice(0, 30);
    });
    console.log(`Numeric values in table: ${tableNumericValues.length > 0 ? JSON.stringify(tableNumericValues) : 'NO NUMERIC DATA'}`);

    // Check for dash values
    const dashCount = await page.evaluate(() => {
      const cells = document.querySelectorAll('td');
      let count = 0;
      cells.forEach(cell => {
        if (cell.textContent?.trim() === '-') {
          count++;
        }
      });
      return count;
    });
    console.log(`Number of "-" cells: ${dashCount}`);

    // Take final screenshot
    await page.screenshot({ path: 'vps-debug-05-final-state.png', fullPage: true });

    // Select store ID 1 (EDW富山) if not already selected
    console.log('\n=== STEP 7: Select store ID 1 (EDW富山) ===');
    await storeSelector.selectOption('1');
    await page.waitForTimeout(3000);

    // Screenshot after selecting store 1
    await page.screenshot({ path: 'vps-debug-06-store1-selected.png', fullPage: true });

    // Check data again after selecting store 1
    const tableNumericValuesAfter = await page.evaluate(() => {
      const cells = document.querySelectorAll('td');
      const values: string[] = [];
      cells.forEach(cell => {
        const text = cell.textContent?.trim();
        if (text && text !== '-' && /[\d,]+/.test(text)) {
          values.push(text);
        }
      });
      return values.slice(0, 30);
    });
    console.log(`Numeric values after selecting store 1: ${tableNumericValuesAfter.length > 0 ? JSON.stringify(tableNumericValuesAfter) : 'NO NUMERIC DATA'}`);

    // Print API responses summary
    console.log('\n=== API RESPONSES SUMMARY ===');
    apiResponses.forEach(resp => {
      console.log(`\nURL: ${resp.url}`);
      console.log(`Status: ${resp.status}`);
      if (resp.url.includes('monthly-sales') || resp.url.includes('cumulative')) {
        console.log(`Body: ${resp.body.substring(0, 3000)}`);
      }
    });

    // Print console errors
    console.log('\n=== CONSOLE ERRORS ===');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(err => console.log(err));
    } else {
      console.log('No console errors');
    }

    // Print console warnings
    console.log('\n=== CONSOLE WARNINGS ===');
    if (consoleWarnings.length > 0) {
      consoleWarnings.forEach(warn => console.log(warn));
    } else {
      console.log('No console warnings');
    }

    // Print filtered console logs (debug info)
    console.log('\n=== DEBUG CONSOLE LOGS ===');
    const debugLogs = consoleLogs.filter(log =>
      log.includes('API Response') ||
      log.includes('売上累計') ||
      log.includes('キャッシュ') ||
      log.includes('マッチ') ||
      log.includes('netSales') ||
      log.includes('storeId') ||
      log.includes('fetchCumulativeSales')
    );
    if (debugLogs.length > 0) {
      debugLogs.forEach(log => console.log(log));
    } else {
      console.log('No relevant debug logs found');
    }

    // Print all console logs
    console.log('\n=== ALL CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));

    // Network requests to monthly-sales endpoints
    console.log('\n=== Network Requests to monthly-sales endpoints ===');
    const monthlySalesRequests = networkRequests.filter(r =>
      r.url.includes('/api/monthly-sales') ||
      r.url.includes('/api/sales')
    );
    if (monthlySalesRequests.length > 0) {
      monthlySalesRequests.forEach(req => {
        console.log(`${req.method} ${req.url}`);
      });
    } else {
      console.log('NO REQUESTS TO /api/monthly-sales WERE MADE!');
    }

    console.log('\n=== DEBUG COMPLETE ===');

    // Summary
    console.log('\n\n========== SUMMARY ==========');
    console.log(`Login: SUCCESS`);
    console.log(`Page loaded: ${pageTitle ? 'YES' : 'NO'}`);
    console.log(`Selected store: ${selectedStore}`);
    console.log(`Store ID: ${storeIdValue}`);
    console.log(`Has numeric data: ${tableNumericValuesAfter.length > 0 ? 'YES' : 'NO'}`);
    console.log(`Dash count: ${dashCount}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`API responses captured: ${apiResponses.length}`);
    console.log('==============================\n');
  });
});
