const puppeteer = require('puppeteer');

async function captureDetailedErrors(browser, url, pageName) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`DETAILED ERROR ANALYSIS: ${pageName}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(100));

  const page = await browser.newPage();
  const allLogs = [];

  // Enable verbose console logging
  await page.evaluateOnNewDocument(() => {
    // Capture all console methods
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    window.consoleCapture = [];

    ['log', 'error', 'warn', 'info'].forEach(method => {
      console[method] = function(...args) {
        window.consoleCapture.push({
          type: method,
          timestamp: new Date().toISOString(),
          args: args
        });
        originalConsole[method].apply(console, args);
      };
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      console.error('Unhandled Promise Rejection:', event.reason);
    });

    // Capture global errors
    window.addEventListener('error', event => {
      console.error('Global Error:', event.error || event.message);
    });
  });

  // Capture console with full context
  page.on('console', async msg => {
    const type = msg.type();
    const location = msg.location();
    const text = msg.text();

    try {
      const args = await Promise.all(
        msg.args().map(arg => arg.jsonValue().catch(() => arg.toString()))
      );

      const logEntry = {
        type,
        text,
        args,
        location,
        timestamp: new Date().toISOString()
      };

      allLogs.push(logEntry);

      if (type === 'error' || type === 'warning') {
        console.log(`\n[${type.toUpperCase()}] ${text}`);
        if (location.url) {
          console.log(`  Location: ${location.url}:${location.lineNumber}:${location.columnNumber}`);
        }
      }
    } catch (e) {
      allLogs.push({ type, text, error: e.message });
    }
  });

  // Capture page errors with stack traces
  const pageErrors = [];
  page.on('pageerror', error => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString()
    };
    pageErrors.push(errorInfo);

    console.log(`\n[PAGE ERROR - JAVASCRIPT EXCEPTION]`);
    console.log(`  Message: ${error.message}`);
    console.log(`  Stack Trace:`);
    console.log(error.stack.split('\n').map(line => `    ${line}`).join('\n'));
  });

  // Detailed network monitoring
  const networkActivity = {
    requests: [],
    responses: [],
    failures: []
  };

  page.on('request', request => {
    networkActivity.requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      resourceType: request.resourceType(),
      timestamp: new Date().toISOString()
    });
  });

  page.on('response', async response => {
    const request = response.request();
    const status = response.status();

    const responseInfo = {
      url: response.url(),
      method: request.method(),
      status,
      statusText: response.statusText(),
      headers: response.headers(),
      resourceType: request.resourceType(),
      timestamp: new Date().toISOString()
    };

    networkActivity.responses.push(responseInfo);

    // Log failed requests with details
    if (status >= 400) {
      console.log(`\n[HTTP ${status} - ${response.statusText()}]`);
      console.log(`  Method: ${request.method()}`);
      console.log(`  URL: ${response.url()}`);
      console.log(`  Resource Type: ${request.resourceType()}`);

      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json') || contentType.includes('text/')) {
          const body = await response.text();
          if (body && body.length < 1000) {
            console.log(`  Response Body: ${body}`);
          }
        }
      } catch (e) {
        console.log(`  (Could not read response body)`);
      }
    }
  });

  page.on('requestfailed', request => {
    const failureInfo = {
      url: request.url(),
      method: request.method(),
      errorText: request.failure()?.errorText,
      resourceType: request.resourceType(),
      timestamp: new Date().toISOString()
    };

    networkActivity.failures.push(failureInfo);

    console.log(`\n[NETWORK FAILURE]`);
    console.log(`  URL: ${request.url()}`);
    console.log(`  Method: ${request.method()}`);
    console.log(`  Error: ${request.failure()?.errorText}`);
    console.log(`  Resource Type: ${request.resourceType()}`);
  });

  try {
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 15000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get captured console logs from page context
    const capturedLogs = await page.evaluate(() => window.consoleCapture || []);

    // Check page state
    const pageState = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        readyState: document.readyState,
        hasErrors: document.body.innerText.toLowerCase().includes('error'),
        bodyText: document.body.innerText.substring(0, 500),
        elementCount: document.getElementsByTagName('*').length,
        // Check for React/Next.js specific errors
        hasReactError: !!document.querySelector('[data-nextjs-dialog]'),
        // Get any visible error messages
        errorElements: Array.from(document.querySelectorAll('[class*="error"], [class*="Error"]'))
          .map(el => ({ class: el.className, text: el.innerText.substring(0, 100) }))
      };
    });

    console.log(`\n${'─'.repeat(100)}`);
    console.log(`PAGE STATE ANALYSIS`);
    console.log('─'.repeat(100));
    console.log(`Title: ${pageState.title}`);
    console.log(`URL: ${pageState.url}`);
    console.log(`Ready State: ${pageState.readyState}`);
    console.log(`HTTP Status: ${response.status()} ${response.statusText()}`);
    console.log(`Element Count: ${pageState.elementCount}`);
    console.log(`Has React/Next.js Error Overlay: ${pageState.hasReactError}`);
    console.log(`\nVisible Content (first 200 chars):\n  ${pageState.bodyText.substring(0, 200).replace(/\n/g, '\n  ')}`);

    // Summary statistics
    const errorLogs = allLogs.filter(l => l.type === 'error');
    const warningLogs = allLogs.filter(l => l.type === 'warning');
    const failedRequests = networkActivity.responses.filter(r => r.status >= 400);

    console.log(`\n${'─'.repeat(100)}`);
    console.log(`ERROR SUMMARY`);
    console.log('─'.repeat(100));
    console.log(`JavaScript Page Errors (with stack traces): ${pageErrors.length}`);
    console.log(`Console Errors: ${errorLogs.length}`);
    console.log(`Console Warnings: ${warningLogs.length}`);
    console.log(`Network Failures: ${networkActivity.failures.length}`);
    console.log(`Failed HTTP Requests (4xx/5xx): ${failedRequests.length}`);

    if (errorLogs.length > 0) {
      console.log(`\nConsole Error Details:`);
      errorLogs.forEach((log, idx) => {
        console.log(`  ${idx + 1}. [${log.type}] ${log.text}`);
        if (log.location?.url) {
          console.log(`     Location: ${log.location.url}:${log.location.lineNumber}`);
        }
      });
    }

    if (failedRequests.length > 0) {
      console.log(`\nFailed HTTP Requests:`);
      failedRequests.forEach((req, idx) => {
        console.log(`  ${idx + 1}. [${req.status}] ${req.method} ${req.url}`);
      });
    }

    // Overall status
    const hasJsErrors = pageErrors.length > 0;
    const hasCriticalNetworkErrors = networkActivity.failures.length > 0;
    const hasAuthErrors = failedRequests.some(r => r.status === 401);
    const pageLoadsVisually = response.ok() && pageState.elementCount > 100;

    console.log(`\n${'─'.repeat(100)}`);
    console.log(`OVERALL STATUS`);
    console.log('─'.repeat(100));
    console.log(`Page Loads: ${pageLoadsVisually ? 'YES' : 'NO'}`);
    console.log(`Has JavaScript Errors: ${hasJsErrors ? 'YES' : 'NO'}`);
    console.log(`Has Network Failures: ${hasCriticalNetworkErrors ? 'YES' : 'NO'}`);
    console.log(`Has Authentication Errors: ${hasAuthErrors ? 'YES (Expected - not logged in)' : 'NO'}`);
    console.log(`Visual Status: ${pageLoadsVisually && !hasJsErrors ? 'WORKING' : hasJsErrors ? 'HAS ERRORS' : 'ISSUES'}`);

    await page.close();

    return {
      pageName,
      pageLoadsVisually,
      hasJsErrors,
      pageErrors,
      errorLogs,
      warningLogs,
      networkActivity,
      pageState
    };

  } catch (error) {
    console.log(`\n[CRITICAL ERROR] Failed to load page`);
    console.log(`  Error: ${error.message}`);
    console.log(`  Stack: ${error.stack}`);

    await page.close();

    return {
      pageName,
      criticalError: error.message,
      pageErrors,
      allLogs,
      networkActivity
    };
  }
}

async function main() {
  console.log('Starting Detailed Error Analysis...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const pages = [
    { url: 'http://localhost:3002/login', name: 'Login Page' },
    { url: 'http://localhost:3002/admin/sales-management', name: 'Sales Management (No Auth)' },
    { url: 'http://localhost:3002/admin/dashboard', name: 'Admin Dashboard' },
    { url: 'http://localhost:3002/admin/payments', name: 'Admin Payments' }
  ];

  const results = [];

  for (const pageConfig of pages) {
    const result = await captureDetailedErrors(browser, pageConfig.url, pageConfig.name);
    results.push(result);
  }

  await browser.close();

  // Final consolidated report
  console.log(`\n\n${'='.repeat(100)}`);
  console.log(`CONSOLIDATED ERROR REPORT`);
  console.log('='.repeat(100));

  results.forEach(result => {
    console.log(`\n${result.pageName}:`);
    console.log(`  Visual Status: ${result.pageLoadsVisually ? 'Loads Successfully' : 'Does Not Load'}`);
    console.log(`  JavaScript Errors: ${result.hasJsErrors ? 'YES' : 'NO'} (${result.pageErrors?.length || 0} errors)`);
    console.log(`  Console Errors: ${result.errorLogs?.length || 0}`);
    console.log(`  Network Failures: ${result.networkActivity?.failures?.length || 0}`);
    console.log(`  Failed HTTP Requests: ${result.networkActivity?.responses?.filter(r => r.status >= 400).length || 0}`);
  });

  console.log('\n' + '='.repeat(100));
}

main().catch(console.error);
