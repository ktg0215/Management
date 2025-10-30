const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Pages to test
const pagesToTest = [
  // Auth pages
  { category: 'Auth', path: '/login', name: 'Login Page', requiresAuth: false },
  { category: 'Auth', path: '/register', name: 'Registration Page', requiresAuth: false },

  // Admin pages
  { category: 'Admin', path: '/admin/dashboard', name: 'Admin Dashboard', requiresAuth: true },
  { category: 'Admin', path: '/admin/sales-management', name: 'Sales Management', requiresAuth: true },
  { category: 'Admin', path: '/admin/pl-create', name: 'P&L Creation', requiresAuth: true },
  { category: 'Admin', path: '/admin/yearly-progress', name: 'Yearly Progress', requiresAuth: true },
  { category: 'Admin', path: '/admin/payments', name: 'Payments Management', requiresAuth: true },
  { category: 'Admin', path: '/admin/stores', name: 'Store Management', requiresAuth: true },
  { category: 'Admin', path: '/admin/employees', name: 'Employee Management', requiresAuth: true },
  { category: 'Admin', path: '/admin/shifts', name: 'Shift Management (Admin)', requiresAuth: true },
  { category: 'Admin', path: '/admin/companies', name: 'Company Management', requiresAuth: true },
  { category: 'Admin', path: '/admin/business-types', name: 'Business Types Management', requiresAuth: true },
  { category: 'Admin', path: '/admin/monthly-sales', name: 'Monthly Sales', requiresAuth: true },

  // Employee pages
  { category: 'Employee', path: '/employee/dashboard', name: 'Employee Dashboard', requiresAuth: true },
  { category: 'Employee', path: '/employee/shifts', name: 'Shift Submission/History', requiresAuth: true }
];

const credentials = {
  employeeId: '0000',
  password: 'toyama2023'
};

const baseUrl = 'http://localhost:3002';
const resultsDir = path.join('C:', 'job', 'project', 'debug-results');

// Create results directory
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

class PageDebugger {
  constructor() {
    this.browser = null;
    this.authCookies = null;
  }

  async initialize() {
    console.log('🚀 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
  }

  async login() {
    console.log('\n🔑 Performing login...');
    const page = await this.browser.newPage();
    const errors = this.setupErrorCapture(page);

    try {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for login form
      await page.waitForSelector('input[name="employeeId"], input[id="employeeId"]', { timeout: 10000 });

      // Fill login form
      await page.type('input[name="employeeId"], input[id="employeeId"]', credentials.employeeId);
      await page.type('input[name="password"], input[id="password"], input[type="password"]', credentials.password);

      // Click login button and wait for navigation
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.click('button[type="submit"]')
      ]);

      // Save cookies
      this.authCookies = await page.cookies();
      console.log('✅ Login successful');
      console.log(`   Saved ${this.authCookies.length} cookies`);

    } catch (error) {
      console.error('❌ Login failed:', error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  setupErrorCapture(page) {
    const errors = {
      console: [],
      network: [],
      javascript: [],
      pageErrors: []
    };

    // Capture console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      // Capture errors and warnings
      if (type === 'error' || type === 'warning') {
        errors.console.push({
          type,
          text,
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Capture page errors (JavaScript runtime errors)
    page.on('pageerror', error => {
      errors.pageErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Capture failed requests
    page.on('requestfailed', request => {
      errors.network.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText || 'Unknown error',
        timestamp: new Date().toISOString()
      });
    });

    // Capture response errors (4xx, 5xx)
    page.on('response', response => {
      const status = response.status();
      if (status >= 400) {
        errors.network.push({
          url: response.url(),
          method: response.request().method(),
          status,
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        });
      }
    });

    return errors;
  }

  async testPage(pageInfo) {
    const page = await this.browser.newPage();
    const errors = this.setupErrorCapture(page);
    const startTime = Date.now();

    try {
      console.log(`\n📄 Testing: ${pageInfo.name}`);
      console.log(`   Path: ${pageInfo.path}`);

      // Set cookies if authentication is required
      if (pageInfo.requiresAuth && this.authCookies) {
        await page.setCookie(...this.authCookies);
      }

      // Navigate to page
      const response = await page.goto(`${baseUrl}${pageInfo.path}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const loadTime = Date.now() - startTime;
      const status = response.status();

      console.log(`   Status: ${status}`);
      console.log(`   Load time: ${loadTime}ms`);

      // Wait a bit for any async operations
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get page title and URL
      const title = await page.title();
      const currentUrl = page.url();

      // Take screenshot
      const screenshotFilename = `${pageInfo.path.replace(/\//g, '_').substring(1)}.png`;
      const screenshotPath = path.join(resultsDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Check for specific error indicators in the page
      const pageContent = await page.content();
      const hasHydrationError = pageContent.includes('Hydration failed') ||
                               pageContent.includes('hydration error') ||
                               pageContent.includes('Minified React error');

      // Get performance metrics
      const metrics = await page.metrics();

      // Count total errors
      const totalErrors = errors.console.filter(e => e.type === 'error').length +
                         errors.pageErrors.length +
                         errors.network.filter(e => e.failure || e.status >= 400).length;

      const totalWarnings = errors.console.filter(e => e.type === 'warning').length;

      const healthStatus = totalErrors === 0 ? 'HEALTHY' :
                          totalErrors <= 2 ? 'WARNING' : 'ERROR';

      console.log(`   Errors: ${totalErrors}`);
      console.log(`   Warnings: ${totalWarnings}`);
      console.log(`   Health: ${healthStatus}`);

      return {
        category: pageInfo.category,
        path: pageInfo.path,
        name: pageInfo.name,
        status,
        title,
        currentUrl,
        loadTime,
        screenshot: screenshotFilename,
        errors: {
          console: errors.console,
          network: errors.network,
          pageErrors: errors.pageErrors,
          totalErrors,
          totalWarnings
        },
        hasHydrationError,
        metrics: {
          Timestamp: metrics.Timestamp,
          Documents: metrics.Documents,
          Frames: metrics.Frames,
          JSEventListeners: metrics.JSEventListeners,
          Nodes: metrics.Nodes,
          LayoutCount: metrics.LayoutCount,
          RecalcStyleCount: metrics.RecalcStyleCount,
          JSHeapUsedSize: Math.round(metrics.JSHeapUsedSize / 1024 / 1024) + ' MB',
          JSHeapTotalSize: Math.round(metrics.JSHeapTotalSize / 1024 / 1024) + ' MB'
        },
        healthStatus,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      return {
        category: pageInfo.category,
        path: pageInfo.path,
        name: pageInfo.name,
        status: 'ERROR',
        error: error.message,
        errors,
        healthStatus: 'ERROR',
        timestamp: new Date().toISOString()
      };
    } finally {
      await page.close();
    }
  }

  async generateReport(results) {
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.healthStatus === 'HEALTHY').length,
      warning: results.filter(r => r.healthStatus === 'WARNING').length,
      error: results.filter(r => r.healthStatus === 'ERROR').length
    };

    const report = {
      timestamp: new Date().toISOString(),
      summary,
      byCategory: {
        Auth: results.filter(r => r.category === 'Auth'),
        Admin: results.filter(r => r.category === 'Admin'),
        Employee: results.filter(r => r.category === 'Employee')
      },
      pages: results
    };

    // Save JSON report
    const jsonPath = path.join(resultsDir, 'debug-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Generate detailed text report
    let textReport = '='.repeat(100) + '\n';
    textReport += 'MANAGEMENT SYSTEM - COMPREHENSIVE BROWSER DEBUGGING REPORT\n';
    textReport += '='.repeat(100) + '\n\n';
    textReport += `Test Date: ${new Date().toLocaleString()}\n`;
    textReport += `Frontend URL: ${baseUrl}\n`;
    textReport += `Total Pages Tested: ${summary.total}\n\n`;

    textReport += 'SUMMARY:\n';
    textReport += `  ✅ Healthy (No Errors): ${summary.healthy}\n`;
    textReport += `  ⚠️  Warning (1-2 Errors): ${summary.warning}\n`;
    textReport += `  ❌ Error (3+ Errors): ${summary.error}\n\n`;

    // Group by category
    for (const [category, pages] of Object.entries(report.byCategory)) {
      textReport += '='.repeat(100) + '\n';
      textReport += `${category.toUpperCase()} PAGES (${pages.length})\n`;
      textReport += '='.repeat(100) + '\n\n';

      for (const result of pages) {
        textReport += '-'.repeat(100) + '\n';
        textReport += `Page: ${result.name}\n`;
        textReport += `Path: ${result.path}\n`;
        textReport += `Status: ${result.status} | Health: ${result.healthStatus}\n`;

        if (result.title) {
          textReport += `Title: ${result.title}\n`;
        }

        if (result.loadTime) {
          textReport += `Load Time: ${result.loadTime}ms\n`;
        }

        if (result.currentUrl && result.currentUrl !== `${baseUrl}${result.path}`) {
          textReport += `Redirected to: ${result.currentUrl}\n`;
        }

        textReport += `Screenshot: ${result.screenshot}\n`;

        // Error details
        if (result.errors) {
          const { console: consoleErrors, network, pageErrors, totalErrors, totalWarnings } = result.errors;

          textReport += `\nError Summary: ${totalErrors} errors, ${totalWarnings} warnings\n`;

          if (pageErrors && pageErrors.length > 0) {
            textReport += `\n❌ JavaScript Runtime Errors (${pageErrors.length}):\n`;
            pageErrors.forEach((err, idx) => {
              textReport += `\n  ${idx + 1}. ${err.message}\n`;
              if (err.stack) {
                const stackLines = err.stack.split('\n').slice(0, 3);
                stackLines.forEach(line => textReport += `     ${line}\n`);
              }
            });
          }

          if (consoleErrors && consoleErrors.length > 0) {
            const errors = consoleErrors.filter(e => e.type === 'error');
            const warnings = consoleErrors.filter(e => e.type === 'warning');

            if (errors.length > 0) {
              textReport += `\n❌ Console Errors (${errors.length}):\n`;
              errors.forEach((err, idx) => {
                textReport += `\n  ${idx + 1}. ${err.text}\n`;
                if (err.location && err.location.url) {
                  textReport += `     Location: ${err.location.url}`;
                  if (err.location.lineNumber) {
                    textReport += `:${err.location.lineNumber}`;
                  }
                  textReport += '\n';
                }
              });
            }

            if (warnings.length > 0) {
              textReport += `\n⚠️  Console Warnings (${warnings.length}):\n`;
              warnings.slice(0, 5).forEach((warn, idx) => {
                textReport += `\n  ${idx + 1}. ${warn.text}\n`;
              });
              if (warnings.length > 5) {
                textReport += `  ... and ${warnings.length - 5} more warnings\n`;
              }
            }
          }

          if (network && network.length > 0) {
            textReport += `\n❌ Network Errors (${network.length}):\n`;
            network.forEach((err, idx) => {
              textReport += `\n  ${idx + 1}. ${err.method} ${err.url}\n`;
              if (err.status) {
                textReport += `     Status: ${err.status} ${err.statusText}\n`;
              }
              if (err.failure) {
                textReport += `     Failure: ${err.failure}\n`;
              }
            });
          }
        }

        if (result.hasHydrationError) {
          textReport += `\n⚠️  HYDRATION ERROR DETECTED IN PAGE CONTENT\n`;
        }

        if (result.metrics) {
          textReport += `\nPerformance Metrics:\n`;
          textReport += `  - DOM Nodes: ${result.metrics.Nodes}\n`;
          textReport += `  - JS Heap Used: ${result.metrics.JSHeapUsedSize}\n`;
          textReport += `  - Layout Count: ${result.metrics.LayoutCount}\n`;
          textReport += `  - Style Recalculations: ${result.metrics.RecalcStyleCount}\n`;
        }

        textReport += '\n';
      }
    }

    textReport += '='.repeat(100) + '\n';
    textReport += 'OVERALL HEALTH STATUS\n';
    textReport += '='.repeat(100) + '\n\n';

    const healthPercentage = Math.round((summary.healthy / summary.total) * 100);
    textReport += `Health Score: ${healthPercentage}% (${summary.healthy}/${summary.total} pages healthy)\n\n`;

    if (summary.error > 0) {
      textReport += `⚠️  ATTENTION REQUIRED: ${summary.error} pages have critical errors\n\n`;
      textReport += 'Pages with errors:\n';
      results.filter(r => r.healthStatus === 'ERROR').forEach(r => {
        textReport += `  - ${r.name} (${r.path}): ${r.errors?.totalErrors || 'Unknown'} errors\n`;
      });
    }

    if (summary.warning > 0) {
      textReport += `\n⚠️  Minor issues found: ${summary.warning} pages with warnings\n\n`;
      textReport += 'Pages with warnings:\n';
      results.filter(r => r.healthStatus === 'WARNING').forEach(r => {
        textReport += `  - ${r.name} (${r.path}): ${r.errors?.totalErrors || 'Unknown'} errors\n`;
      });
    }

    if (summary.healthy === summary.total) {
      textReport += '\n🎉 EXCELLENT! All pages are healthy with no errors detected.\n';
    }

    textReport += '\n' + '='.repeat(100) + '\n';
    textReport += 'END OF REPORT\n';
    textReport += '='.repeat(100) + '\n';

    const txtPath = path.join(resultsDir, 'debug-report.txt');
    fs.writeFileSync(txtPath, textReport);

    console.log(`\n\n📊 Reports generated:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   Text: ${txtPath}`);
    console.log(`   Screenshots: ${resultsDir}`);

    return report;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  console.log('='.repeat(100));
  console.log('COMPREHENSIVE BROWSER DEBUGGING - MANAGEMENT SYSTEM');
  console.log('='.repeat(100));

  const pageDebugger = new PageDebugger();
  const results = [];

  try {
    await pageDebugger.initialize();
    await pageDebugger.login();

    console.log('\n' + '='.repeat(100));
    console.log('TESTING ALL PAGES');
    console.log('='.repeat(100));

    for (const pageInfo of pagesToTest) {
      const result = await pageDebugger.testPage(pageInfo);
      results.push(result);

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const report = await pageDebugger.generateReport(results);

    console.log('\n\n' + '='.repeat(100));
    console.log('TEST SUMMARY');
    console.log('='.repeat(100));
    console.log(`Total Pages: ${report.summary.total}`);
    console.log(`✅ Healthy: ${report.summary.healthy}`);
    console.log(`⚠️  Warning: ${report.summary.warning}`);
    console.log(`❌ Error: ${report.summary.error}`);
    console.log(`\nHealth Score: ${Math.round((report.summary.healthy / report.summary.total) * 100)}%`);
    console.log('='.repeat(100));

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pageDebugger.close();
  }
}

main().catch(console.error);
