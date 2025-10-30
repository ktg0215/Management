const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const resultsDir = path.join(__dirname, 'test-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

const pages = [
  { name: 'Login Page', url: 'http://localhost:3002/login' },
  { name: 'Dashboard', url: 'http://localhost:3002/admin/dashboard' },
  { name: 'Sales Management', url: 'http://localhost:3002/admin/sales-management' },
  { name: 'Stores Management', url: 'http://localhost:3002/admin/stores' },
  { name: 'Employees Management', url: 'http://localhost:3002/admin/employees' },
  { name: 'Shift Management', url: 'http://localhost:3002/admin/shifts' },
  { name: 'Monthly Sales', url: 'http://localhost:3002/admin/monthly-sales' },
  { name: 'Yearly Progress', url: 'http://localhost:3002/admin/yearly-progress' },
  { name: 'Payments Management', url: 'http://localhost:3002/admin/payments' },
];

async function testPage(browser, pageInfo) {
  const page = await browser.newPage();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${pageInfo.name}`);
  console.log(`URL: ${pageInfo.url}`);
  console.log('='.repeat(70));

  const testResult = {
    name: pageInfo.name,
    url: pageInfo.url,
    httpStatus: null,
    consoleErrors: [],
    consoleWarnings: [],
    consoleMessages: [],
    networkRequests: [],
    failedRequests: [],
    pageErrors: [],
    screenshots: [],
    htmlContent: null,
  };

  // コンソールメッセージをキャプチャ
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();

    const message = {
      type,
      text,
      location: location.url ? `${location.url}:${location.lineNumber}` : 'unknown'
    };

    testResult.consoleMessages.push(message);

    if (type === 'error') {
      testResult.consoleErrors.push(message);
      console.log(`  ❌ Console Error: ${text}`);
      if (location.url) {
        console.log(`     Location: ${location.url}:${location.lineNumber}:${location.columnNumber}`);
      }
    } else if (type === 'warning') {
      testResult.consoleWarnings.push(message);
      console.log(`  ⚠️  Console Warning: ${text}`);
    } else if (type === 'log' || type === 'info') {
      console.log(`  ℹ️  Console ${type}: ${text}`);
    }
  });

  // ページエラーをキャプチャ
  page.on('pageerror', error => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
    };
    testResult.pageErrors.push(errorInfo);
    console.log(`  ❌ Page Error: ${error.message}`);
    console.log(`     Stack: ${error.stack}`);
  });

  // リクエストを記録
  page.on('request', request => {
    testResult.networkRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
  });

  // 失敗したリクエストを記録
  page.on('requestfailed', request => {
    const failure = request.failure();
    const failedReq = {
      url: request.url(),
      method: request.method(),
      error: failure ? failure.errorText : 'Unknown error',
    };
    testResult.failedRequests.push(failedReq);
    console.log(`  ❌ Network Error: ${request.url()}`);
    console.log(`     Method: ${request.method()}`);
    console.log(`     Error: ${failure ? failure.errorText : 'Unknown'}`);
  });

  try {
    // ページに移動
    const startTime = Date.now();
    const response = await page.goto(pageInfo.url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    const loadTime = Date.now() - startTime;

    testResult.httpStatus = response.status();
    console.log(`  ✅ HTTP Status: ${response.status()}`);
    console.log(`  ⏱️  Load Time: ${loadTime}ms`);

    // HTMLコンテンツを取得
    const htmlContent = await page.content();
    testResult.htmlContent = htmlContent;

    // ページタイトルを取得
    const title = await page.title();
    console.log(`  📄 Page Title: ${title}`);

    // スクリーンショットを撮影
    const screenshotPath = path.join(resultsDir, `${pageInfo.name.replace(/\s+/g, '_')}_detailed.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testResult.screenshots.push(screenshotPath);
    console.log(`  📸 Screenshot saved: ${screenshotPath}`);

    // DOM要素のチェック
    await page.waitForSelector('body', { timeout: 5000 });

    // 404ページかどうかをチェック
    const is404 = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('404') || text.includes('This page could not be found');
    });

    if (is404) {
      console.log(`  ⚠️  Page appears to be a 404 error page`);
      testResult.is404Page = true;
    }

    // JavaScriptエラーを取得
    const jsErrors = await page.evaluate(() => {
      return window.__NEXT_DATA__?.props?.pageProps?.statusCode || null;
    });

    if (jsErrors === 404) {
      console.log(`  ⚠️  Next.js status code: 404`);
    }

  } catch (error) {
    console.log(`  ❌ Test Error: ${error.message}`);
    testResult.testError = {
      message: error.message,
      stack: error.stack,
    };
  } finally {
    await page.close();
  }

  return testResult;
}

async function runTests() {
  console.log('\n🚀 Starting detailed page tests...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const results = [];

    for (const pageInfo of pages) {
      const result = await testPage(browser, pageInfo);
      results.push(result);
    }

    // 結果をJSONファイルに保存
    const resultsPath = path.join(resultsDir, 'detailed-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📝 Detailed test results saved to: ${resultsPath}`);

    // サマリーを表示
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));

    const status200 = results.filter(r => r.httpStatus === 200).length;
    const status404 = results.filter(r => r.httpStatus === 404).length;
    const withErrors = results.filter(r => r.consoleErrors.length > 0 || r.pageErrors.length > 0).length;

    console.log(`Total Pages Tested: ${results.length}`);
    console.log(`HTTP 200: ${status200}`);
    console.log(`HTTP 404: ${status404}`);
    console.log(`Pages with Errors: ${withErrors}`);
    console.log('='.repeat(70));

    // 詳細な問題リスト
    console.log('\n📋 ISSUES FOUND:\n');
    for (const result of results) {
      if (result.httpStatus === 404 || result.consoleErrors.length > 0 || result.pageErrors.length > 0) {
        console.log(`❌ ${result.name} (${result.url})`);
        console.log(`   HTTP Status: ${result.httpStatus}`);
        if (result.consoleErrors.length > 0) {
          console.log(`   Console Errors: ${result.consoleErrors.length}`);
          result.consoleErrors.forEach((err, idx) => {
            console.log(`     ${idx + 1}. ${err.text}`);
            if (err.location !== 'unknown') {
              console.log(`        at ${err.location}`);
            }
          });
        }
        if (result.pageErrors.length > 0) {
          console.log(`   Page Errors: ${result.pageErrors.length}`);
          result.pageErrors.forEach((err, idx) => {
            console.log(`     ${idx + 1}. ${err.message}`);
          });
        }
        if (result.failedRequests.length > 0) {
          console.log(`   Failed Network Requests: ${result.failedRequests.length}`);
          result.failedRequests.forEach((req, idx) => {
            console.log(`     ${idx + 1}. ${req.url} - ${req.error}`);
          });
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Fatal error during testing:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runTests();
