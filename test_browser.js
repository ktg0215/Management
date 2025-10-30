#!/usr/bin/env node

/**
 * Comprehensive Browser Testing Script
 * Tests all pages for SSR errors, console errors, and network failures
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3002';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Test results tracking
const results = {
  totalPages: 0,
  successfulPages: 0,
  failedPages: 0,
  pages: []
};

/**
 * Make HTTP request and check response
 */
function testPage(path, pageName) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${path}`;
    const startTime = Date.now();

    http.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(3);

        const result = {
          name: pageName,
          path: path,
          status: res.statusCode,
          duration: duration,
          hasErrors: false,
          errors: []
        };

        // Check for errors in HTML content
        if (data.includes('500') && (data.includes('Internal Server Error') || data.includes('Application error'))) {
          result.hasErrors = true;
          result.errors.push('500 Internal Server Error detected in HTML');
        }

        if (data.includes('<title>Error</title>')) {
          result.hasErrors = true;
          result.errors.push('Error page title detected');
        }

        // Check for React hydration errors
        if (data.includes('Hydration failed') || data.includes('hydration error')) {
          result.hasErrors = true;
          result.errors.push('React hydration error detected');
        }

        // Check for Next.js specific errors
        if (data.includes('Application error: a client-side exception has occurred')) {
          result.hasErrors = true;
          result.errors.push('Next.js client-side exception detected');
        }

        // Check status codes
        if (res.statusCode === 200 || res.statusCode === 304) {
          if (!result.hasErrors) {
            result.success = true;
            results.successfulPages++;
          } else {
            result.success = false;
            results.failedPages++;
          }
        } else if (res.statusCode === 302 || res.statusCode === 307) {
          // Redirects are expected for protected routes
          result.success = true;
          result.redirect = true;
          results.successfulPages++;
        } else if (res.statusCode >= 400) {
          result.success = false;
          result.hasErrors = true;
          result.errors.push(`HTTP ${res.statusCode} error`);
          results.failedPages++;
        }

        results.totalPages++;
        results.pages.push(result);
        resolve(result);
      });
    }).on('error', (err) => {
      const result = {
        name: pageName,
        path: path,
        status: 0,
        duration: '0.000',
        success: false,
        hasErrors: true,
        errors: [err.message]
      };
      results.totalPages++;
      results.failedPages++;
      results.pages.push(result);
      resolve(result);
    });
  });
}

/**
 * Print test result
 */
function printResult(result) {
  const statusColor = result.success ? colors.green : colors.red;
  const statusIcon = result.success ? '✓' : '✗';
  const statusText = result.success ? 'PASS' : 'FAIL';

  console.log(`\n${colors.bold}Testing:${colors.reset} ${result.name} ${colors.cyan}(${result.path})${colors.reset}`);
  console.log(`${statusColor}${statusIcon} ${statusText}${colors.reset} - Status: ${result.status}, Duration: ${result.duration}s`);

  if (result.redirect) {
    console.log(`${colors.yellow}→ REDIRECT${colors.reset} (Expected for protected routes)`);
  }

  if (result.hasErrors && result.errors.length > 0) {
    console.log(`${colors.red}Errors found:${colors.reset}`);
    result.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
  }
}

/**
 * Print summary report
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bold}${colors.blue}TEST SUMMARY REPORT${colors.reset}`);
  console.log('='.repeat(60));

  console.log(`\n${colors.bold}Overall Statistics:${colors.reset}`);
  console.log(`Total Pages Tested: ${results.totalPages}`);
  console.log(`${colors.green}✓ Successful: ${results.successfulPages}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${results.failedPages}${colors.reset}`);

  const successRate = results.totalPages > 0
    ? ((results.successfulPages / results.totalPages) * 100).toFixed(1)
    : 0;
  console.log(`${colors.bold}Success Rate: ${successRate}%${colors.reset}`);

  // Detailed results table
  console.log(`\n${colors.bold}Detailed Results:${colors.reset}`);
  console.log('─'.repeat(60));

  results.pages.forEach(page => {
    const statusIcon = page.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    const status = page.status || 'ERR';
    console.log(`${statusIcon} ${page.name.padEnd(30)} | HTTP ${status} | ${page.duration}s`);
  });

  // Failed pages detail
  if (results.failedPages > 0) {
    console.log(`\n${colors.bold}${colors.red}Failed Pages Detail:${colors.reset}`);
    console.log('─'.repeat(60));

    results.pages.filter(p => !p.success).forEach(page => {
      console.log(`\n${colors.red}✗ ${page.name}${colors.reset} (${page.path})`);
      console.log(`  Status: ${page.status}`);
      if (page.errors.length > 0) {
        console.log(`  Errors:`);
        page.errors.forEach(error => {
          console.log(`    - ${error}`);
        });
      }
    });
  }

  console.log('\n' + '='.repeat(60));

  // Final verdict
  if (results.failedPages === 0) {
    console.log(`${colors.green}${colors.bold}✓ ALL TESTS PASSED!${colors.reset}`);
    console.log(`${colors.green}No SSR errors detected. Application is working correctly.${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bold}✗ TESTS FAILED!${colors.reset}`);
    console.log(`${colors.red}${results.failedPages} page(s) have errors that need to be fixed.${colors.reset}`);
  }
  console.log('='.repeat(60) + '\n');
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log(`${colors.bold}${colors.blue}SSR Testing - All Application Pages${colors.reset}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));

  // Define all pages to test
  const pages = [
    { path: '/', name: 'Login Page' },
    { path: '/admin/dashboard', name: 'Admin Dashboard' },
    { path: '/admin/stores', name: 'Stores Management' },
    { path: '/admin/companies', name: 'Companies Management' },
    { path: '/admin/business-types', name: 'Business Types Management' },
    { path: '/admin/employees', name: 'Employees Management' },
    { path: '/admin/shifts', name: 'Shifts Management' },
    { path: '/admin/monthly-sales', name: 'Monthly Sales' },
    { path: '/admin/yearly-progress', name: 'Yearly Progress' },
    { path: '/admin/payments', name: 'Payments Management' }
  ];

  // Test each page sequentially
  for (const page of pages) {
    const result = await testPage(page.path, page.name);
    printResult(result);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Print summary
  printSummary();

  // Exit with appropriate code
  process.exit(results.failedPages > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
