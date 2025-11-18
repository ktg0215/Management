import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'https://edwtoyama.com/bb';
const LOGIN_CREDENTIALS = {
  employeeId: '0000',
  password: 'admin123'
};

interface DebugReport {
  page: string;
  status: 'success' | 'error';
  consoleErrors: string[];
  networkErrors: Array<{url: string, status: number, statusText: string}>;
  pageErrors: string[];
  screenshot?: string;
  notes: string[];
}

const report: DebugReport[] = [];

test.describe('Comprehensive Debug - Production Site', () => {
  let loggedInPage: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    loggedInPage = await context.newPage();
  });

  test('1. Login Functionality', async ({ page }) => {
    const debugInfo: DebugReport = {
      page: 'Login',
      status: 'success',
      consoleErrors: [],
      networkErrors: [],
      pageErrors: [],
      notes: []
    };

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        debugInfo.consoleErrors.push(msg.text());
      }
    });

    // Collect page errors
    page.on('pageerror', error => {
      debugInfo.pageErrors.push(error.message);
    });

    // Collect network errors
    page.on('response', response => {
      if (response.status() >= 400) {
        debugInfo.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    try {
      console.log('\n=== Testing Login ===');

      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Take screenshot of login page
      await page.screenshot({ path: 'debug-screenshots/01-login-page.png', fullPage: true });
      debugInfo.notes.push('Login page loaded');

      // Fill in credentials
      const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="勤怠番号"], input[placeholder*="Employee ID"]').first();
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

      await employeeIdInput.fill(LOGIN_CREDENTIALS.employeeId);
      await passwordInput.fill(LOGIN_CREDENTIALS.password);

      debugInfo.notes.push('Credentials entered');

      // Take screenshot before login
      await page.screenshot({ path: 'debug-screenshots/02-before-login.png', fullPage: true });

      // Click login button
      const loginButton = page.locator('button[type="submit"], button:has-text("ログイン"), button:has-text("Login")').first();
      await loginButton.click();

      debugInfo.notes.push('Login button clicked');

      // Wait for navigation
      await page.waitForURL(/\/(admin\/dashboard|dashboard)/, { timeout: 15000 });
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      debugInfo.notes.push(`Redirected to: ${currentUrl}`);

      // Take screenshot of dashboard
      await page.screenshot({ path: 'debug-screenshots/03-after-login-dashboard.png', fullPage: true });

      // Check if dashboard loaded
      const isDashboard = currentUrl.includes('/dashboard');
      if (isDashboard) {
        debugInfo.notes.push('✅ Successfully redirected to dashboard');
      } else {
        debugInfo.status = 'error';
        debugInfo.notes.push('❌ Not redirected to dashboard');
      }

    } catch (error: unknown) {
      debugInfo.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugInfo.pageErrors.push(errorMessage);
      debugInfo.notes.push(`❌ Login failed: ${errorMessage}`);
    }

    report.push(debugInfo);
    console.log(JSON.stringify(debugInfo, null, 2));
  });

  test('2. Store Management (/admin/stores)', async ({ page }) => {
    const debugInfo: DebugReport = {
      page: '/admin/stores',
      status: 'success',
      consoleErrors: [],
      networkErrors: [],
      pageErrors: [],
      notes: []
    };

    page.on('console', msg => {
      if (msg.type() === 'error') {
        debugInfo.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      debugInfo.pageErrors.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        debugInfo.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    try {
      console.log('\n=== Testing Store Management ===');

      // First login
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await page.locator('input[name="employeeId"], input[placeholder*="勤怠番号"]').first().fill(LOGIN_CREDENTIALS.employeeId);
      await page.locator('input[type="password"]').first().fill(LOGIN_CREDENTIALS.password);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);

      // Navigate to stores page
      await page.goto(`${BASE_URL}/admin/stores`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'debug-screenshots/04-stores-page.png', fullPage: true });

      // Check for store list
      const storeListExists = await page.locator('table, .store-list, [data-testid="store-list"]').count() > 0;
      debugInfo.notes.push(`Store list present: ${storeListExists}`);

      // Check for create button
      const createButtonExists = await page.locator('button:has-text("新規"), button:has-text("作成"), button:has-text("Create")').count() > 0;
      debugInfo.notes.push(`Create button present: ${createButtonExists}`);

      // Check for business type selector
      const businessTypeExists = await page.locator('select, [role="combobox"]').count() > 0;
      debugInfo.notes.push(`Business type selector present: ${businessTypeExists}`);

      if (debugInfo.consoleErrors.length > 0 || debugInfo.networkErrors.length > 0) {
        debugInfo.status = 'error';
      }

    } catch (error: unknown) {
      debugInfo.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugInfo.pageErrors.push(errorMessage);
      debugInfo.notes.push(`❌ Error: ${errorMessage}`);
    }

    report.push(debugInfo);
    console.log(JSON.stringify(debugInfo, null, 2));
  });

  test('3. Business Type Management (/admin/business-types)', async ({ page }) => {
    const debugInfo: DebugReport = {
      page: '/admin/business-types',
      status: 'success',
      consoleErrors: [],
      networkErrors: [],
      pageErrors: [],
      notes: []
    };

    page.on('console', msg => {
      if (msg.type() === 'error') {
        debugInfo.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      debugInfo.pageErrors.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        debugInfo.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    try {
      console.log('\n=== Testing Business Type Management ===');

      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await page.locator('input[name="employeeId"], input[placeholder*="勤怠番号"]').first().fill(LOGIN_CREDENTIALS.employeeId);
      await page.locator('input[type="password"]').first().fill(LOGIN_CREDENTIALS.password);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);

      await page.goto(`${BASE_URL}/admin/business-types`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'debug-screenshots/05-business-types-page.png', fullPage: true });

      const listExists = await page.locator('table, .business-type-list, ul').count() > 0;
      debugInfo.notes.push(`Business type list present: ${listExists}`);

      const createButtonExists = await page.locator('button:has-text("新規"), button:has-text("作成")').count() > 0;
      debugInfo.notes.push(`Create button present: ${createButtonExists}`);

      if (debugInfo.consoleErrors.length > 0 || debugInfo.networkErrors.length > 0) {
        debugInfo.status = 'error';
      }

    } catch (error: unknown) {
      debugInfo.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugInfo.pageErrors.push(errorMessage);
    }

    report.push(debugInfo);
    console.log(JSON.stringify(debugInfo, null, 2));
  });

  test('4. Employee Management (/admin/employees)', async ({ page }) => {
    const debugInfo: DebugReport = {
      page: '/admin/employees',
      status: 'success',
      consoleErrors: [],
      networkErrors: [],
      pageErrors: [],
      notes: []
    };

    page.on('console', msg => {
      if (msg.type() === 'error') {
        debugInfo.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      debugInfo.pageErrors.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        debugInfo.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    try {
      console.log('\n=== Testing Employee Management ===');

      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await page.locator('input[name="employeeId"], input[placeholder*="勤怠番号"]').first().fill(LOGIN_CREDENTIALS.employeeId);
      await page.locator('input[type="password"]').first().fill(LOGIN_CREDENTIALS.password);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);

      await page.goto(`${BASE_URL}/admin/employees`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'debug-screenshots/06-employees-page.png', fullPage: true });

      const employeeListExists = await page.locator('table, .employee-list').count() > 0;
      debugInfo.notes.push(`Employee list present: ${employeeListExists}`);

      const createButtonExists = await page.locator('button:has-text("新規"), button:has-text("作成"), button:has-text("追加")').count() > 0;
      debugInfo.notes.push(`Create button present: ${createButtonExists}`);

      if (debugInfo.consoleErrors.length > 0 || debugInfo.networkErrors.length > 0) {
        debugInfo.status = 'error';
      }

    } catch (error: unknown) {
      debugInfo.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugInfo.pageErrors.push(errorMessage);
    }

    report.push(debugInfo);
    console.log(JSON.stringify(debugInfo, null, 2));
  });

  test('5. Payment Management (/admin/payments)', async ({ page }) => {
    const debugInfo: DebugReport = {
      page: '/admin/payments',
      status: 'success',
      consoleErrors: [],
      networkErrors: [],
      pageErrors: [],
      notes: []
    };

    page.on('console', msg => {
      if (msg.type() === 'error') {
        debugInfo.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      debugInfo.pageErrors.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        debugInfo.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    try {
      console.log('\n=== Testing Payment Management ===');

      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await page.locator('input[name="employeeId"], input[placeholder*="勤怠番号"]').first().fill(LOGIN_CREDENTIALS.employeeId);
      await page.locator('input[type="password"]').first().fill(LOGIN_CREDENTIALS.password);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);

      await page.goto(`${BASE_URL}/admin/payments`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'debug-screenshots/07-payments-page.png', fullPage: true });

      // Check for store dropdown - THIS IS CRITICAL
      const storeDropdownExists = await page.locator('select:has(option:has-text("店舗")), select:has(option:has-text("Store")), [role="combobox"]').count() > 0;
      debugInfo.notes.push(`Store dropdown present: ${storeDropdownExists}`);
      if (!storeDropdownExists) {
        debugInfo.status = 'error';
        debugInfo.notes.push('❌ CRITICAL: Store dropdown is MISSING');
      }

      const pageContentExists = await page.locator('table, .payment-list, form').count() > 0;
      debugInfo.notes.push(`Payment content present: ${pageContentExists}`);

      if (debugInfo.consoleErrors.length > 0 || debugInfo.networkErrors.length > 0) {
        debugInfo.status = 'error';
      }

    } catch (error: unknown) {
      debugInfo.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugInfo.pageErrors.push(errorMessage);
    }

    report.push(debugInfo);
    console.log(JSON.stringify(debugInfo, null, 2));
  });

  test('6. Sales Management (/admin/sales-management)', async ({ page }) => {
    const debugInfo: DebugReport = {
      page: '/admin/sales-management',
      status: 'success',
      consoleErrors: [],
      networkErrors: [],
      pageErrors: [],
      notes: []
    };

    page.on('console', msg => {
      if (msg.type() === 'error') {
        debugInfo.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      debugInfo.pageErrors.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        debugInfo.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    try {
      console.log('\n=== Testing Sales Management ===');

      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await page.locator('input[name="employeeId"], input[placeholder*="勤怠番号"]').first().fill(LOGIN_CREDENTIALS.employeeId);
      await page.locator('input[type="password"]').first().fill(LOGIN_CREDENTIALS.password);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);

      await page.goto(`${BASE_URL}/admin/sales-management`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'debug-screenshots/08-sales-management-page.png', fullPage: true });

      const storeDropdownExists = await page.locator('select, [role="combobox"]').count() > 0;
      debugInfo.notes.push(`Store selector present: ${storeDropdownExists}`);

      const tabsExist = await page.locator('[role="tab"], .tab, button:has-text("データ入力"), button:has-text("項目設定")').count() > 0;
      debugInfo.notes.push(`Tabs present: ${tabsExist}`);

      if (debugInfo.consoleErrors.length > 0 || debugInfo.networkErrors.length > 0) {
        debugInfo.status = 'error';
      }

    } catch (error: unknown) {
      debugInfo.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugInfo.pageErrors.push(errorMessage);
    }

    report.push(debugInfo);
    console.log(JSON.stringify(debugInfo, null, 2));
  });

  test('7. All Other Admin Pages', async ({ page }) => {
    const otherPages = [
      '/admin/dashboard',
      '/admin/shifts',
      '/admin/monthly-sales',
      '/admin/yearly-progress',
      '/admin/pl-create',
      '/admin/companies',
      '/admin/add-admin'
    ];

    for (const pagePath of otherPages) {
      const debugInfo: DebugReport = {
        page: pagePath,
        status: 'success',
        consoleErrors: [],
        networkErrors: [],
        pageErrors: [],
        notes: []
      };

      page.on('console', msg => {
        if (msg.type() === 'error') {
          debugInfo.consoleErrors.push(msg.text());
        }
      });

      page.on('pageerror', error => {
        debugInfo.pageErrors.push(error.message);
      });

      page.on('response', response => {
        if (response.status() >= 400) {
          debugInfo.networkErrors.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText()
          });
        }
      });

      try {
        console.log(`\n=== Testing ${pagePath} ===`);

        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
        await page.locator('input[name="employeeId"], input[placeholder*="勤怠番号"]').first().fill(LOGIN_CREDENTIALS.employeeId);
        await page.locator('input[type="password"]').first().fill(LOGIN_CREDENTIALS.password);
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);

        await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        const fileName = pagePath.replace(/\//g, '-').substring(1) || 'home';
        await page.screenshot({ path: `debug-screenshots/09-${fileName}.png`, fullPage: true });

        debugInfo.notes.push(`Page loaded: ${page.url()}`);

        if (debugInfo.consoleErrors.length > 0 || debugInfo.networkErrors.length > 0) {
          debugInfo.status = 'error';
        }

      } catch (error: unknown) {
        debugInfo.status = 'error';
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugInfo.pageErrors.push(errorMessage);
      }

      report.push(debugInfo);
      console.log(JSON.stringify(debugInfo, null, 2));
    }
  });

  test.afterAll(async () => {
    // Generate final report
    console.log('\n\n=== COMPREHENSIVE DEBUG REPORT ===\n');

    const fs = require('fs');
    fs.writeFileSync(
      'comprehensive-debug-report.json',
      JSON.stringify(report, null, 2)
    );

    // Summary
    const successCount = report.filter(r => r.status === 'success').length;
    const errorCount = report.filter(r => r.status === 'error').length;

    console.log(`Total pages tested: ${report.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    console.log('\n--- Detailed Report ---\n');
    report.forEach(r => {
      const status = r.status === 'success' ? '✅' : '❌';
      console.log(`\n${status} ${r.page}`);

      if (r.consoleErrors.length > 0) {
        console.log('  Console Errors:');
        r.consoleErrors.forEach(e => console.log(`    - ${e}`));
      }

      if (r.networkErrors.length > 0) {
        console.log('  Network Errors:');
        r.networkErrors.forEach(e => console.log(`    - ${e.status} ${e.url}`));
      }

      if (r.pageErrors.length > 0) {
        console.log('  Page Errors:');
        r.pageErrors.forEach(e => console.log(`    - ${e}`));
      }

      if (r.notes.length > 0) {
        console.log('  Notes:');
        r.notes.forEach(n => console.log(`    - ${n}`));
      }
    });

    console.log('\n\nFull report saved to: comprehensive-debug-report.json');
  });
});
