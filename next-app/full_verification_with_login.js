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

// Test credentials to try
const TEST_CREDENTIALS = [
  { employeeId: '1001', password: 'admin123', label: 'Admin Test 1' },
  { employeeId: '0001', password: 'admin123', label: 'Admin Test 2' },
  { employeeId: '1234', password: 'password', label: 'Test User 1' },
  { employeeId: '0000', password: 'admin', label: 'Test User 2' },
];

async function verifyPage(page, pageInfo, isLoggedIn) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${pageInfo.name}`);
  console.log(`URL: ${pageInfo.url}`);
  console.log(`Requires Auth: ${pageInfo.requiresAuth} | Logged In: ${isLoggedIn}`);
  console.log(`${'='.repeat(80)}`);

  const consoleErrors = [];
  const networkErrors = [];

  // Clear previous listeners and add new ones
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.removeAllListeners('response');

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out some expected errors when not authenticated
      if (!text.includes('401') && !text.includes('Unauthorized')) {
        consoleErrors.push(text);
        console.log(`  ❌ Console Error: ${text}`);
      }
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(error.message);
    console.log(`  💥 Page Error: ${error.message}`);
  });

  page.on('response', response => {
    // Only log real errors (not auth errors for public pages or when not logged in)
    if (response.status() >= 500) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
      console.log(`  ❌ Server Error: ${response.url()} - ${response.status()}`);
    }
  });

  try {
    await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const pageState = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        contentLength: document.body.innerText.length,
        bodyPreview: document.body.innerText.substring(0, 300),
        hasLoginForm: !!document.querySelector('input[type="password"]'),
        errorElements: Array.from(document.querySelectorAll('[role="alert"], .error, .error-message'))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0),
        authToken: localStorage.getItem('auth-token') ? 'present' : 'missing',
      };
    });

    // Take screenshot
    const screenshotName = `final_${pageInfo.name.toLowerCase().replace(/\s+/g, '_')}.png`;
    await page.screenshot({
      path: path.join('/c/job/project', screenshotName),
      fullPage: false
    });

    // Determine status
    const hasRealErrors = consoleErrors.length > 0 || networkErrors.length > 0;
    const isRedirectedToLogin = pageState.url.includes('/login') && !pageInfo.url.includes('/login');

    let status = 'PASS';
    if (hasRealErrors) {
      status = 'FAIL';
    } else if (pageInfo.requiresAuth && !isLoggedIn && isRedirectedToLogin) {
      status = 'REDIRECT'; // Expected behavior
    } else if (pageInfo.requiresAuth && !isLoggedIn) {
      status = 'NO_AUTH'; // Expected
    }

    console.log(`  📄 Title: ${pageState.title}`);
    console.log(`  🔐 Auth Token: ${pageState.authToken}`);
    console.log(`  📝 Content Length: ${pageState.contentLength} chars`);
    console.log(`  📸 Screenshot: ${screenshotName}`);
    console.log(`  🐛 Real Errors: ${consoleErrors.length}`);
    console.log(`  ⚠️  Error Elements: ${pageState.errorElements.length}`);
    console.log(`  ✅ Status: ${status}`);

    if (pageState.errorElements.length > 0) {
      console.log(`  📋 Errors on page:`);
      pageState.errorElements.forEach(msg => console.log(`     - ${msg}`));
    }

    return {
      name: pageInfo.name,
      url: pageInfo.url,
      requiresAuth: pageInfo.requiresAuth,
      isLoggedIn: isLoggedIn,
      status,
      title: pageState.title,
      finalUrl: pageState.url,
      authToken: pageState.authToken,
      contentLength: pageState.contentLength,
      consoleErrors,
      networkErrors,
      errorElements: pageState.errorElements,
      screenshot: screenshotName,
      bodyPreview: pageState.bodyPreview,
    };

  } catch (error) {
    console.log(`  💥 ERROR: ${error.message}`);
    return {
      name: pageInfo.name,
      url: pageInfo.url,
      status: 'ERROR',
      error: error.message,
    };
  }
}

async function attemptLogin(page, credentials) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`ATTEMPTING LOGIN: ${credentials.label}`);
  console.log(`Employee ID: ${credentials.employeeId}`);
  console.log(`${'='.repeat(80)}`);

  try {
    await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check if already logged in
    const hasToken = await page.evaluate(() => !!localStorage.getItem('auth-token'));
    if (hasToken) {
      console.log('  ✅ Already logged in (token found)');
      return true;
    }

    // Find form fields
    const employeeIdInput = await page.$('input[name="employeeId"]');
    const passwordInput = await page.$('input[name="password"]');
    const submitButton = await page.$('button[type="submit"]');

    if (!employeeIdInput || !passwordInput || !submitButton) {
      console.log('  ❌ Login form elements not found');
      return false;
    }

    // Fill form
    console.log('  📝 Filling login form...');
    await employeeIdInput.fill(credentials.employeeId);
    await passwordInput.fill(credentials.password);
    await page.waitForTimeout(500);

    console.log('  🖱️  Clicking submit...');

    // Wait for navigation after clicking submit
    await Promise.all([
      page.waitForNavigation({ timeout: 5000 }).catch(() => {}),
      submitButton.click()
    ]);

    await page.waitForTimeout(2000);

    // Check if logged in
    const loginSuccess = await page.evaluate(() => !!localStorage.getItem('auth-token'));
    const currentUrl = page.url();

    if (loginSuccess) {
      console.log('  ✅ Login successful!');
      console.log(`  🔗 Redirected to: ${currentUrl}`);

      // Get user info from token
      const userInfo = await page.evaluate(() => {
        const token = localStorage.getItem('auth-token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload;
          } catch (e) {
            return null;
          }
        }
        return null;
      });

      if (userInfo) {
        console.log(`  👤 User: ${userInfo.username || userInfo.employeeId} (Role: ${userInfo.role})`);
      }

      return true;
    } else {
      console.log('  ❌ Login failed (no token)');
      console.log(`  🔗 Current URL: ${currentUrl}`);

      // Check for error message
      const errorMessage = await page.evaluate(() => {
        const errorEl = document.querySelector('[role="alert"], .error, .error-message');
        return errorEl ? errorEl.textContent.trim() : null;
      });

      if (errorMessage) {
        console.log(`  📋 Error: ${errorMessage}`);
      }

      return false;
    }

  } catch (error) {
    console.log(`  💥 Login error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 COMPREHENSIVE PAGE VERIFICATION');
  console.log('=' .repeat(80));
  console.log('Testing all pages with proper authentication');
  console.log('='.repeat(80) + '\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const results = [];
  let isLoggedIn = false;

  try {
    // Phase 1: Test login page
    console.log('\n📍 PHASE 1: Testing Login Page');
    const loginResult = await verifyPage(page, PAGES[0], false);
    results.push(loginResult);

    // Phase 2: Try to login with test credentials
    console.log('\n📍 PHASE 2: Authentication Attempts');

    for (const creds of TEST_CREDENTIALS) {
      const success = await attemptLogin(page, creds);
      if (success) {
        isLoggedIn = true;
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!isLoggedIn) {
      console.log('\n⚠️  WARNING: Could not log in with any test credentials.');
      console.log('Pages will be tested without authentication.');
      console.log('Authenticated pages will likely redirect to login.');
    }

    // Phase 3: Test all other pages
    console.log('\n📍 PHASE 3: Testing All Pages');

    for (let i = 1; i < PAGES.length; i++) {
      const result = await verifyPage(page, PAGES[i], isLoggedIn);
      results.push(result);
      await page.waitForTimeout(500);
    }

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      isLoggedIn,
      totalPages: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: results.filter(r => r.status === 'FAIL').length,
      errors: results.filter(r => r.status === 'ERROR').length,
      redirected: results.filter(r => r.status === 'REDIRECT').length,
      noAuth: results.filter(r => r.status === 'NO_AUTH').length,
      results,
    };

    const reportPath = '/c/job/project/final_verification_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('VERIFICATION COMPLETE');
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Total Pages: ${report.totalPages}`);
    console.log(`✅ Passed: ${report.passed}`);
    console.log(`❌ Failed: ${report.failed}`);
    console.log(`💥 Errors: ${report.errors}`);
    console.log(`🔀 Redirected (Expected): ${report.redirected}`);
    console.log(`🔒 No Auth (Expected): ${report.noAuth}`);
    console.log(`🔐 Logged In: ${isLoggedIn ? 'Yes' : 'No'}`);
    console.log(`📄 Report: ${reportPath}`);
    console.log(`${'='.repeat(80)}`);

    console.log('\n📋 DETAILED PAGE STATUS:');
    console.log('-'.repeat(80));
    results.forEach(r => {
      const icons = {
        'PASS': '✅',
        'FAIL': '❌',
        'ERROR': '💥',
        'REDIRECT': '🔀',
        'NO_AUTH': '🔒'
      };
      const icon = icons[r.status] || '❓';
      console.log(`${icon} ${r.name.padEnd(30)} | ${r.status.padEnd(10)} | Errors: ${r.consoleErrors?.length || 0}`);
    });
    console.log('-'.repeat(80));

    // Print failed pages details
    const failedPages = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
    if (failedPages.length > 0) {
      console.log('\n📋 PAGES WITH ERRORS:');
      console.log('='.repeat(80));

      failedPages.forEach(page => {
        console.log(`\n### ${page.name}`);
        console.log(`URL: ${page.url}`);
        console.log(`Status: ${page.status}`);
        console.log(`Screenshot: ${page.screenshot}`);

        if (page.consoleErrors && page.consoleErrors.length > 0) {
          console.log(`\nConsole Errors (${page.consoleErrors.length}):`);
          page.consoleErrors.slice(0, 3).forEach((err, i) => {
            console.log(`  ${i + 1}. ${err}`);
          });
        }

        if (page.errorElements && page.errorElements.length > 0) {
          console.log(`\nError Messages on Page:`);
          page.errorElements.forEach((msg, i) => {
            console.log(`  ${i + 1}. ${msg}`);
          });
        }
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

main();
