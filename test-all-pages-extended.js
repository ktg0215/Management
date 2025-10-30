const http = require('http');

const pages = [
  { name: 'ログインページ', path: '/login' },
  { name: 'ダッシュボード', path: '/admin/dashboard' },
  { name: '売上管理', path: '/admin/sales-management' },
  { name: '店舗管理', path: '/admin/stores' },
  { name: '従業員管理', path: '/admin/employees' },
  { name: 'シフト管理', path: '/admin/shifts' },
  { name: '月次売上管理', path: '/admin/monthly-sales' },
  { name: '年次損益進捗', path: '/admin/yearly-progress' },
  { name: '支払い管理', path: '/admin/payments' },
  { name: '業態管理', path: '/admin/business-types' },
  { name: '企業管理', path: '/admin/companies' },
  { name: '管理者追加', path: '/admin/add-admin' }
];

function testPage(page) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: page.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      const duration = Date.now() - startTime;
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const result = {
          name: page.name,
          path: page.path,
          status: res.statusCode,
          duration: duration + 'ms',
          contentLength: data.length,
          hasHtml: data.includes('<!DOCTYPE html>') || data.includes('<html'),
          hasReactRoot: data.includes('__next') || data.includes('id="__next"'),
          hasTitle: /<title>(.+?)<\/title>/.test(data),
          titleContent: (data.match(/<title>(.+?)<\/title>/) || [])[1] || 'N/A',
          hasScripts: data.includes('<script'),
          hasStyles: data.includes('<link') && data.includes('stylesheet'),
          redirectTo: res.headers.location || null
        };

        // Check for common error indicators
        result.hasError404 = data.includes('404') && data.toLowerCase().includes('not found');
        result.hasError500 = data.includes('500') && data.toLowerCase().includes('error');
        result.hasNextError = data.includes('Application error') || data.includes('__NEXT_DATA__');

        resolve(result);
      });
    });

    req.on('error', (e) => {
      resolve({
        name: page.name,
        path: page.path,
        status: 'ERROR',
        error: e.message,
        duration: (Date.now() - startTime) + 'ms'
      });
    });

    req.setTimeout(60000, () => {  // Extended to 60 seconds
      req.destroy();
      resolve({
        name: page.name,
        path: page.path,
        status: 'TIMEOUT',
        duration: '60000ms+'
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 AppLayout修正後の全ページテスト（拡張タイムアウト: 60秒）\n');
  console.log('=' .repeat(80));

  const results = [];

  for (const page of pages) {
    process.stdout.write(`Testing ${page.name} (${page.path})... `);
    const result = await testPage(page);
    results.push(result);

    const statusIcon = result.status === 200 ? '✅' : '❌';
    console.log(`${statusIcon} ${result.status} (${result.duration})`);

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('=' .repeat(80));
  console.log('\n📊 詳細テスト結果:\n');

  let successCount = 0;
  let failureCount = 0;
  const errorPages = [];

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   Path: ${result.path}`);
    console.log(`   Status: ${result.status}`);

    if (result.status === 200) {
      successCount++;
      console.log(`   Duration: ${result.duration}`);
      console.log(`   Title: ${result.titleContent}`);
      console.log(`   Content Length: ${result.contentLength} bytes`);
      console.log(`   ✓ HTML Document: ${result.hasHtml ? 'Yes' : 'No'}`);
      console.log(`   ✓ React Root: ${result.hasReactRoot ? 'Yes' : 'No'}`);
      console.log(`   ✓ Scripts: ${result.hasScripts ? 'Yes' : 'No'}`);
      console.log(`   ✓ Stylesheets: ${result.hasStyles ? 'Yes' : 'No'}`);

      if (result.hasError404) {
        console.log(`   ❌ ERROR: Contains 404 error page`);
        errorPages.push({ page: result.name, path: result.path, issue: '404 content detected' });
      } else {
        console.log(`   ✅ No 404 errors detected`);
      }
    } else {
      failureCount++;
      if (result.status === 'TIMEOUT') {
        console.log(`   ⏱️  Request timed out after 60 seconds`);
        errorPages.push({ page: result.name, path: result.path, issue: 'Timeout' });
      } else if (result.redirectTo) {
        console.log(`   → Redirect to: ${result.redirectTo}`);
      } else if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
        errorPages.push({ page: result.name, path: result.path, issue: result.error });
      }
    }
    console.log('');
  });

  console.log('=' .repeat(80));
  console.log('\n📈 総合結果:');
  console.log(`   成功: ${successCount}/${pages.length} ページ`);
  console.log(`   失敗: ${failureCount}/${pages.length} ページ`);
  console.log(`   成功率: ${Math.round((successCount / pages.length) * 100)}%`);

  if (errorPages.length > 0) {
    console.log('\n⚠️  問題のあるページ:');
    errorPages.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.page} (${err.path}) - ${err.issue}`);
    });
  }

  if (successCount === pages.length) {
    console.log('\n🎉 すべてのページが正常に表示されました！');
  } else {
    console.log('\n⚠️  一部のページに問題があります。詳細を確認してください。');
  }

  console.log('\n' + '=' .repeat(80));

  // Save results to JSON
  const fs = require('fs');
  fs.writeFileSync(
    'C:/job/project/page-test-results-extended.json',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: pages.length,
        success: successCount,
        failure: failureCount,
        errorPages
      }
    }, null, 2)
  );
  console.log('\n💾 詳細結果を保存しました: C:/job/project/page-test-results-extended.json');
}

runTests().catch(console.error);
