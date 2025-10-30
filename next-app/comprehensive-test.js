const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3002',
  credentials: {
    employeeId: '0000',
    password: 'toyama2023'
  },
  pages: [
    { name: 'Login Page', path: '/' },
    { name: 'Admin Dashboard', path: '/admin/dashboard' },
    { name: 'Stores Management', path: '/admin/stores' },
    { name: 'Companies Management', path: '/admin/companies' },
    { name: 'Business Types', path: '/admin/business-types' },
    { name: 'Employees Management', path: '/admin/employees' },
    { name: 'Shift Management', path: '/admin/shifts' },
    { name: 'Monthly Sales', path: '/admin/monthly-sales' },
    { name: 'Yearly Progress', path: '/admin/yearly-progress' },
    { name: 'Payments Management', path: '/admin/payments' }
  ]
};

class TestReport {
  constructor() {
    this.results = [];
    this.timestamp = new Date().toISOString();
  }

  addPageResult(pageName, result) {
    this.results.push({
      page: pageName,
      ...result
    });
  }

  generateReport() {
    const reportPath = path.join(__dirname, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: this.timestamp,
      summary: this.getSummary(),
      results: this.results
    }, null, 2));
    return reportPath;
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.reduce((sum, r) => sum + (r.consoleErrors?.length || 0), 0);
    const warnings = this.results.reduce((sum, r) => sum + (r.consoleWarnings?.length || 0), 0);
    const networkFailures = this.results.reduce((sum, r) => sum + (r.networkFailures?.length || 0), 0);

    return { total, passed, failed, errors, warnings, networkFailures };
  }

  printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${this.timestamp}\n`);

    const summary = this.getSummary();
    console.log('SUMMARY:');
    console.log(`  Total Pages Tested: ${summary.total}`);
    console.log(`  Passed: ${summary.passed}`);
    console.log(`  Failed: ${summary.failed}`);
    console.log(`  Console Errors: ${summary.errors}`);
    console.log(`  Console Warnings: ${summary.warnings}`);
    console.log(`  Network Failures: ${summary.networkFailures}`);
    console.log('\n' + '-'.repeat(80) + '\n');

    this.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.page} - ${result.status}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Load Time: ${result.loadTime}ms`);

      if (result.error) {
        console.log(`   ERROR: ${result.error}`);
      }

      if (result.consoleErrors && result.consoleErrors.length > 0) {
        console.log(`   Console Errors (${result.consoleErrors.length}):`);
        result.consoleErrors.forEach((err, i) => {
          console.log(`     ${i + 1}. [${err.type}] ${err.text}`);
          if (err.location) {
            console.log(`        Location: ${err.location}`);
          }
        });
      }

      if (result.consoleWarnings && result.consoleWarnings.length > 0) {
        console.log(`   Console Warnings (${result.consoleWarnings.length}):`);
        result.consoleWarnings.slice(0, 3).forEach((warn, i) => {
          console.log(`     ${i + 1}. ${warn.text.substring(0, 100)}...`);
        });
      }

      if (result.networkFailures && result.networkFailures.length > 0) {
        console.log(`   Network Failures (${result.networkFailures.length}):`);
        result.networkFailures.forEach((failure, i) => {
          console.log(`     ${i + 1}. ${failure.method} ${failure.url}`);
          console.log(`        Status: ${failure.status || 'FAILED'}`);
          if (failure.error) {
            console.log(`        Error: ${failure.error}`);
          }
        });
      }

      if (result.domIssues && result.domIssues.length > 0) {
        console.log(`   DOM Issues: ${result.domIssues.join(', ')}`);
      }

      console.log('');
    });

    console.log('='.repeat(80) + '\n');
  }
}

async function testPage(page, pageName, url, report) {
  const startTime = Date.now();
  const consoleMessages = {
    errors: [],
    warnings: [],
    logs: []
  };
  const networkFailures = [];

  // Capture console messages
  page.on('console', msg => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    };

    if (msg.type() === 'error') {
      consoleMessages.errors.push(entry);
    } else if (msg.type() === 'warning') {
      consoleMessages.warnings.push(entry);
    } else {
      consoleMessages.logs.push(entry);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    consoleMessages.errors.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack
    });
  });

  // Capture network failures
  page.on('response', response => {
    if (response.status() >= 400) {
      networkFailures.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        method: response.request().method()
      });
    }
  });

  page.on('requestfailed', request => {
    networkFailures.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText || 'Unknown error'
    });
  });

  try {
    // Navigate to page
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;

    // Check if page loaded successfully
    if (!response || response.status() >= 400) {
      report.addPageResult(pageName, {
        status: 'FAIL',
        url,
        loadTime,
        error: `Page returned status ${response?.status()}`,
        consoleErrors: consoleMessages.errors,
        consoleWarnings: consoleMessages.warnings,
        networkFailures
      });
      return false;
    }

    // Wait a bit for JavaScript to execute
    await page.waitForTimeout(2000);

    // Check DOM structure
    const domIssues = [];
    const bodyContent = await page.textContent('body').catch(() => '');
    if (bodyContent.includes('Internal Server Error')) {
      domIssues.push('Internal Server Error detected in page content');
    }
    if (bodyContent.includes('404')) {
      domIssues.push('404 error detected in page content');
    }

    // Take screenshot
    const screenshotPath = path.join(__dirname, `screenshot-${pageName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const status = (consoleMessages.errors.length === 0 &&
                    networkFailures.length === 0 &&
                    domIssues.length === 0) ? 'PASS' : 'FAIL';

    report.addPageResult(pageName, {
      status,
      url,
      loadTime,
      consoleErrors: consoleMessages.errors,
      consoleWarnings: consoleMessages.warnings,
      networkFailures,
      domIssues,
      screenshot: screenshotPath
    });

    return status === 'PASS';

  } catch (error) {
    const loadTime = Date.now() - startTime;
    report.addPageResult(pageName, {
      status: 'FAIL',
      url,
      loadTime,
      error: error.message,
      stack: error.stack,
      consoleErrors: consoleMessages.errors,
      consoleWarnings: consoleMessages.warnings,
      networkFailures
    });
    return false;
  }
}

async function performLogin(page, baseUrl, credentials) {
  console.log('Performing login...');
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

    // Fill login form
    const employeeIdInput = await page.locator('input[name="employeeId"], input[placeholder*="社員"], input[type="text"]').first();
    const passwordInput = await page.locator('input[name="password"], input[type="password"]').first();

    if (await employeeIdInput.count() === 0 || await passwordInput.count() === 0) {
      console.log('Login form not found, checking if already logged in...');
      // Check if we're already on a logged-in page
      const currentUrl = page.url();
      if (currentUrl.includes('/admin')) {
        console.log('Already logged in!');
        return { success: true, message: 'Already authenticated' };
      }
      return { success: false, error: 'Login form not found', consoleErrors };
    }

    await employeeIdInput.fill(credentials.employeeId);
    await passwordInput.fill(credentials.password);

    // Submit form
    const submitButton = await page.locator('button[type="submit"], button:has-text("ログイン")').first();
    await submitButton.click();

    // Wait for navigation
    await page.waitForURL(/admin/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('/admin')) {
      console.log('Login successful!');
      return { success: true, consoleErrors };
    } else {
      return { success: false, error: 'Login redirect did not occur', currentUrl, consoleErrors };
    }
  } catch (error) {
    return { success: false, error: error.message, stack: error.stack, consoleErrors };
  }
}

async function main() {
  console.log('Starting comprehensive application test...\n');

  const report = new TestReport();
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Test 1: Login Page
    console.log('Testing: Login Page');
    await testPage(page, 'Login Page', TEST_CONFIG.baseUrl, report);

    // Perform login
    const loginResult = await performLogin(page, TEST_CONFIG.baseUrl, TEST_CONFIG.credentials);

    if (!loginResult.success) {
      console.log('Login failed:', loginResult.error);
      report.addPageResult('Login Process', {
        status: 'FAIL',
        url: TEST_CONFIG.baseUrl,
        error: loginResult.error,
        consoleErrors: loginResult.consoleErrors,
        currentUrl: loginResult.currentUrl
      });
    } else {
      console.log('Login successful!');
      report.addPageResult('Login Process', {
        status: 'PASS',
        url: TEST_CONFIG.baseUrl,
        consoleErrors: loginResult.consoleErrors
      });
    }

    // Test remaining pages
    for (let i = 1; i < TEST_CONFIG.pages.length; i++) {
      const pageConfig = TEST_CONFIG.pages[i];
      console.log(`\nTesting: ${pageConfig.name}`);
      const url = `${TEST_CONFIG.baseUrl}${pageConfig.path}`;
      await testPage(page, pageConfig.name, url, report);
      await page.waitForTimeout(1000); // Brief pause between tests
    }

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    // Generate and print report
    report.printReport();
    const reportPath = report.generateReport();
    console.log(`Detailed report saved to: ${reportPath}`);

    // Keep browser open for manual inspection
    console.log('\nBrowser will remain open for manual inspection.');
    console.log('Press Ctrl+C to close the browser and exit.');

    // Wait indefinitely
    await new Promise(() => {});
  }
}

main().catch(console.error);
