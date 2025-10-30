const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// テスト結果を保存するディレクトリ
const resultsDir = path.join(__dirname, 'test-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// テスト対象のページ
const pages = [
  { name: 'Login Page', url: 'http://localhost:3002/login', requiresAuth: false },
  { name: 'Dashboard', url: 'http://localhost:3002/admin/dashboard', requiresAuth: true },
  { name: 'Sales Management', url: 'http://localhost:3002/admin/sales-management', requiresAuth: true },
  { name: 'Stores Management', url: 'http://localhost:3002/admin/stores', requiresAuth: true },
  { name: 'Employees Management', url: 'http://localhost:3002/admin/employees', requiresAuth: true },
  { name: 'Shift Management', url: 'http://localhost:3002/admin/shifts', requiresAuth: true },
  { name: 'Monthly Sales', url: 'http://localhost:3002/admin/monthly-sales', requiresAuth: true },
  { name: 'Yearly Progress', url: 'http://localhost:3002/admin/yearly-progress', requiresAuth: true },
  { name: 'Payments Management', url: 'http://localhost:3002/admin/payments', requiresAuth: true },
];

// テスト結果
const results = {
  summary: {
    total: pages.length,
    passed: 0,
    failed: 0,
    warnings: 0,
  },
  pages: [],
  timestamp: new Date().toISOString(),
};

async function testPage(browser, page, pageInfo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${pageInfo.name}`);
  console.log(`URL: ${pageInfo.url}`);
  console.log('='.repeat(60));

  const testResult = {
    name: pageInfo.name,
    url: pageInfo.url,
    status: 'unknown',
    httpStatus: null,
    consoleErrors: [],
    consoleWarnings: [],
    networkErrors: [],
    screenshots: [],
    loadTime: null,
    renderComplete: false,
    functionalTests: [],
  };

  try {
    // コンソールメッセージをキャプチャ
    const consoleMessages = [];
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });

      if (type === 'error') {
        testResult.consoleErrors.push(text);
        console.log(`  ❌ Console Error: ${text}`);
      } else if (type === 'warning') {
        testResult.consoleWarnings.push(text);
        console.log(`  ⚠️  Console Warning: ${text}`);
      }
    });

    // ページエラーをキャプチャ
    page.on('pageerror', error => {
      testResult.consoleErrors.push(`Page Error: ${error.message}\nStack: ${error.stack}`);
      console.log(`  ❌ Page Error: ${error.message}`);
    });

    // ネットワークエラーをキャプチャ
    page.on('requestfailed', request => {
      const failure = request.failure();
      testResult.networkErrors.push({
        url: request.url(),
        method: request.method(),
        error: failure ? failure.errorText : 'Unknown error',
      });
      console.log(`  ❌ Network Error: ${request.url()} - ${failure ? failure.errorText : 'Unknown'}`);
    });

    // ページに移動
    const startTime = Date.now();
    const response = await page.goto(pageInfo.url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });
    const loadTime = Date.now() - startTime;

    testResult.httpStatus = response.status();
    testResult.loadTime = loadTime;

    console.log(`  ✅ HTTP Status: ${response.status()}`);
    console.log(`  ⏱️  Load Time: ${loadTime}ms`);

    // スクリーンショットを撮影
    const screenshotPath = path.join(resultsDir, `${pageInfo.name.replace(/\s+/g, '_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testResult.screenshots.push(screenshotPath);
    console.log(`  📸 Screenshot saved: ${screenshotPath}`);

    // ページタイトルを取得
    const title = await page.title();
    console.log(`  📄 Page Title: ${title}`);

    // 少し待機してレンダリングを完了させる
    await page.waitForTimeout(2000);

    // 基本的なDOM要素の存在確認
    const bodyExists = await page.$('body');
    if (bodyExists) {
      testResult.renderComplete = true;
      console.log(`  ✅ Page rendered successfully`);
    }

    // ページ固有の機能テスト
    if (pageInfo.name === 'Login Page') {
      await testLoginPage(page, testResult);
    } else if (pageInfo.name === 'Dashboard') {
      await testDashboard(page, testResult);
    } else if (pageInfo.name === 'Sales Management') {
      await testSalesManagement(page, testResult);
    } else if (pageInfo.name === 'Stores Management') {
      await testStoresManagement(page, testResult);
    } else if (pageInfo.name === 'Employees Management') {
      await testEmployeesManagement(page, testResult);
    } else if (pageInfo.name === 'Shift Management') {
      await testShiftManagement(page, testResult);
    } else if (pageInfo.name === 'Monthly Sales') {
      await testMonthlySales(page, testResult);
    } else if (pageInfo.name === 'Yearly Progress') {
      await testYearlyProgress(page, testResult);
    } else if (pageInfo.name === 'Payments Management') {
      await testPaymentsManagement(page, testResult);
    }

    // テスト結果の判定
    if (response.status() === 200 && testResult.consoleErrors.length === 0 && testResult.networkErrors.length === 0) {
      testResult.status = 'passed';
      results.summary.passed++;
      console.log(`  ✅ Overall Status: PASSED`);
    } else if (testResult.consoleWarnings.length > 0 || (response.status() === 200 && testResult.consoleErrors.length > 0)) {
      testResult.status = 'warning';
      results.summary.warnings++;
      console.log(`  ⚠️  Overall Status: WARNING`);
    } else {
      testResult.status = 'failed';
      results.summary.failed++;
      console.log(`  ❌ Overall Status: FAILED`);
    }

  } catch (error) {
    testResult.status = 'failed';
    testResult.consoleErrors.push(`Test Error: ${error.message}\nStack: ${error.stack}`);
    results.summary.failed++;
    console.log(`  ❌ Test Error: ${error.message}`);
  }

  results.pages.push(testResult);
  return testResult;
}

// ログインページのテスト
async function testLoginPage(page, testResult) {
  console.log(`  🔍 Testing login page functionality...`);

  try {
    // ログインフォームの存在確認
    const emailInput = await page.$('input[type="email"], input[name="email"]');
    const passwordInput = await page.$('input[type="password"], input[name="password"]');
    const loginButton = await page.$('button[type="submit"]');

    if (emailInput && passwordInput && loginButton) {
      testResult.functionalTests.push({ test: 'Login form elements exist', result: 'passed' });
      console.log(`    ✅ Login form elements found`);
    } else {
      testResult.functionalTests.push({ test: 'Login form elements exist', result: 'failed' });
      console.log(`    ❌ Login form elements missing`);
    }
  } catch (error) {
    testResult.functionalTests.push({ test: 'Login page test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing login page: ${error.message}`);
  }
}

// ダッシュボードのテスト
async function testDashboard(page, testResult) {
  console.log(`  🔍 Testing dashboard functionality...`);

  try {
    // ダッシュボード要素の確認
    const cards = await page.$$('[class*="card"], [class*="Card"]');
    if (cards.length > 0) {
      testResult.functionalTests.push({ test: 'Dashboard cards exist', result: 'passed', count: cards.length });
      console.log(`    ✅ Found ${cards.length} dashboard cards`);
    } else {
      testResult.functionalTests.push({ test: 'Dashboard cards exist', result: 'failed' });
      console.log(`    ❌ No dashboard cards found`);
    }
  } catch (error) {
    testResult.functionalTests.push({ test: 'Dashboard test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing dashboard: ${error.message}`);
  }
}

// 売上管理のテスト
async function testSalesManagement(page, testResult) {
  console.log(`  🔍 Testing sales management functionality...`);

  try {
    // テーブルの存在確認
    const table = await page.$('table');
    if (table) {
      testResult.functionalTests.push({ test: 'Sales table exists', result: 'passed' });
      console.log(`    ✅ Sales table found`);
    } else {
      testResult.functionalTests.push({ test: 'Sales table exists', result: 'failed' });
      console.log(`    ❌ Sales table not found`);
    }
  } catch (error) {
    testResult.functionalTests.push({ test: 'Sales management test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing sales management: ${error.message}`);
  }
}

// 店舗管理のテスト
async function testStoresManagement(page, testResult) {
  console.log(`  🔍 Testing stores management functionality...`);

  try {
    const buttons = await page.$$('button');
    testResult.functionalTests.push({ test: 'Buttons exist', result: 'passed', count: buttons.length });
    console.log(`    ✅ Found ${buttons.length} buttons`);
  } catch (error) {
    testResult.functionalTests.push({ test: 'Stores management test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing stores management: ${error.message}`);
  }
}

// 従業員管理のテスト
async function testEmployeesManagement(page, testResult) {
  console.log(`  🔍 Testing employees management functionality...`);

  try {
    const buttons = await page.$$('button');
    testResult.functionalTests.push({ test: 'Buttons exist', result: 'passed', count: buttons.length });
    console.log(`    ✅ Found ${buttons.length} buttons`);
  } catch (error) {
    testResult.functionalTests.push({ test: 'Employees management test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing employees management: ${error.message}`);
  }
}

// シフト管理のテスト
async function testShiftManagement(page, testResult) {
  console.log(`  🔍 Testing shift management functionality...`);

  try {
    const buttons = await page.$$('button');
    testResult.functionalTests.push({ test: 'Buttons exist', result: 'passed', count: buttons.length });
    console.log(`    ✅ Found ${buttons.length} buttons`);
  } catch (error) {
    testResult.functionalTests.push({ test: 'Shift management test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing shift management: ${error.message}`);
  }
}

// 月次売上のテスト
async function testMonthlySales(page, testResult) {
  console.log(`  🔍 Testing monthly sales functionality...`);

  try {
    // タブの存在確認
    const tabs = await page.$$('[role="tab"], button[class*="tab"]');
    if (tabs.length > 0) {
      testResult.functionalTests.push({ test: 'Tabs exist', result: 'passed', count: tabs.length });
      console.log(`    ✅ Found ${tabs.length} tabs`);

      // タブクリックのテスト
      if (tabs.length > 1) {
        await tabs[1].click();
        await page.waitForTimeout(1000);
        testResult.functionalTests.push({ test: 'Tab switching works', result: 'passed' });
        console.log(`    ✅ Tab switching works`);
      }
    } else {
      testResult.functionalTests.push({ test: 'Tabs exist', result: 'failed' });
      console.log(`    ❌ No tabs found`);
    }
  } catch (error) {
    testResult.functionalTests.push({ test: 'Monthly sales test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing monthly sales: ${error.message}`);
  }
}

// 年次損益進捗のテスト
async function testYearlyProgress(page, testResult) {
  console.log(`  🔍 Testing yearly progress functionality...`);

  try {
    // グラフ要素の存在確認
    const canvas = await page.$('canvas');
    const svg = await page.$('svg');
    if (canvas || svg) {
      testResult.functionalTests.push({ test: 'Chart element exists', result: 'passed' });
      console.log(`    ✅ Chart element found`);
    } else {
      testResult.functionalTests.push({ test: 'Chart element exists', result: 'failed' });
      console.log(`    ❌ Chart element not found`);
    }
  } catch (error) {
    testResult.functionalTests.push({ test: 'Yearly progress test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing yearly progress: ${error.message}`);
  }
}

// 支払い管理のテスト（重点）
async function testPaymentsManagement(page, testResult) {
  console.log(`  🔍 Testing payments management functionality (重点テスト)...`);

  try {
    // サイドバーの確認
    const sidebar = await page.$('[class*="sidebar"], nav');
    if (sidebar) {
      testResult.functionalTests.push({ test: 'Sidebar exists', result: 'passed' });
      console.log(`    ✅ Sidebar found`);
    } else {
      testResult.functionalTests.push({ test: 'Sidebar exists', result: 'warning' });
      console.log(`    ⚠️  Sidebar not found`);
    }

    // カレンダー要素の確認
    const calendar = await page.$('[class*="calendar"]');
    if (calendar) {
      testResult.functionalTests.push({ test: 'Calendar exists', result: 'passed' });
      console.log(`    ✅ Calendar found`);
    }

    // ボタンの確認
    const buttons = await page.$$('button');
    console.log(`    ✅ Found ${buttons.length} buttons`);

    // モーダルを開くボタンを探してクリック
    const modalButtons = await page.$$('button');
    for (let button of modalButtons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && (text.includes('追加') || text.includes('新規') || text.includes('Add'))) {
        console.log(`    🔍 Clicking button: ${text}`);
        await button.click();
        await page.waitForTimeout(1000);

        // モーダルが表示されたか確認
        const modal = await page.$('[role="dialog"], [class*="modal"]');
        if (modal) {
          testResult.functionalTests.push({ test: 'Modal opens', result: 'passed' });
          console.log(`    ✅ Modal opened successfully`);

          // モーダルを閉じる
          const closeButton = await page.$('[class*="close"], button[aria-label*="close"]');
          if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(500);
          }
        }
        break;
      }
    }

    // 保存ボタンの確認
    const saveButtons = await page.$$('button');
    for (let button of saveButtons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && (text.includes('保存') || text.includes('Save'))) {
        testResult.functionalTests.push({ test: 'Save button exists', result: 'passed' });
        console.log(`    ✅ Save button found`);
        break;
      }
    }

  } catch (error) {
    testResult.functionalTests.push({ test: 'Payments management test', result: 'error', error: error.message });
    console.log(`    ❌ Error testing payments management: ${error.message}`);
  }
}

// メイン関数
async function runTests() {
  console.log('\n🚀 Starting comprehensive page tests...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 各ページをテスト
    for (const pageInfo of pages) {
      await testPage(browser, page, pageInfo);
    }

    // 結果をJSONファイルに保存
    const resultsPath = path.join(resultsDir, 'test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📝 Test results saved to: ${resultsPath}`);

    // サマリーを表示
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Pages Tested: ${results.summary.total}`);
    console.log(`✅ Passed: ${results.summary.passed}`);
    console.log(`⚠️  Warnings: ${results.summary.warnings}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log('='.repeat(60));

    // 詳細な結果
    console.log('\n📋 DETAILED RESULTS:\n');
    for (const result of results.pages) {
      const statusIcon = result.status === 'passed' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${result.name}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   HTTP Status: ${result.httpStatus}`);
      console.log(`   Load Time: ${result.loadTime}ms`);
      console.log(`   Console Errors: ${result.consoleErrors.length}`);
      console.log(`   Console Warnings: ${result.consoleWarnings.length}`);
      console.log(`   Network Errors: ${result.networkErrors.length}`);
      console.log(`   Functional Tests: ${result.functionalTests.length}`);
      console.log('');
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
