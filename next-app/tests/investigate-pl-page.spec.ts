import { test, expect } from '@playwright/test';

test.describe('P&L Page Investigation on VPS', () => {
  test('Investigate store selection and API requests', async ({ page }) => {
    // Enable console log capture
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    const networkRequests: { url: string; method: string; status?: number; response?: string }[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      } else {
        consoleLogs.push(text);
        if (text.includes('store') || text.includes('pl') || text.includes('Store')) {
          console.log(`[CONSOLE] ${text}`);
        }
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Capture network requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        console.log(`[REQUEST] ${request.method()} ${url}`);
        networkRequests.push({
          url: url,
          method: request.method()
        });
      }
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/')) {
        const status = response.status();
        let responseText = '';
        try {
          responseText = await response.text();
          if (responseText.length > 500) {
            responseText = responseText.substring(0, 500) + '...';
          }
        } catch (e) {
          responseText = '[Could not read response]';
        }
        console.log(`[RESPONSE] ${status} ${url}`);
        if (status >= 400 || url.includes('/pl')) {
          console.log(`[RESPONSE BODY] ${responseText}`);
        }

        const req = networkRequests.find(r => r.url === url);
        if (req) {
          req.status = status;
          req.response = responseText;
        }
      }
    });

    // Step 1: Navigate to login page
    console.log('\n=== Step 1: Navigate to login page ===');
    await page.goto('https://edwtoyama.com/bb/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'vps-pl-01-login.png', fullPage: true });
    console.log('Screenshot saved: vps-pl-01-login.png');

    // Step 2: Login
    console.log('\n=== Step 2: Login ===');
    // Find input fields - the first is employee number, second is password
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input fields`);

    // Fill employee number (first input with placeholder "4桁の数字を入力")
    await page.locator('input').first().fill('0000');
    // Fill password (second input)
    await page.locator('input').nth(1).fill('admin123');
    await page.screenshot({ path: 'vps-pl-02-credentials.png', fullPage: true });

    // Click login button
    await page.locator('button:has-text("ログイン")').click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'vps-pl-03-after-login.png', fullPage: true });
    console.log('Login successful, screenshot saved: vps-pl-03-after-login.png');

    // Step 3: Navigate to P&L page (yearly-progress)
    console.log('\n=== Step 3: Navigate to P&L page ===');
    await page.goto('https://edwtoyama.com/bb/admin/yearly-progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'vps-pl-04-yearly-progress.png', fullPage: true });
    console.log('P&L page loaded, screenshot saved: vps-pl-04-yearly-progress.png');

    // Step 4: Analyze store dropdown
    console.log('\n=== Step 4: Analyze store dropdown ===');

    // Find store selector
    const storeSelector = await page.locator('select').first();
    if (await storeSelector.isVisible()) {
      const selectedValue = await storeSelector.inputValue();
      const selectedText = await storeSelector.locator('option:checked').textContent();
      console.log(`[STORE DROPDOWN] Selected value: ${selectedValue}`);
      console.log(`[STORE DROPDOWN] Selected text: ${selectedText}`);

      // Get all options
      const options = await storeSelector.locator('option').all();
      console.log(`[STORE DROPDOWN] Total options: ${options.length}`);
      for (const option of options) {
        const value = await option.getAttribute('value');
        const text = await option.textContent();
        console.log(`  - Option: value="${value}", text="${text}"`);
      }
    } else {
      console.log('[STORE DROPDOWN] No select element found, looking for other selectors...');

      // Try to find any dropdown or select-like element
      const dropdowns = await page.locator('[class*="select"], [class*="dropdown"], [role="combobox"]').all();
      console.log(`Found ${dropdowns.length} potential dropdown elements`);
    }

    // Step 5: Check Zustand store state
    console.log('\n=== Step 5: Check application state ===');
    const storeState = await page.evaluate(() => {
      // Try to access Zustand store
      const win = window as any;

      // Check localStorage for persisted state
      const authStore = localStorage.getItem('auth-storage');
      const storeStore = localStorage.getItem('store-storage');

      return {
        authStore: authStore ? JSON.parse(authStore) : null,
        storeStore: storeStore ? JSON.parse(storeStore) : null,
        localStorage: Object.keys(localStorage)
      };
    });

    console.log('[APP STATE] localStorage keys:', storeState.localStorage);
    if (storeState.authStore) {
      console.log('[APP STATE] Auth store:', JSON.stringify(storeState.authStore, null, 2));
    }
    if (storeState.storeStore) {
      console.log('[APP STATE] Store store:', JSON.stringify(storeState.storeStore, null, 2));
    }

    // Step 6: Look at the actual page content
    console.log('\n=== Step 6: Page content analysis ===');
    const pageText = await page.locator('body').textContent();
    if (pageText?.includes('データがありません') || pageText?.includes('No data')) {
      console.log('[PAGE CONTENT] "No data" message found on page');
    }

    // Check for any error messages
    const errorElements = await page.locator('[class*="error"], [class*="alert"], [role="alert"]').all();
    for (const el of errorElements) {
      const text = await el.textContent();
      console.log(`[ERROR ELEMENT] ${text}`);
    }

    // Step 7: Summary
    console.log('\n=== Summary ===');
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Total API requests: ${networkRequests.length}`);

    const plRequests = networkRequests.filter(r => r.url.includes('/pl'));
    console.log(`P&L API requests: ${plRequests.length}`);
    for (const req of plRequests) {
      console.log(`  - ${req.method} ${req.url} -> ${req.status}`);
    }

    // Final screenshot
    await page.screenshot({ path: 'vps-pl-05-final.png', fullPage: true });
    console.log('Final screenshot saved: vps-pl-05-final.png');

    // Don't fail the test, we're just investigating
    expect(true).toBe(true);
  });
});
