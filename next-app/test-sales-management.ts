import { chromium } from 'playwright';

async function testSalesManagement() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3002/bb/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'sales-test-01-login.png', fullPage: true });
    console.log('Screenshot: sales-test-01-login.png');

    // Step 2: Fill in credentials and login
    console.log('Step 2: Logging in with credentials...');
    await page.fill('input[name="employee_number"], input[placeholder*="勤怠番号"], input[type="text"]', '0000');
    await page.fill('input[name="password"], input[type="password"]', 'admin123');
    await page.screenshot({ path: 'sales-test-02-credentials.png', fullPage: true });
    console.log('Screenshot: sales-test-02-credentials.png');

    // Click login button
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'sales-test-03-after-login.png', fullPage: true });
    console.log('Screenshot: sales-test-03-after-login.png');

    // Step 3: Navigate to sales management page
    console.log('Step 3: Navigating to sales management page...');
    await page.goto('http://localhost:3002/bb/admin/sales-management');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'sales-test-04-sales-page.png', fullPage: true });
    console.log('Screenshot: sales-test-04-sales-page.png');

    // Step 4: Change to June 2024
    console.log('Step 4: Changing to June 2024...');

    // Look for year/month selector
    const yearSelector = await page.$('select:has-text("年"), select[name*="year"]');
    const monthSelector = await page.$('select:has-text("月"), select[name*="month"]');

    if (yearSelector) {
      await yearSelector.selectOption({ value: '2024' });
      await page.waitForTimeout(500);
    } else {
      // Try to find year input or dropdown
      const yearInput = await page.$('input[placeholder*="年"], [data-testid*="year"]');
      if (yearInput) {
        await yearInput.fill('2024');
      }
    }

    if (monthSelector) {
      await monthSelector.selectOption({ value: '6' });
      await page.waitForTimeout(500);
    } else {
      // Try to find month input or dropdown
      const monthInput = await page.$('input[placeholder*="月"], [data-testid*="month"]');
      if (monthInput) {
        await monthInput.fill('6');
      }
    }

    // Alternative: Look for date picker or custom selector
    const selectors = await page.$$('select');
    console.log(`Found ${selectors.length} select elements`);

    for (let i = 0; i < selectors.length; i++) {
      const options = await selectors[i].$$('option');
      const optionTexts = await Promise.all(options.map(o => o.textContent()));
      console.log(`Select ${i}: ${optionTexts.slice(0, 5).join(', ')}...`);
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'sales-test-05-initial-view.png', fullPage: true });
    console.log('Screenshot: sales-test-05-initial-view.png');

    // Try to set year to 2024 and month to 6
    const allSelects = await page.$$('select');
    for (const select of allSelects) {
      const options = await select.$$eval('option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));

      // Check if this is a year selector (has 2024)
      const has2024 = options.some(o => o.value === '2024' || o.text?.includes('2024'));
      if (has2024) {
        await select.selectOption('2024');
        console.log('Selected year 2024');
      }

      // Check if this is a month selector (has values 1-12)
      const hasMonths = options.some(o => o.value === '6' || o.text?.includes('6月'));
      if (hasMonths && !has2024) {
        await select.selectOption('6');
        console.log('Selected month 6');
      }
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'sales-test-06-june-2024.png', fullPage: true });
    console.log('Screenshot: sales-test-06-june-2024.png');

    // Step 5: Check table headers
    console.log('Step 5: Checking table headers...');
    const headers = await page.$$eval('th, thead td', elements =>
      elements.map(el => el.textContent?.trim()).filter(Boolean)
    );
    console.log('Table headers found:', headers);

    // Step 6: Check if data is displayed
    const tableRows = await page.$$('tbody tr');
    console.log(`Found ${tableRows.length} data rows in table`);

    // Step 7: Scroll horizontally to see full table
    console.log('Step 6: Capturing full table with horizontal scroll...');
    const tableContainer = await page.$('.overflow-x-auto, [style*="overflow"], table');
    if (tableContainer) {
      await tableContainer.evaluate(el => el.scrollLeft = 0);
      await page.screenshot({ path: 'sales-test-07-table-left.png', fullPage: true });

      await tableContainer.evaluate(el => el.scrollLeft = el.scrollWidth / 2);
      await page.screenshot({ path: 'sales-test-08-table-middle.png', fullPage: true });

      await tableContainer.evaluate(el => el.scrollLeft = el.scrollWidth);
      await page.screenshot({ path: 'sales-test-09-table-right.png', fullPage: true });
    }

    // Final full page screenshot
    await page.screenshot({ path: 'sales-test-10-final.png', fullPage: true });
    console.log('Screenshot: sales-test-10-final.png');

    // Get page content for analysis
    const pageContent = await page.content();
    console.log('\n--- Page Analysis ---');

    // Check for expected headers
    const expectedHeaders = ['日', '曜', '売上目標', '対目標比', '店舗純売上', '累計', 'EDW売上', 'OHB売上', '組数', '客数', '客単価', '人件費', '人件費率', 'L売上', 'D売上', '操作'];

    for (const header of expectedHeaders) {
      const found = pageContent.includes(header);
      console.log(`Header "${header}": ${found ? 'FOUND' : 'NOT FOUND'}`);
    }

    console.log('\nTest completed successfully!');

  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ path: 'sales-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testSalesManagement();
