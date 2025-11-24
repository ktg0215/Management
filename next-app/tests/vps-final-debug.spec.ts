import { test, expect } from '@playwright/test';

test.describe('VPS Final Debug', () => {
  test.setTimeout(120000); // 2 minute timeout

  test('Debug all three issues with extended wait', async ({ page }) => {
    // Collect console logs
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    const apiResponses: any[] = [];

    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
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
          body: responseBody.substring(0, 1000)
        });
        console.log(`API: ${response.status()} ${url}`);
      }
    });

    // STEP 1: Navigate to login page
    console.log('\n=== STEP 1: Navigate to VPS login page ===');
    await page.goto('https://edwtoyama.com/bb/login', { waitUntil: 'domcontentloaded' });

    // Take screenshot immediately
    await page.screenshot({ path: 'vps-final-01-initial.png' });

    // Wait for hydration and auth check to complete (extended wait)
    console.log('Waiting for auth check to complete...');

    // Wait up to 60 seconds for either login form or redirect
    let loginAttempted = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);

      // Check current state
      const hasLoginForm = await page.locator('#employeeId').isVisible().catch(() => false);
      const isOnAdmin = page.url().includes('/admin/');

      if (hasLoginForm) {
        console.log(`Login form appeared after ${(i + 1) * 2} seconds`);
        await page.screenshot({ path: 'vps-final-02-login-form.png' });

        // Fill login form
        await page.fill('#employeeId', '0000');
        await page.fill('input[type="password"]', 'admin123');
        await page.screenshot({ path: 'vps-final-03-credentials.png' });

        // Submit
        await page.click('button[type="submit"]');
        loginAttempted = true;

        // Wait for navigation
        await page.waitForURL('**/admin/**', { timeout: 30000 });
        console.log(`After login URL: ${page.url()}`);
        break;
      } else if (isOnAdmin) {
        console.log('Already logged in and on admin page');
        break;
      }

      console.log(`Waiting... ${(i + 1) * 2}s - Still showing loading`);
    }

    // Take screenshot after login
    await page.screenshot({ path: 'vps-final-04-after-login.png' });

    // Check if we made it to admin area
    if (!page.url().includes('/admin/')) {
      console.log('ERROR: Could not login or access admin area');
      console.log(`Current URL: ${page.url()}`);

      // Get page content
      const content = await page.content();
      console.log(`Page contains "認証状態を確認中": ${content.includes('認証状態を確認中')}`);

      // Print console errors
      console.log('\nConsole errors:');
      consoleErrors.forEach(err => console.log(err));

      // Print all console logs
      console.log('\nAll console logs:');
      consoleLogs.forEach(log => console.log(log));

      // Print API responses
      console.log('\nAPI responses:');
      apiResponses.forEach(resp => {
        console.log(`${resp.status} ${resp.url}`);
        if (resp.status !== 200) {
          console.log(`Body: ${resp.body}`);
        }
      });

      return;
    }

    // STEP 2: Test Monthly Sales Page
    console.log('\n\n=== STEP 2: Test Monthly Sales Page ===');
    await page.goto('https://edwtoyama.com/bb/admin/monthly-sales', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'vps-final-05-monthly-sales.png', fullPage: true });

    // Check for error page
    const monthlySalesTitle = await page.locator('h1').first().textContent().catch(() => '');
    console.log(`Monthly sales title: ${monthlySalesTitle}`);

    if (monthlySalesTitle?.includes('問題')) {
      console.log('ERROR: Monthly sales page has error');
      console.log('\nRecent console errors:');
      consoleErrors.slice(-10).forEach(err => console.log(err));
    } else {
      // Check store selector
      const selects = page.locator('select');
      const selectCount = await selects.count();

      if (selectCount > 0) {
        // Get selected store name
        const selectedStoreName = await selects.first().evaluate((el: HTMLSelectElement) => {
          return el.options[el.selectedIndex]?.text || 'None';
        });
        console.log(`ISSUE 1 - Selected store: "${selectedStoreName}"`);
        console.log(`  - Shows "A：A": ${selectedStoreName.includes('A：A')}`);
        console.log(`  - Shows correct format: ${selectedStoreName.includes('カフェ') || selectedStoreName.includes('EDW')}`);

        // Get all store options
        const allOptions = await selects.first().evaluate((el: HTMLSelectElement) => {
          return Array.from(el.options).map(o => o.text);
        });
        console.log(`  - All options: ${JSON.stringify(allOptions)}`);
      }

      // Check for numeric data (ISSUE 2)
      const numericValues = await page.evaluate(() => {
        const cells = document.querySelectorAll('td');
        const values: string[] = [];
        cells.forEach(cell => {
          const text = cell.textContent?.trim();
          if (text && text !== '-' && /^\d/.test(text)) {
            values.push(text);
          }
        });
        return values.slice(0, 15);
      });

      const dashCount = await page.evaluate(() => {
        const cells = document.querySelectorAll('td');
        let count = 0;
        cells.forEach(cell => {
          if (cell.textContent?.trim() === '-') count++;
        });
        return count;
      });

      console.log(`ISSUE 2 - Numeric data: ${numericValues.length > 0 ? 'YES' : 'NO'}`);
      console.log(`  - Sample values: ${JSON.stringify(numericValues.slice(0, 10))}`);
      console.log(`  - Dash count: ${dashCount}`);

      // Check for "売上連携" badge
      const hasSalesBadge = await page.locator('text=売上連携').isVisible().catch(() => false);
      console.log(`  - Has "売上連携" badge: ${hasSalesBadge}`);
    }

    // STEP 3: Test Yearly Progress (P&L) Page
    console.log('\n\n=== STEP 3: Test Yearly Progress (P&L) Page ===');
    await page.goto('https://edwtoyama.com/bb/admin/yearly-progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'vps-final-06-yearly-progress.png', fullPage: true });

    // Check for error page
    const plTitle = await page.locator('h1').first().textContent().catch(() => '');
    console.log(`P&L title: ${plTitle}`);

    if (plTitle?.includes('問題')) {
      console.log('ERROR: P&L page has error');
      console.log('\nRecent console errors:');
      consoleErrors.slice(-10).forEach(err => console.log(err));
    } else {
      // Check store selector
      const plSelects = page.locator('select');
      const plSelectCount = await plSelects.count();

      if (plSelectCount > 0) {
        const plSelectedStore = await plSelects.first().evaluate((el: HTMLSelectElement) => {
          return el.options[el.selectedIndex]?.text || 'None';
        });
        console.log(`ISSUE 3 - P&L selected store: "${plSelectedStore}"`);
      }

      // Check for table and data
      const hasTable = await page.locator('table').isVisible().catch(() => false);
      console.log(`  - Has table: ${hasTable}`);

      const rowCount = await page.locator('table tbody tr').count().catch(() => 0);
      console.log(`  - Row count: ${rowCount}`);

      // Check for "データがありません"
      const hasNoData = await page.locator('text=データがありません').isVisible().catch(() => false);
      console.log(`  - Shows "データがありません": ${hasNoData}`);

      // Check for numeric data
      const plNumericValues = await page.evaluate(() => {
        const cells = document.querySelectorAll('td');
        const values: string[] = [];
        cells.forEach(cell => {
          const text = cell.textContent?.trim();
          if (text && text !== '-' && text !== '0' && /^\d/.test(text)) {
            values.push(text);
          }
        });
        return values.slice(0, 15);
      });
      console.log(`  - Has numeric data: ${plNumericValues.length > 0 ? 'YES' : 'NO'}`);
      console.log(`  - Sample values: ${JSON.stringify(plNumericValues.slice(0, 10))}`);
    }

    // FINAL SUMMARY
    console.log('\n\n========================================');
    console.log('           FINAL SUMMARY');
    console.log('========================================');

    console.log('\nConsole errors total:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Last 5 errors:');
      consoleErrors.slice(-5).forEach(err => console.log(`  ${err}`));
    }

    console.log('\nAPI calls related to monthly-sales/cumulative:');
    const relevantAPIs = apiResponses.filter(r =>
      r.url.includes('monthly-sales') ||
      r.url.includes('cumulative') ||
      r.url.includes('pl-')
    );
    relevantAPIs.forEach(r => {
      console.log(`  ${r.status} ${r.url}`);
    });

    console.log('\n========================================');
  });
});
