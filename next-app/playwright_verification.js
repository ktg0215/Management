const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGES = [
  { name: 'Login', url: 'http://localhost:3002/login', requiresAuth: false },
  { name: 'Register', url: 'http://localhost:3002/register', requiresAuth: false },
  { name: 'Admin Dashboard', url: 'http://localhost:3002/admin/dashboard', requiresAuth: true },
  { name: 'Sales Management', url: 'http://localhost:3002/admin/sales-management', requiresAuth: true },
  { name: 'Shifts', url: 'http://localhost:3002/admin/shifts', requiresAuth: true },
  { name: 'Employees', url: 'http://localhost:3002/admin/employees', requiresAuth: true },
  { name: 'Stores', url: 'http://localhost:3002/admin/stores', requiresAuth: true },
  { name: 'Companies', url: 'http://localhost:3002/admin/companies', requiresAuth: true },
  { name: 'Business Types', url: 'http://localhost:3002/admin/business-types', requiresAuth: true },
  { name: 'Payments', url: 'http://localhost:3002/admin/payments', requiresAuth: true },
  { name: 'Monthly Sales', url: 'http://localhost:3002/admin/monthly-sales', requiresAuth: true },
  { name: 'Yearly Progress', url: 'http://localhost:3002/admin/yearly-progress', requiresAuth: true },
  { name: 'P&L Create', url: 'http://localhost:3002/admin/pl-create', requiresAuth: true },
  { name: 'Employee Dashboard', url: 'http://localhost:3002/employee/employee-dashboard', requiresAuth: true },
  { name: 'Employee Shifts', url: 'http://localhost:3002/employee/employee-shifts', requiresAuth: true },
];

async function verifyPage(page, pageInfo) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${pageInfo.name}`);
  console.log(`URL: ${pageInfo.url}`);
  console.log(`${'='.repeat(80)}`);

  const consoleMessages = [];
  const networkErrors = [];

  // Listen to console
  page.on('console', msg => {
    const text = msg.text();
    const level = msg.type();

    consoleMessages.push({ level, text });

    if (level === 'error') {
      console.log(`  ❌ Console Error: ${text}`);
    }
  });

  // Listen to page errors
  page.on('pageerror', error => {
    console.log(`  💥 Page Error: ${error.message}`);
    consoleMessages.push({ level: 'error', text: error.message });
  });

  // Listen to failed requests
  page.on('requestfailed', request => {
    const failure = request.failure();
    console.log(`  ❌ Request Failed: ${request.method()} ${request.url()} - ${failure ? failure.errorText : 'unknown'}`);
    networkErrors.push({
      url: request.url(),
      method: request.method(),
      error: failure ? failure.errorText : 'unknown',
    });
  });

  // Listen to responses
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`  ❌ HTTP Error: ${response.request().method()} ${response.url()} - ${response.status()}`);
      networkErrors.push({
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  });

  try {
    // Navigate to page
    const response = await page.goto(pageInfo.url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to fully render
    await page.waitForTimeout(3000);

    // Get page information
    const pageState = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasLoginForm: !!document.querySelector('input[type="password"]'),
        hasContent: document.body.innerText.length > 100,
        bodyTextLength: document.body.innerText.length,
        bodyPreview: document.body.innerText.substring(0, 500),
        errorElements: Array.from(document.querySelectorAll('[role="alert"], .error, .error-message'))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0),
        authToken: localStorage.getItem('auth-token') ? 'present' : 'missing',
      };
    });

    // Take screenshot
    const screenshotName = `pw_verify_${pageInfo.name.toLowerCase().replace(/\s+/g, '_')}.png`;
    await page.screenshot({
      path: path.join('/c/job/project', screenshotName),
      fullPage: false
    });

    // Determine status
    const errors = consoleMessages.filter(m => m.level === 'error');
    const status = errors.length === 0 && networkErrors.length === 0 ? 'PASS' : 'FAIL';

    console.log(`  📄 Title: ${pageState.title}`);
    console.log(`  🔐 Auth Token: ${pageState.authToken}`);
    console.log(`  📝 Content Length: ${pageState.bodyTextLength} chars`);
    console.log(`  📋 Has Login Form: ${pageState.hasLoginForm}`);
    console.log(`  ⚠️  Error Elements: ${pageState.errorElements.length}`);
    console.log(`  📸 Screenshot: ${screenshotName}`);
    console.log(`  🐛 Console Errors: ${errors.length}`);
    console.log(`  🌐 Network Errors: ${networkErrors.length}`);
    console.log(`  ✅ Status: ${status}`);

    if (pageState.errorElements.length > 0) {
      console.log(`  📋 Error Messages:`);
      pageState.errorElements.forEach((msg, i) => {
        console.log(`     ${i + 1}. ${msg}`);
      });
    }

    return {
      name: pageInfo.name,
      url: pageInfo.url,
      requiresAuth: pageInfo.requiresAuth,
      status,
      title: pageState.title,
      authToken: pageState.authToken,
      hasContent: pageState.hasContent,
      contentLength: pageState.bodyTextLength,
      hasLoginForm: pageState.hasLoginForm,
      consoleErrors: errors,
      networkErrors,
      errorElements: pageState.errorElements,
      screenshot: screenshotName,
      bodyPreview: pageState.bodyPreview,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.log(`  💥 ERROR: ${error.message}`);
    return {
      name: pageInfo.name,
      url: pageInfo.url,
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

async function attemptLogin(page) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('ATTEMPTING LOGIN');
  console.log(`${'='.repeat(80)}`);

  try {
    await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check if already logged in
    const hasToken = await page.evaluate(() => {
      return !!localStorage.getItem('auth-token');
    });

    if (hasToken) {
      console.log('  ✅ Already logged in (token found)');
      return true;
    }

    // Try to find login form
    const usernameInput = await page.$('input[name="username"], input[placeholder*="ユーザー"], input[placeholder*="username"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"]');

    if (!usernameInput || !passwordInput || !submitButton) {
      console.log('  ❌ Login form not found');
      console.log(`     Username input: ${!!usernameInput}`);
      console.log(`     Password input: ${!!passwordInput}`);
      console.log(`     Submit button: ${!!submitButton}`);
      return false;
    }

    // Fill form
    console.log('  📝 Filling login form...');
    await usernameInput.fill('admin');
    await passwordInput.fill('admin123');

    console.log('  🖱️  Clicking submit button...');
    await submitButton.click();

    // Wait for navigation or response
    await page.waitForTimeout(3000);

    // Check if logged in
    const loginSuccess = await page.evaluate(() => {
      return !!localStorage.getItem('auth-token');
    });

    const currentUrl = page.url();

    if (loginSuccess) {
      console.log('  ✅ Login successful!');
      console.log(`  🔗 Current URL: ${currentUrl}`);
      return true;
    } else {
      console.log('  ❌ Login failed (no token found)');
      console.log(`  🔗 Current URL: ${currentUrl}`);

      // Check for error messages
      const errorMessage = await page.evaluate(() => {
        const errorEl = document.querySelector('[role="alert"], .error, .error-message');
        return errorEl ? errorEl.textContent.trim() : null;
      });

      if (errorMessage) {
        console.log(`  📋 Error message: ${errorMessage}`);
      }

      return false;
    }

  } catch (error) {
    console.log(`  💥 Login error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Starting Playwright Page Verification');
  console.log('==========================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  const results = [];

  try {
    // Test login page first
    console.log('\n📍 PHASE 1: Testing Login Page');
    const loginResult = await verifyPage(page, PAGES[0]);
    results.push(loginResult);

    // Attempt login
    console.log('\n📍 PHASE 2: Authentication');
    const isLoggedIn = await attemptLogin(page);

    // Test remaining pages
    if (isLoggedIn) {
      console.log('\n📍 PHASE 3: Testing Authenticated Pages');

      for (let i = 1; i < PAGES.length; i++) {
        const result = await verifyPage(page, PAGES[i]);
        results.push(result);
        await page.waitForTimeout(500);
      }
    } else {
      console.log('\n⚠️  Login failed. Testing a few pages without auth (expect failures)');

      // Test first few pages to see what happens
      for (let i = 1; i < Math.min(5, PAGES.length); i++) {
        const result = await verifyPage(page, PAGES[i]);
        results.push(result);
        await page.waitForTimeout(500);
      }
    }

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      isLoggedIn,
      totalPages: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: results.filter(r => r.status === 'FAIL').length,
      errors: results.filter(r => r.status === 'ERROR').length,
      results,
    };

    const reportPath = '/c/job/project/playwright_verification_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('VERIFICATION COMPLETE');
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Total Pages Tested: ${report.totalPages}`);
    console.log(`✅ Passed: ${report.passed}`);
    console.log(`❌ Failed: ${report.failed}`);
    console.log(`💥 Errors: ${report.errors}`);
    console.log(`🔐 Logged In: ${isLoggedIn ? 'Yes' : 'No'}`);
    console.log(`📄 Report: ${reportPath}`);
    console.log(`${'='.repeat(80)}`);

    console.log('\n📋 Page Status Summary:');
    console.log('-'.repeat(80));
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '💥';
      const errCount = r.consoleErrors ? r.consoleErrors.length : 0;
      const netCount = r.networkErrors ? r.networkErrors.length : 0;
      console.log(`${icon} ${r.name.padEnd(30)} | Console: ${errCount} | Network: ${netCount}`);
    });
    console.log('-'.repeat(80));

    // Print detailed errors
    const failedPages = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
    if (failedPages.length > 0) {
      console.log('\n📋 DETAILED ERROR REPORT:');
      console.log('='.repeat(80));

      failedPages.forEach(page => {
        console.log(`\n### ${page.name}`);
        console.log(`URL: ${page.url}`);
        console.log(`Status: ${page.status}`);

        if (page.consoleErrors && page.consoleErrors.length > 0) {
          console.log(`\nConsole Errors (${page.consoleErrors.length}):`);
          page.consoleErrors.slice(0, 5).forEach((err, i) => {
            console.log(`  ${i + 1}. ${err.text}`);
          });
        }

        if (page.networkErrors && page.networkErrors.length > 0) {
          console.log(`\nNetwork Errors (${page.networkErrors.length}):`);
          page.networkErrors.slice(0, 5).forEach((err, i) => {
            console.log(`  ${i + 1}. ${err.method} ${err.url}`);
            console.log(`     ${err.status ? `Status: ${err.status}` : `Error: ${err.error}`}`);
          });
        }

        if (page.errorElements && page.errorElements.length > 0) {
          console.log(`\nError Elements on Page:`);
          page.errorElements.forEach((msg, i) => {
            console.log(`  ${i + 1}. ${msg}`);
          });
        }

        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

main();
