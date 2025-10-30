const puppeteer = require('puppeteer');

async function testPage(browser, url, pageName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${pageName}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(80));

  const page = await browser.newPage();
  const consoleMessages = [];
  const errors = [];
  const networkFailures = [];
  const requests = [];

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });

    if (type === 'error' || type === 'warning') {
      console.log(`[CONSOLE ${type.toUpperCase()}] ${text}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
    console.log(`[PAGE ERROR] ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  });

  // Capture network failures
  page.on('requestfailed', request => {
    const failure = {
      url: request.url(),
      method: request.method(),
      failure: request.failure()
    };
    networkFailures.push(failure);
    console.log(`[NETWORK FAILURE] ${request.method()} ${request.url()}`);
    console.log(`Reason: ${request.failure().errorText}`);
  });

  // Capture all requests
  page.on('response', async response => {
    const status = response.status();
    const url = response.url();
    const request = response.request();

    requests.push({
      url,
      method: request.method(),
      status,
      statusText: response.statusText()
    });

    if (status >= 400) {
      console.log(`[HTTP ${status}] ${request.method()} ${url}`);
      try {
        const responseText = await response.text();
        if (responseText && responseText.length < 500) {
          console.log(`Response: ${responseText}`);
        }
      } catch (e) {
        // Ignore if we can't read response
      }
    }
  });

  try {
    // Navigate to the page
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 15000
    });

    // Wait a bit for any async operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if page loaded
    const pageLoaded = response && response.ok();
    console.log(`\n[PAGE LOAD STATUS] ${pageLoaded ? 'SUCCESS' : 'FAILED'} (HTTP ${response?.status()})`);

    // Get page title
    const title = await page.title();
    console.log(`[PAGE TITLE] ${title}`);

    // Check for visible content
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
    console.log(`[VISIBLE CONTENT] ${bodyText.replace(/\n/g, ' ').trim().substring(0, 150)}...`);

    // Get DOM state
    const domInfo = await page.evaluate(() => {
      return {
        hasContent: document.body.children.length > 0,
        elementCount: document.body.getElementsByTagName('*').length,
        hasErrorBoundary: document.body.innerText.includes('error') ||
                         document.body.innerText.includes('Error') ||
                         document.body.innerText.includes('wrong')
      };
    });

    console.log(`[DOM INFO] Elements: ${domInfo.elementCount}, Has Content: ${domInfo.hasContent}`);

    // Take screenshot
    const screenshotPath = `C:/job/project/debug-screenshot-${pageName.replace(/[^a-z0-9]/gi, '-')}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[SCREENSHOT] Saved to ${screenshotPath}`);

    // Summary
    console.log(`\n[SUMMARY]`);
    console.log(`  Console Errors: ${consoleMessages.filter(m => m.type === 'error').length}`);
    console.log(`  Console Warnings: ${consoleMessages.filter(m => m.type === 'warning').length}`);
    console.log(`  Page Errors: ${errors.length}`);
    console.log(`  Network Failures: ${networkFailures.length}`);
    console.log(`  Failed HTTP Requests (4xx/5xx): ${requests.filter(r => r.status >= 400).length}`);
    console.log(`  Status: ${errors.length === 0 && networkFailures.length === 0 && pageLoaded ? 'WORKING' : 'HAS ISSUES'}`);

    // Return detailed results
    return {
      pageName,
      url,
      pageLoaded,
      title,
      consoleMessages,
      errors,
      networkFailures,
      requests: requests.filter(r => r.status >= 400),
      domInfo,
      screenshotPath,
      status: errors.length === 0 && networkFailures.length === 0 && pageLoaded ? 'WORKING' : 'HAS ISSUES'
    };

  } catch (error) {
    console.log(`[NAVIGATION ERROR] ${error.message}`);
    return {
      pageName,
      url,
      pageLoaded: false,
      error: error.message,
      consoleMessages,
      errors,
      networkFailures,
      status: 'BROKEN'
    };
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Starting browser diagnostics...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const testPages = [
    { url: 'http://localhost:3002/login', name: 'Login Page' },
    { url: 'http://localhost:3002/admin/sales-management', name: 'Sales Management (No Auth)' },
    { url: 'http://localhost:3002/admin/dashboard', name: 'Admin Dashboard' },
    { url: 'http://localhost:3002/admin/payments', name: 'Admin Payments' }
  ];

  const results = [];

  for (const pageConfig of testPages) {
    const result = await testPage(browser, pageConfig.url, pageConfig.name);
    results.push(result);
  }

  await browser.close();

  // Final summary report
  console.log('\n\n' + '='.repeat(80));
  console.log('FINAL SUMMARY REPORT');
  console.log('='.repeat(80));

  results.forEach(result => {
    console.log(`\n${result.pageName}:`);
    console.log(`  URL: ${result.url}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Page Loaded: ${result.pageLoaded}`);
    console.log(`  Title: ${result.title || 'N/A'}`);
    console.log(`  Console Errors: ${result.consoleMessages?.filter(m => m.type === 'error').length || 0}`);
    console.log(`  Page Errors: ${result.errors?.length || 0}`);
    console.log(`  Network Failures: ${result.networkFailures?.length || 0}`);
  });

  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
