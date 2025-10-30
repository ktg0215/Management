const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Test configuration
const CONFIG = {
    frontendUrl: 'http://localhost:3002',
    backendUrl: 'http://localhost:3001/api',
    credentials: {
        employeeId: '0000',
        password: 'toyama2023'
    },
    screenshotDir: './test-screenshots',
    timeout: 30000
};

// Pages to test
const ADMIN_PAGES = [
    { name: 'Dashboard', url: '/admin/dashboard' },
    { name: 'Sales Management', url: '/admin/sales-management' },
    { name: 'P&L Create', url: '/admin/pl-create' },
    { name: 'Yearly Progress', url: '/admin/yearly-progress' },
    { name: 'Payments', url: '/admin/payments' },
    { name: 'Stores', url: '/admin/stores' },
    { name: 'Employees', url: '/admin/employees' },
    { name: 'Shifts', url: '/admin/shifts' },
    { name: 'Companies', url: '/admin/companies' },
    { name: 'Business Types', url: '/admin/business-types' },
    { name: 'Monthly Sales', url: '/admin/monthly-sales' }
];

const EMPLOYEE_PAGES = [
    { name: 'Employee Dashboard', url: '/employee/dashboard' },
    { name: 'Employee Shifts', url: '/employee/shifts' }
];

// Test results storage
const testResults = {
    login: { status: 'pending', errors: [], logs: [] },
    adminPages: [],
    employeePages: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
    }
};

// Ensure screenshot directory exists
if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
}

// Utility functions
function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function capturePageState(page, pageName) {
    const state = {
        url: page.url(),
        title: await page.title(),
        consoleLogs: [],
        consoleErrors: [],
        networkErrors: [],
        networkRequests: [],
        cookies: [],
        localStorage: {},
        timestamp: new Date().toISOString()
    };

    try {
        // Get cookies
        state.cookies = await page.cookies();

        // Get localStorage
        state.localStorage = await page.evaluate(() => {
            const items = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                items[key] = localStorage.getItem(key);
            }
            return items;
        });
    } catch (error) {
        log(`Error capturing page state for ${pageName}: ${error.message}`, 'error');
    }

    return state;
}

async function testLoginAuthentication(browser) {
    log('=== TESTING LOGIN AUTHENTICATION ===');
    const page = await browser.newPage();

    // Set up console and network listeners
    const consoleLogs = [];
    const consoleErrors = [];
    const networkErrors = [];
    const networkRequests = [];

    page.on('console', msg => {
        const logEntry = { type: msg.type(), text: msg.text() };
        consoleLogs.push(logEntry);
        if (msg.type() === 'error' || msg.type() === 'warning') {
            consoleErrors.push(logEntry);
            log(`Console ${msg.type()}: ${msg.text()}`, msg.type());
        }
    });

    page.on('pageerror', error => {
        const errorEntry = { message: error.message, stack: error.stack };
        consoleErrors.push(errorEntry);
        log(`Page Error: ${error.message}`, 'error');
    });

    page.on('requestfailed', request => {
        const errorEntry = {
            url: request.url(),
            method: request.method(),
            failure: request.failure()
        };
        networkErrors.push(errorEntry);
        log(`Network Request Failed: ${request.url()} - ${request.failure().errorText}`, 'error');
    });

    page.on('response', response => {
        networkRequests.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
            method: response.request().method()
        });
    });

    try {
        // Navigate to login page
        log('Navigating to login page...');
        await page.goto(`${CONFIG.frontendUrl}/login`, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.timeout
        });

        // Take screenshot of login page
        const loginPageScreenshot = path.join(CONFIG.screenshotDir, '01_login_page.png');
        await page.screenshot({ path: loginPageScreenshot, fullPage: true });
        log(`Screenshot saved: ${loginPageScreenshot}`);

        // Wait for login form to be visible
        await page.waitForSelector('input[name="employeeId"], input[type="text"]', { timeout: 5000 });
        log('Login form is visible');

        // Fill in credentials
        log('Entering credentials...');
        await page.type('input[name="employeeId"], input[type="text"]', CONFIG.credentials.employeeId);
        await page.type('input[name="password"], input[type="password"]', CONFIG.credentials.password);

        // Take screenshot before login
        const beforeLoginScreenshot = path.join(CONFIG.screenshotDir, '02_before_login.png');
        await page.screenshot({ path: beforeLoginScreenshot, fullPage: true });
        log(`Screenshot saved: ${beforeLoginScreenshot}`);

        // Click login button
        log('Clicking login button...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: CONFIG.timeout }),
            page.click('button[type="submit"]')
        ]);

        // Wait a bit for everything to settle
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Capture page state after login
        const afterLoginState = await capturePageState(page, 'After Login');

        // Take screenshot after login
        const afterLoginScreenshot = path.join(CONFIG.screenshotDir, '03_after_login.png');
        await page.screenshot({ path: afterLoginScreenshot, fullPage: true });
        log(`Screenshot saved: ${afterLoginScreenshot}`);

        // Check if login was successful
        const currentUrl = page.url();
        log(`Current URL after login: ${currentUrl}`);

        // Check for JWT token in localStorage
        const hasToken = afterLoginState.localStorage.token || afterLoginState.localStorage.authToken || afterLoginState.localStorage.jwt;

        if (hasToken) {
            log('JWT token found in localStorage', 'success');
            testResults.login.status = 'success';
            testResults.login.token = 'Present (hidden for security)';
        } else {
            log('JWT token NOT found in localStorage', 'warning');
            testResults.login.warnings = ['JWT token not found in localStorage'];
        }

        // Check if redirected away from login page
        if (!currentUrl.includes('/login')) {
            log('Successfully redirected from login page', 'success');
            testResults.login.status = 'success';
        } else {
            log('Still on login page - authentication may have failed', 'error');
            testResults.login.status = 'failed';
            testResults.login.errors.push('Still on login page after attempted login');
        }

        testResults.login.consoleLogs = consoleLogs;
        testResults.login.consoleErrors = consoleErrors;
        testResults.login.networkErrors = networkErrors;
        testResults.login.networkRequests = networkRequests.filter(r => r.url.includes('/api/'));
        testResults.login.afterLoginUrl = currentUrl;
        testResults.login.localStorage = afterLoginState.localStorage;

        return page; // Return the authenticated page for further testing

    } catch (error) {
        log(`Login test failed: ${error.message}`, 'error');
        testResults.login.status = 'failed';
        testResults.login.errors.push(error.message);

        // Take error screenshot
        const errorScreenshot = path.join(CONFIG.screenshotDir, '00_login_error.png');
        await page.screenshot({ path: errorScreenshot, fullPage: true });

        return page;
    }
}

async function testPage(page, pageInfo, category) {
    const pageName = pageInfo.name;
    const pageUrl = `${CONFIG.frontendUrl}${pageInfo.url}`;

    log(`\n=== TESTING ${pageName.toUpperCase()} ===`);

    const testResult = {
        name: pageName,
        url: pageInfo.url,
        status: 'pending',
        errors: [],
        warnings: [],
        consoleLogs: [],
        consoleErrors: [],
        networkErrors: [],
        networkRequests: [],
        loadTime: 0,
        screenshot: null
    };

    const consoleLogs = [];
    const consoleErrors = [];
    const networkErrors = [];
    const networkRequests = [];

    // Clear previous listeners
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('requestfailed');
    page.removeAllListeners('response');

    // Set up new listeners
    page.on('console', msg => {
        const logEntry = { type: msg.type(), text: msg.text() };
        consoleLogs.push(logEntry);
        if (msg.type() === 'error' || msg.type() === 'warning') {
            consoleErrors.push(logEntry);
        }
    });

    page.on('pageerror', error => {
        consoleErrors.push({ type: 'error', message: error.message, stack: error.stack });
    });

    page.on('requestfailed', request => {
        networkErrors.push({
            url: request.url(),
            method: request.method(),
            failure: request.failure()
        });
    });

    page.on('response', response => {
        const req = {
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
            method: response.request().method()
        };
        networkRequests.push(req);

        // Log failed requests
        if (response.status() >= 400) {
            log(`${response.status()} ${response.request().method()} ${response.url()}`, 'warning');
        }
    });

    try {
        const startTime = Date.now();

        // Navigate to page
        log(`Navigating to ${pageUrl}...`);
        await page.goto(pageUrl, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.timeout
        });

        // Wait for page to settle
        await new Promise(resolve => setTimeout(resolve, 2000));

        const loadTime = Date.now() - startTime;
        testResult.loadTime = loadTime;
        log(`Page loaded in ${loadTime}ms`);

        // Take screenshot
        const screenshotName = `${sanitizeFilename(category)}_${sanitizeFilename(pageName)}.png`;
        const screenshotPath = path.join(CONFIG.screenshotDir, screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        testResult.screenshot = screenshotPath;
        log(`Screenshot saved: ${screenshotPath}`);

        // Capture page state
        const pageState = await capturePageState(page, pageName);

        // Analyze results
        testResult.consoleLogs = consoleLogs;
        testResult.consoleErrors = consoleErrors;
        testResult.networkErrors = networkErrors;
        testResult.networkRequests = networkRequests.filter(r => r.url.includes('/api/'));

        // Determine status
        if (networkErrors.length > 0) {
            testResult.status = 'failed';
            testResult.errors.push(`${networkErrors.length} network request(s) failed`);
            log(`${pageName}: FAILED - Network errors detected`, 'error');
        } else if (consoleErrors.filter(e => e.type === 'error').length > 0) {
            testResult.status = 'warning';
            testResult.warnings.push(`${consoleErrors.filter(e => e.type === 'error').length} console error(s) detected`);
            log(`${pageName}: WARNING - Console errors detected`, 'warning');
        } else if (consoleErrors.filter(e => e.type === 'warning').length > 0) {
            testResult.status = 'success';
            testResult.warnings.push(`${consoleErrors.filter(e => e.type === 'warning').length} console warning(s) detected`);
            log(`${pageName}: SUCCESS (with warnings)`, 'success');
        } else {
            testResult.status = 'success';
            log(`${pageName}: SUCCESS`, 'success');
        }

        // Log specific errors
        consoleErrors.forEach(error => {
            if (error.type === 'error') {
                log(`  Error: ${error.text || error.message}`, 'error');
            }
        });

        networkErrors.forEach(error => {
            log(`  Network Error: ${error.url} - ${error.failure?.errorText}`, 'error');
        });

    } catch (error) {
        log(`${pageName}: FAILED - ${error.message}`, 'error');
        testResult.status = 'failed';
        testResult.errors.push(error.message);

        // Take error screenshot
        const errorScreenshotName = `${sanitizeFilename(category)}_${sanitizeFilename(pageName)}_ERROR.png`;
        const errorScreenshotPath = path.join(CONFIG.screenshotDir, errorScreenshotName);
        try {
            await page.screenshot({ path: errorScreenshotPath, fullPage: true });
            testResult.screenshot = errorScreenshotPath;
        } catch (screenshotError) {
            log(`Failed to take error screenshot: ${screenshotError.message}`, 'error');
        }
    }

    return testResult;
}

async function testAllAdminPages(page) {
    log('\n========================================');
    log('TESTING ADMIN PAGES');
    log('========================================');

    for (const pageInfo of ADMIN_PAGES) {
        const result = await testPage(page, pageInfo, 'admin');
        testResults.adminPages.push(result);

        // Update summary
        testResults.summary.total++;
        if (result.status === 'success') {
            testResults.summary.passed++;
        } else if (result.status === 'failed') {
            testResults.summary.failed++;
        } else if (result.status === 'warning') {
            testResults.summary.warnings++;
        }

        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function testAllEmployeePages(page) {
    log('\n========================================');
    log('TESTING EMPLOYEE PAGES');
    log('========================================');

    for (const pageInfo of EMPLOYEE_PAGES) {
        const result = await testPage(page, pageInfo, 'employee');
        testResults.employeePages.push(result);

        // Update summary
        testResults.summary.total++;
        if (result.status === 'success') {
            testResults.summary.passed++;
        } else if (result.status === 'failed') {
            testResults.summary.failed++;
        } else if (result.status === 'warning') {
            testResults.summary.warnings++;
        }

        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

function generateReport() {
    log('\n========================================');
    log('TEST REPORT');
    log('========================================');

    const report = {
        timestamp: new Date().toISOString(),
        testEnvironment: {
            frontend: CONFIG.frontendUrl,
            backend: CONFIG.backendUrl,
            credentials: { employeeId: CONFIG.credentials.employeeId }
        },
        summary: testResults.summary,
        login: testResults.login,
        adminPages: testResults.adminPages,
        employeePages: testResults.employeePages
    };

    // Save JSON report
    const reportPath = path.join(CONFIG.screenshotDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Full JSON report saved: ${reportPath}`);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Pages Tested: ${testResults.summary.total}`);
    console.log(`Passed: ${testResults.summary.passed}`);
    console.log(`Failed: ${testResults.summary.failed}`);
    console.log(`Warnings: ${testResults.summary.warnings}`);
    console.log('='.repeat(60));

    // Login results
    console.log('\n' + '-'.repeat(60));
    console.log('LOGIN TEST RESULTS');
    console.log('-'.repeat(60));
    console.log(`Status: ${testResults.login.status}`);
    if (testResults.login.errors.length > 0) {
        console.log('Errors:');
        testResults.login.errors.forEach(err => console.log(`  - ${err}`));
    }
    if (testResults.login.warnings && testResults.login.warnings.length > 0) {
        console.log('Warnings:');
        testResults.login.warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    // Admin pages results
    console.log('\n' + '-'.repeat(60));
    console.log('ADMIN PAGES RESULTS');
    console.log('-'.repeat(60));
    testResults.adminPages.forEach(result => {
        const statusIcon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
        console.log(`${statusIcon} ${result.name} (${result.loadTime}ms)`);
        if (result.errors.length > 0) {
            result.errors.forEach(err => console.log(`    Error: ${err}`));
        }
        if (result.warnings.length > 0) {
            result.warnings.forEach(warn => console.log(`    Warning: ${warn}`));
        }
        if (result.consoleErrors.length > 0) {
            console.log(`    Console Errors: ${result.consoleErrors.length}`);
            result.consoleErrors.slice(0, 3).forEach(err => {
                console.log(`      - ${err.text || err.message}`);
            });
        }
    });

    // Employee pages results
    console.log('\n' + '-'.repeat(60));
    console.log('EMPLOYEE PAGES RESULTS');
    console.log('-'.repeat(60));
    testResults.employeePages.forEach(result => {
        const statusIcon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
        console.log(`${statusIcon} ${result.name} (${result.loadTime}ms)`);
        if (result.errors.length > 0) {
            result.errors.forEach(err => console.log(`    Error: ${err}`));
        }
        if (result.warnings.length > 0) {
            result.warnings.forEach(warn => console.log(`    Warning: ${warn}`));
        }
        if (result.consoleErrors.length > 0) {
            console.log(`    Console Errors: ${result.consoleErrors.length}`);
            result.consoleErrors.slice(0, 3).forEach(err => {
                console.log(`      - ${err.text || err.message}`);
            });
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Screenshots saved in: ${path.resolve(CONFIG.screenshotDir)}`);
    console.log(`Full report saved in: ${path.resolve(reportPath)}`);
    console.log('='.repeat(60) + '\n');

    return report;
}

async function runTests() {
    log('Starting comprehensive application test...');

    let browser;
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        log('Browser launched successfully');

        // Test login and get authenticated page
        const page = await testLoginAuthentication(browser);

        // Only proceed with other tests if login was successful
        if (testResults.login.status === 'success') {
            // Test admin pages
            await testAllAdminPages(page);

            // Test employee pages
            await testAllEmployeePages(page);
        } else {
            log('Skipping page tests due to login failure', 'error');
        }

        // Generate report
        const report = generateReport();

        // Close browser
        await browser.close();
        log('Browser closed');

        // Exit with appropriate code
        process.exit(testResults.summary.failed > 0 ? 1 : 0);

    } catch (error) {
        log(`Fatal error: ${error.message}`, 'error');
        console.error(error);
        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }
}

// Run the tests
runTests();
