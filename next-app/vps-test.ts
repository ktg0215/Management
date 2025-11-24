import { chromium, Browser, Page } from 'playwright';

interface TestResult {
  step: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  screenshot?: string;
  consoleErrors?: string[];
  networkErrors?: string[];
}

async function runVPSTest() {
  const results: TestResult[] = [];
  const consoleMessages: string[] = [];
  const networkErrors: string[] = [];

  console.log('Starting VPS deployment test...\n');

  const browser: Browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page: Page = await context.newPage();

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push(`[${type.toUpperCase()}] ${text}`);
    }
  });

  // Capture network errors
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  page.on('requestfailed', request => {
    networkErrors.push(`FAILED: ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    // Step 1: Access login page
    console.log('Step 1: Accessing login page...');
    await page.goto('https://edwtoyama.com/bb/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const loginPageTitle = await page.title();
    await page.screenshot({ path: 'vps-test-01-login-page.png', fullPage: true });

    results.push({
      step: 'Access Login Page',
      status: 'pass',
      details: `Login page loaded. Title: ${loginPageTitle}`,
      screenshot: 'vps-test-01-login-page.png',
      consoleErrors: [...consoleMessages],
      networkErrors: [...networkErrors]
    });

    // Step 2: Login
    console.log('Step 2: Logging in...');
    await page.fill('input[type="email"], input[name="email"]', 'admin@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123');
    await page.screenshot({ path: 'vps-test-02-credentials-filled.png', fullPage: true });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    await page.screenshot({ path: 'vps-test-03-after-login.png', fullPage: true });

    results.push({
      step: 'Login',
      status: currentUrl.includes('login') ? 'fail' : 'pass',
      details: `After login URL: ${currentUrl}`,
      screenshot: 'vps-test-03-after-login.png',
      consoleErrors: [...consoleMessages],
      networkErrors: [...networkErrors]
    });

    // Step 3: Navigate to monthly-sales
    console.log('Step 3: Navigating to monthly-sales page...');
    await page.goto('https://edwtoyama.com/bb/admin/monthly-sales', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'vps-test-04-monthly-sales.png', fullPage: true });

    // Check store selector
    let storeInfo = '';
    try {
      const storeSelector = await page.locator('select, [role="combobox"]').first();
      if (await storeSelector.count() > 0) {
        storeInfo = await storeSelector.textContent() || 'Store selector found but no text';
      } else {
        // Try to find any element containing store name
        const storeText = await page.locator('text=/EDW|カフェ/').first().textContent();
        storeInfo = storeText || 'Store information not found in expected location';
      }
    } catch (e) {
      storeInfo = 'Store selector not found';
    }

    // Check for sales numbers
    let salesDataFound = false;
    try {
      // Look for numeric values that aren't just "-"
      const tableContent = await page.locator('table, [role="table"]').first().textContent();
      if (tableContent) {
        // Check if there are actual numbers (not just dashes)
        const hasNumbers = /\d{1,3}(,\d{3})*/.test(tableContent);
        salesDataFound = hasNumbers;
      }
    } catch (e) {
      salesDataFound = false;
    }

    // Get page content for analysis
    const pageContent = await page.content();
    const hasError = pageContent.includes('Error') || pageContent.includes('エラー');

    results.push({
      step: 'Monthly Sales Page',
      status: hasError ? 'fail' : (salesDataFound ? 'pass' : 'warning'),
      details: `Store info: ${storeInfo}. Sales data: ${salesDataFound ? 'Numbers found' : 'No numbers found (or showing "-")'}. Errors on page: ${hasError}`,
      screenshot: 'vps-test-04-monthly-sales.png',
      consoleErrors: [...consoleMessages],
      networkErrors: [...networkErrors]
    });

    // Additional check: Try to find the store dropdown and its options
    console.log('Step 3b: Checking store selector details...');
    try {
      const selectElement = await page.locator('select').first();
      if (await selectElement.count() > 0) {
        const options = await selectElement.locator('option').allTextContents();
        console.log('Store options:', options);
        results.push({
          step: 'Store Selector Check',
          status: options.length > 0 ? 'pass' : 'warning',
          details: `Store options: ${options.join(', ') || 'No options found'}`,
          consoleErrors: [],
          networkErrors: []
        });
      }
    } catch (e) {
      console.log('Could not check store selector details');
    }

    // Step 4: Navigate to yearly-progress
    console.log('Step 4: Navigating to yearly-progress page...');
    await page.goto('https://edwtoyama.com/bb/admin/yearly-progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'vps-test-05-yearly-progress.png', fullPage: true });

    // Check for P&L data
    let plDataFound = false;
    try {
      const pageText = await page.textContent('body');
      // Look for P&L related terms
      plDataFound = !!(pageText?.includes('P&L') ||
                    pageText?.includes('損益') ||
                    pageText?.includes('予算') ||
                    pageText?.includes('実績'));
    } catch (e) {
      plDataFound = false;
    }

    const yearlyPageContent = await page.content();
    const hasYearlyError = yearlyPageContent.includes('Error') || yearlyPageContent.includes('エラー');

    results.push({
      step: 'Yearly Progress (P&L) Page',
      status: hasYearlyError ? 'fail' : (plDataFound ? 'pass' : 'warning'),
      details: `P&L data found: ${plDataFound}. Errors on page: ${hasYearlyError}`,
      screenshot: 'vps-test-05-yearly-progress.png',
      consoleErrors: [...consoleMessages],
      networkErrors: [...networkErrors]
    });

    // Final summary
    console.log('\n========== TEST RESULTS ==========\n');

    for (const result of results) {
      const statusEmoji = result.status === 'pass' ? 'PASS' : result.status === 'fail' ? 'FAIL' : 'WARN';
      console.log(`[${statusEmoji}] ${result.step}`);
      console.log(`  Details: ${result.details}`);
      if (result.screenshot) {
        console.log(`  Screenshot: ${result.screenshot}`);
      }
      if (result.consoleErrors && result.consoleErrors.length > 0) {
        console.log(`  Console errors: ${result.consoleErrors.length}`);
        result.consoleErrors.forEach(err => console.log(`    - ${err}`));
      }
      if (result.networkErrors && result.networkErrors.length > 0) {
        console.log(`  Network errors: ${result.networkErrors.length}`);
        result.networkErrors.forEach(err => console.log(`    - ${err}`));
      }
      console.log('');
    }

    console.log('========== SUMMARY ==========');
    console.log(`Total steps: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.status === 'pass').length}`);
    console.log(`Failed: ${results.filter(r => r.status === 'fail').length}`);
    console.log(`Warnings: ${results.filter(r => r.status === 'warning').length}`);
    console.log(`Total console errors: ${consoleMessages.length}`);
    console.log(`Total network errors: ${networkErrors.length}`);

    if (consoleMessages.length > 0) {
      console.log('\nAll Console Messages:');
      consoleMessages.forEach(msg => console.log(`  ${msg}`));
    }

    if (networkErrors.length > 0) {
      console.log('\nAll Network Errors:');
      networkErrors.forEach(err => console.log(`  ${err}`));
    }

  } catch (error) {
    console.error('Test failed with error:', error);
    await page.screenshot({ path: 'vps-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

runVPSTest().catch(console.error);
