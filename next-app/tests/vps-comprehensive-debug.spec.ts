import { test, expect } from '@playwright/test';

test.describe('VPS Comprehensive Debug', () => {
  test('Debug all three issues', async ({ page }) => {
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
          body: responseBody
        });
      }
    });

    // STEP 1: Navigate to login page and wait for form
    console.log('\n=== STEP 1: Navigate to VPS login page ===');
    await page.goto('https://edwtoyama.com/bb/login', { waitUntil: 'networkidle' });

    // Take screenshot immediately
    await page.screenshot({ path: 'vps-debug-01-initial.png' });

    // Wait for loading to complete (if any)
    await page.waitForTimeout(5000);

    // Take another screenshot
    await page.screenshot({ path: 'vps-debug-02-after-wait.png' });

    // Check current state
    const pageContent = await page.content();
    console.log(`Page contains "認証状態を確認中": ${pageContent.includes('認証状態を確認中')}`);
    console.log(`Page contains "#employeeId": ${pageContent.includes('employeeId')}`);

    // Check if we're on login page with form
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Wait for either the form or for redirect
    try {
      // Wait for login form to appear (max 30 seconds)
      await page.waitForSelector('input[name="employeeId"], #employeeId, input[placeholder*="社員"]', {
        state: 'visible',
        timeout: 30000
      });
      console.log('Login form appeared');

      // Take screenshot of login form
      await page.screenshot({ path: 'vps-debug-03-login-form.png' });

      // Fill and submit login
      console.log('\n=== STEP 2: Login ===');

      // Try different selectors for employee ID input
      let employeeInput = page.locator('#employeeId');
      if (!await employeeInput.isVisible().catch(() => false)) {
        employeeInput = page.locator('input[name="employeeId"]');
      }
      if (!await employeeInput.isVisible().catch(() => false)) {
        employeeInput = page.locator('input').first();
      }

      await employeeInput.fill('0000');

      // Find password input
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('admin123');

      // Screenshot before submit
      await page.screenshot({ path: 'vps-debug-04-credentials-filled.png' });

      // Submit
      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForURL('**/admin/**', { timeout: 30000 });
      console.log(`After login URL: ${page.url()}`);

      // Screenshot after login
      await page.screenshot({ path: 'vps-debug-05-after-login.png' });

    } catch (e) {
      console.log(`Login form error: ${e}`);
      // Maybe already logged in? Check URL
      if (page.url().includes('/admin/')) {
        console.log('Already on admin page');
      } else {
        // Take debug screenshot
        await page.screenshot({ path: 'vps-debug-ERROR-login.png', fullPage: true });

        // Print page content for debugging
        const html = await page.content();
        console.log(`Page HTML (first 2000 chars): ${html.substring(0, 2000)}`);

        throw e;
      }
    }

    // STEP 3: Test Monthly Sales Page
    console.log('\n=== STEP 3: Navigate to monthly sales page ===');
    await page.goto('https://edwtoyama.com/bb/admin/monthly-sales', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'vps-debug-06-monthly-sales.png', fullPage: true });

    // Check page title
    const pageTitle = await page.locator('h1').first().textContent().catch(() => 'Not found');
    console.log(`Page title: ${pageTitle}`);

    // Check for error page
    if (pageTitle?.includes('問題が発生しました')) {
      console.log('ERROR PAGE DETECTED on monthly sales');
      await page.screenshot({ path: 'vps-debug-ERROR-monthly-sales.png', fullPage: true });

      // Print errors
      console.log('\nConsole errors:');
      consoleErrors.forEach(err => console.log(err));

      console.log('\nAPI responses:');
      apiResponses.forEach(resp => {
        console.log(`${resp.status} ${resp.url}`);
      });
    } else {
      // Check store selector
      console.log('\n=== Check store selector ===');

      // Find select elements
      const selects = page.locator('select');
      const selectCount = await selects.count();
      console.log(`Number of select elements: ${selectCount}`);

      if (selectCount > 0) {
        const storeSelector = selects.first();
        const selectedOption = await storeSelector.evaluate((el: HTMLSelectElement) => {
          const option = el.options[el.selectedIndex];
          return option ? option.text : 'No option selected';
        });
        console.log(`Selected store: ${selectedOption}`);

        // Get all options
        const allOptions = await storeSelector.evaluate((el: HTMLSelectElement) => {
          return Array.from(el.options).map(o => `${o.value}: ${o.text}`);
        });
        console.log(`All store options: ${JSON.stringify(allOptions)}`);

        // Check for correct store name format
        const hasCorrectFormat = selectedOption.includes('カフェ') || selectedOption.includes('EDW') || selectedOption.includes('店');
        console.log(`Has correct store name format: ${hasCorrectFormat}`);
        console.log(`Shows "A：A": ${selectedOption.includes('A：A')}`);
      }

      // Check numeric data in table
      console.log('\n=== Check table data ===');
      const numericValues = await page.evaluate(() => {
        const cells = document.querySelectorAll('td');
        const values: string[] = [];
        cells.forEach(cell => {
          const text = cell.textContent?.trim();
          if (text && text !== '-' && /[\d,]+/.test(text)) {
            values.push(text);
          }
        });
        return values.slice(0, 20);
      });
      console.log(`Numeric values: ${numericValues.length > 0 ? JSON.stringify(numericValues) : 'NONE'}`);

      const dashCount = await page.evaluate(() => {
        const cells = document.querySelectorAll('td');
        let count = 0;
        cells.forEach(cell => {
          if (cell.textContent?.trim() === '-') count++;
        });
        return count;
      });
      console.log(`Dash count: ${dashCount}`);

      // Check for "売上連携" badge
      const hasSalesBadge = await page.locator('text=売上連携').isVisible().catch(() => false);
      console.log(`Has "売上連携" badge: ${hasSalesBadge}`);
    }

    // STEP 4: Test Yearly Progress (P&L) Page
    console.log('\n\n=== STEP 4: Navigate to yearly progress (P&L) page ===');
    await page.goto('https://edwtoyama.com/bb/admin/yearly-progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'vps-debug-07-yearly-progress.png', fullPage: true });

    // Check page title
    const plPageTitle = await page.locator('h1').first().textContent().catch(() => 'Not found');
    console.log(`P&L Page title: ${plPageTitle}`);

    // Check for error page
    if (plPageTitle?.includes('問題が発生しました')) {
      console.log('ERROR PAGE DETECTED on yearly progress');
      await page.screenshot({ path: 'vps-debug-ERROR-yearly-progress.png', fullPage: true });
    } else {
      // Check store selector on P&L page
      console.log('\n=== Check P&L store selector ===');

      const plSelects = page.locator('select');
      const plSelectCount = await plSelects.count();
      console.log(`Number of select elements on P&L: ${plSelectCount}`);

      if (plSelectCount > 0) {
        const plStoreSelector = plSelects.first();
        const plSelectedOption = await plStoreSelector.evaluate((el: HTMLSelectElement) => {
          const option = el.options[el.selectedIndex];
          return option ? option.text : 'No option selected';
        });
        console.log(`Selected store on P&L: ${plSelectedOption}`);
      }

      // Check for P&L table data
      console.log('\n=== Check P&L table data ===');

      // Check for table
      const hasTable = await page.locator('table').isVisible().catch(() => false);
      console.log(`Has table: ${hasTable}`);

      // Check for "データがありません" message
      const hasNoDataMsg = await page.locator('text=データがありません').isVisible().catch(() => false);
      console.log(`Shows "データがありません": ${hasNoDataMsg}`);

      // Check for numeric data
      const plNumericValues = await page.evaluate(() => {
        const cells = document.querySelectorAll('td');
        const values: string[] = [];
        cells.forEach(cell => {
          const text = cell.textContent?.trim();
          if (text && text !== '-' && text !== '0' && /[\d,]+/.test(text)) {
            values.push(text);
          }
        });
        return values.slice(0, 20);
      });
      console.log(`P&L numeric values: ${plNumericValues.length > 0 ? JSON.stringify(plNumericValues) : 'NONE'}`);

      // Check row count
      const rowCount = await page.locator('table tbody tr').count().catch(() => 0);
      console.log(`Table row count: ${rowCount}`);
    }

    // SUMMARY
    console.log('\n\n========== SUMMARY ==========');
    console.log(`Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('\nErrors:');
      consoleErrors.forEach(err => console.log(err));
    }

    console.log('\nAPI responses:');
    apiResponses.forEach(resp => {
      if (resp.url.includes('monthly-sales') || resp.url.includes('cumulative') || resp.url.includes('pl-')) {
        console.log(`${resp.status} ${resp.url}`);
        if (resp.status !== 200) {
          console.log(`Response: ${resp.body.substring(0, 500)}`);
        }
      }
    });

    console.log('\n==============================');
  });
});
