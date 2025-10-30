/**
 * 包括的デバッグテストスクリプト
 *
 * すべての機能をテストしてエラーを検出します
 */

const axios = require('axios');

const FRONTEND_URL = 'http://localhost:3002';
const API_URL = 'http://localhost:3001/api';

// ログイン情報
const ADMIN_CREDENTIALS = {
  employeeId: '0000',
  password: 'toyama2023'
};

// テスト結果を保存
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// ログイン
async function login() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, ADMIN_CREDENTIALS);
    const token = response.data.token || response.data.data?.token;

    if (!token) {
      throw new Error('トークンが取得できませんでした');
    }

    testResults.passed.push('✅ ログイン成功');
    return token;
  } catch (error) {
    testResults.failed.push(`❌ ログイン失敗: ${error.message}`);
    throw error;
  }
}

// フロントエンドページのテスト
async function testFrontendPage(path, name) {
  try {
    const response = await axios.get(`${FRONTEND_URL}${path}`, {
      validateStatus: () => true
    });

    if (response.status === 200) {
      testResults.passed.push(`✅ ${name} (${path}): ${response.status}`);
    } else if (response.status === 404) {
      testResults.failed.push(`❌ ${name} (${path}): 404 Not Found`);
    } else {
      testResults.warnings.push(`⚠️  ${name} (${path}): ${response.status}`);
    }
  } catch (error) {
    testResults.failed.push(`❌ ${name} (${path}): ${error.message}`);
  }
}

// APIエンドポイントのテスト
async function testApiEndpoint(method, path, name, token, data = null) {
  try {
    const config = {
      method: method,
      url: `${API_URL}${path}`,
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);

    if (response.status >= 200 && response.status < 300) {
      testResults.passed.push(`✅ ${name} (${method} ${path}): ${response.status}`);
      return response.data;
    } else if (response.status === 404) {
      testResults.failed.push(`❌ ${name} (${method} ${path}): 404 Not Found`);
    } else if (response.status === 500) {
      testResults.failed.push(`❌ ${name} (${method} ${path}): 500 Internal Server Error`);
    } else {
      testResults.warnings.push(`⚠️  ${name} (${method} ${path}): ${response.status}`);
    }

    return response.data;
  } catch (error) {
    testResults.failed.push(`❌ ${name} (${method} ${path}): ${error.message}`);
    return null;
  }
}

// メイン処理
async function main() {
  console.log('🚀 包括的デバッグテスト開始\n');
  console.log('='.repeat(80));

  try {
    // 1. ログイン
    console.log('\n📝 ステップ 1: 認証テスト');
    const token = await login();

    // 2. フロントエンドページのテスト
    console.log('\n📝 ステップ 2: フロントエンドページテスト');

    const frontendPages = [
      { path: '/login', name: 'ログインページ' },
      { path: '/register', name: '新規登録ページ' },
      { path: '/admin/dashboard', name: '管理者ダッシュボード' },
      { path: '/admin/sales-management', name: '売上管理' },
      { path: '/admin/pl-create', name: 'P&L作成' },
      { path: '/admin/yearly-progress', name: '年次損益推移' },
      { path: '/admin/payments', name: '支払い管理' },
      { path: '/admin/stores', name: '店舗管理' },
      { path: '/admin/employees', name: '従業員管理' },
      { path: '/admin/shifts', name: 'シフト管理' },
      { path: '/admin/companies', name: '取引先管理' },
      { path: '/admin/business-types', name: '業態管理' },
      { path: '/employee/dashboard', name: '従業員ダッシュボード' },
      { path: '/employee/shifts', name: 'シフト管理' }
    ];

    for (const page of frontendPages) {
      await testFrontendPage(page.path, page.name);
    }

    // 3. APIエンドポイントのテスト
    console.log('\n📝 ステップ 3: APIエンドポイントテスト');

    // 3.1 業態API
    const businessTypes = await testApiEndpoint('GET', '/business-types', '業態一覧取得', token);

    // 3.2 店舗API
    const stores = await testApiEndpoint('GET', '/stores', '店舗一覧取得', token);

    // 3.3 従業員API
    await testApiEndpoint('GET', '/employees', '従業員一覧取得', token);

    // 3.4 売上データAPI（店舗とデータがあればテスト）
    if (stores && stores.data && stores.data.length > 0) {
      const storeId = stores.data[0].id;
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;

      await testApiEndpoint(
        'GET',
        `/sales?year=${year}&month=${month}&storeId=${storeId}`,
        '売上データ取得',
        token
      );
    }

    // 3.5 P&LデータAPI
    if (stores && stores.data && stores.data.length > 0) {
      const storeId = stores.data[0].id;
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;

      await testApiEndpoint(
        'GET',
        `/pl?year=${year}&month=${month}&storeId=${storeId}`,
        'P&Lデータ取得',
        token
      );
    }

    // 3.6 支払いデータAPI
    if (stores && stores.data && stores.data.length > 0) {
      const storeId = stores.data[0].id;
      const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      await testApiEndpoint(
        'GET',
        `/payments?month=${month}&storeId=${storeId}`,
        '支払いデータ取得',
        token
      );
    }

    // 3.7 取引先API
    if (stores && stores.data && stores.data.length > 0) {
      const storeId = stores.data[0].id;
      await testApiEndpoint('GET', `/companies?storeId=${storeId}`, '取引先一覧取得', token);
    }

    // 3.8 シフトAPI
    if (stores && stores.data && stores.data.length > 0) {
      const storeId = stores.data[0].id;
      await testApiEndpoint('GET', `/shift-periods?storeId=${storeId}`, 'シフト期間一覧取得', token);
    }

    // 3.9 アクティビティログAPI
    await testApiEndpoint('GET', '/activity-logs?limit=10', 'アクティビティログ取得', token);

    // 4. データ作成テスト（必要に応じて）
    console.log('\n📝 ステップ 4: データ作成テスト');

    // 簡単なテストとして、既存データの確認のみ行う
    if (businessTypes && businessTypes.data) {
      testResults.passed.push(`✅ 業態データ件数: ${businessTypes.data.length}件`);
    }

    if (stores && stores.data) {
      testResults.passed.push(`✅ 店舗データ件数: ${stores.data.length}件`);
    }

  } catch (error) {
    testResults.failed.push(`❌ テスト実行エラー: ${error.message}`);
  }

  // 結果表示
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 テスト結果サマリー\n');

  console.log(`✅ 成功: ${testResults.passed.length}件`);
  console.log(`⚠️  警告: ${testResults.warnings.length}件`);
  console.log(`❌ 失敗: ${testResults.failed.length}件`);

  if (testResults.passed.length > 0) {
    console.log('\n✅ 成功したテスト:');
    testResults.passed.forEach(msg => console.log(`  ${msg}`));
  }

  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  警告:');
    testResults.warnings.forEach(msg => console.log(`  ${msg}`));
  }

  if (testResults.failed.length > 0) {
    console.log('\n❌ 失敗したテスト:');
    testResults.failed.forEach(msg => console.log(`  ${msg}`));
  }

  console.log('\n' + '='.repeat(80));

  if (testResults.failed.length > 0) {
    console.log('\n❌ テストに失敗したエラーがあります。修正が必要です。\n');
    process.exit(1);
  } else {
    console.log('\n✅ すべてのテストが正常に完了しました！\n');
    process.exit(0);
  }
}

// スクリプト実行
main();
