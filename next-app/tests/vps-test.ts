import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';

interface TestResult {
  step: string;
  success: boolean;
  details: string;
  screenshot?: string;
  consoleErrors?: string[];
  networkErrors?: string[];
}

async function runVPSTest() {
  const results: TestResult[] = [];
  let browser: Browser | null = null;
  let page: Page | null = null;

  const consoleMessages: string[] = [];
  const networkErrors: string[] = [];

  try {
    console.log('Starting VPS test...\n');

    // Launch browser
    browser = await chromium.launch({
      headless: false,
      slowMo: 500
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    page = await context.newPage();

    // Collect console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || type === 'warning') {
        consoleMessages.push(`[${type.toUpperCase()}] ${text}`);
      }
    });

    // Collect network errors
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('https://edwtoyama.com/bb/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Check if page loaded properly (not stuck in loading state)
    const loginPageContent = await page.content();
    const hasLoginForm = loginPageContent.includes('email') || loginPageContent.includes('password');
    const isStuckLoading = loginPageContent.includes('loading') && !hasLoginForm;

    // Take screenshot
    await page.screenshot({ path: 'vps-test-01-login.png', fullPage: true });

    results.push({
      step: 'Login Page Load',
      success: hasLoginForm && !isStuckLoading,
      details: hasLoginForm
        ? 'Login page loaded successfully with form elements'
        : 'Login page may be stuck in loading state',
      screenshot: 'vps-test-01-login.png',
      consoleErrors: [...consoleMessages],
      networkErrors: [...networkErrors]
    });

    if (!hasLoginForm) {
      console.log('WARNING: Login form not detected, but continuing test...');
    }

    // Step 2: Fill in login credentials
    console.log('Step 2: Filling login credentials...');

    // Wait for form elements
    try {
      await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });

      // Try different selectors for email and password
      const emailSelectors = ['input[type="email"]', 'input[name="email"]', '#email'];
      const passwordSelectors = ['input[type="password"]', 'input[name="password"]', '#password'];

      for (const selector of emailSelectors) {
        if (await page.$(selector)) {
          await page.fill(selector, 'admin@example.com');
          break;
        }
      }

      for (const selector of passwordSelectors) {
        if (await page.$(selector)) {
          await page.fill(selector, 'admin123');
          break;
        }
      }

      await page.screenshot({ path: 'vps-test-02-credentials.png', fullPage: true });

      results.push({
        step: 'Fill Credentials',
        success: true,
        details: 'Credentials filled successfully',
        screenshot: 'vps-test-02-credentials.png'
      });

    } catch (e) {
      results.push({
        step: 'Fill Credentials',
        success: false,
        details: `Failed to find form elements: ${e}`
      });
    }

    // Step 3: Submit login
    console.log('Step 3: Submitting login...');

    // Clear previous messages for next step
    const loginConsoleErrors: string[] = [];
    const loginNetworkErrors: string[] = [];

    try {
      // Find and click submit button
      const buttonSelectors = [
        'button[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'input[type="submit"]'
      ];

      for (const selector of buttonSelectors) {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          break;
        }
      }

      // Wait for navigation
      await page.waitForTimeout(5000);

      await page.screenshot({ path: 'vps-test-03-after-login.png', fullPage: true });

      const afterLoginUrl = page.url();
      const loginSuccess = !afterLoginUrl.includes('/login');

      results.push({
        step: 'Login Submit',
        success: loginSuccess,
        details: loginSuccess
          ? `Login successful, redirected to: ${afterLoginUrl}`
          : 'Login may have failed, still on login page',
        screenshot: 'vps-test-03-after-login.png',
        consoleErrors: consoleMessages.slice(-10),
        networkErrors: networkErrors.slice(-10)
      });

    } catch (e) {
      results.push({
        step: 'Login Submit',
        success: false,
        details: `Login submission failed: ${e}`
      });
    }

    // Step 4: Navigate to monthly-sales page
    console.log('Step 4: Testing monthly-sales page...');

    const monthlySalesConsole: string[] = [];
    const monthlySalesNetwork: string[] = [];

    try {
      await page.goto('https://edwtoyama.com/bb/admin/monthly-sales', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'vps-test-04-monthly-sales.png', fullPage: true });

      // Check page content
      const pageContent = await page.content();
      const hasStoreSelector = pageContent.includes('select') || pageContent.includes('store');
      const hasSalesData = pageContent.includes('sales') || pageContent.includes('');

      // Get store selector content
      let storeSelectorInfo = 'Store selector not found';
      try {
        const selectElement = await page.$('select');
        if (selectElement) {
          const options = await page.$$eval('select option', opts =>
            opts.map(o => o.textContent?.trim()).filter(Boolean)
          );
          storeSelectorInfo = `Store options: ${options.join(', ')}`;
        }
      } catch (e) {
        // Ignore
      }

      results.push({
        step: 'Monthly Sales Page',
        success: true,
        details: `Page loaded. ${storeSelectorInfo}`,
        screenshot: 'vps-test-04-monthly-sales.png',
        consoleErrors: consoleMessages.slice(-10),
        networkErrors: networkErrors.slice(-10)
      });

    } catch (e) {
      results.push({
        step: 'Monthly Sales Page',
        success: false,
        details: `Failed to load monthly sales page: ${e}`,
        consoleErrors: consoleMessages.slice(-10),
        networkErrors: networkErrors.slice(-10)
      });
    }

    // Step 5: Navigate to yearly-progress page
    console.log('Step 5: Testing yearly-progress page...');

    try {
      await page.goto('https://edwtoyama.com/bb/admin/yearly-progress', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'vps-test-05-yearly-progress.png', fullPage: true });

      // Check for P&L data
      const pageContent = await page.content();
      const hasPLData = pageContent.includes('P&L') ||
                        pageContent.includes('') ||
                        pageContent.includes('');

      results.push({
        step: 'Yearly Progress Page',
        success: true,
        details: hasPLData ? 'Page loaded with P&L data' : 'Page loaded but P&L data may be missing',
        screenshot: 'vps-test-05-yearly-progress.png',
        consoleErrors: consoleMessages.slice(-10),
        networkErrors: networkErrors.slice(-10)
      });

    } catch (e) {
      results.push({
        step: 'Yearly Progress Page',
        success: false,
        details: `Failed to load yearly progress page: ${e}`,
        consoleErrors: consoleMessages.slice(-10),
        networkErrors: networkErrors.slice(-10)
      });
    }

    // Generate report
    console.log('\n========================================');
    console.log('VPS TEST REPORT');
    console.log('========================================\n');

    for (const result of results) {
      const status = result.success ? 'PASS' : 'FAIL';
      console.log(`[${status}] ${result.step}`);
      console.log(`  Details: ${result.details}`);
      if (result.screenshot) {
        console.log(`  Screenshot: ${result.screenshot}`);
      }
      if (result.consoleErrors && result.consoleErrors.length > 0) {
        console.log('  Console Errors:');
        result.consoleErrors.forEach(err => console.log(`    - ${err}`));
      }
      if (result.networkErrors && result.networkErrors.length > 0) {
        console.log('  Network Errors:');
        result.networkErrors.forEach(err => console.log(`    - ${err}`));
      }
      console.log('');
    }

    console.log('========================================');
    console.log('All Console Messages:');
    console.log('========================================');
    consoleMessages.forEach(msg => console.log(msg));

    console.log('\n========================================');
    console.log('All Network Errors:');
    console.log('========================================');
    networkErrors.forEach(err => console.log(err));

    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      results,
      allConsoleMessages: consoleMessages,
      allNetworkErrors: networkErrors
    };

    fs.writeFileSync('vps-test-report.json', JSON.stringify(report, null, 2));
    console.log('\nReport saved to vps-test-report.json');

  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runVPSTest().catch(console.error);
