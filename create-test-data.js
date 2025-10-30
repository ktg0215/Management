/**
 * テストデータ作成スクリプト
 *
 * 作成内容:
 * - 業態3つ（カフェ、ラーメン、焼肉）
 * - 各業態に1店舗（計3店舗）
 * - 各店舗に3ヶ月分のテストデータ
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// 管理者でログインしてトークンを取得
async function login() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      employeeId: '0000',
      password: 'toyama2023'
    });

    console.log('✅ ログイン成功');
    console.log('📋 レスポンスデータキー:', Object.keys(response.data));

    // トークンの位置を特定
    const token = response.data.token || response.data.data?.token;
    console.log('📋 トークン存在確認:', !!token);
    if (token) {
      console.log('📋 トークンの最初の20文字:', token.substring(0, 20));
    } else {
      console.log('📋 レスポンス構造:', JSON.stringify(response.data, null, 2).substring(0, 200));
    }

    return token;
  } catch (error) {
    console.error('❌ ログイン失敗:', error.response?.data || error.message);
    throw error;
  }
}

// 業態を作成
async function createBusinessTypes(token) {
  const businessTypes = [
    { name: 'カフェ', description: 'カフェ・コーヒーショップ業態' },
    { name: 'ラーメン', description: 'ラーメン店業態' },
    { name: '焼肉', description: '焼肉店業態' }
  ];

  const createdTypes = [];

  for (const bt of businessTypes) {
    try {
      const response = await axios.post(
        `${API_URL}/business-types`,
        bt,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log(`✅ 業態作成: ${bt.name} (ID: ${response.data.data.id})`);
      createdTypes.push(response.data.data);
    } catch (error) {
      console.error(`❌ 業態作成失敗: ${bt.name}`);
      console.error(`   ステータス: ${error.response?.status}`);
      console.error(`   データ: ${JSON.stringify(error.response?.data)}`);
      console.error(`   メッセージ: ${error.message}`);

      if (error.response?.status === 409) {
        console.log(`⚠️  業態「${bt.name}」は既に存在します - 既存データ取得試行中...`);
        // 既存の業態を取得
        try {
          const existingResponse = await axios.get(`${API_URL}/business-types`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const existing = existingResponse.data.data.find(t => t.name === bt.name);
          if (existing) {
            console.log(`   ✅ 既存業態を取得: ${existing.name} (ID: ${existing.id})`);
            createdTypes.push(existing);
          }
        } catch (getError) {
          console.error(`   ❌ 既存業態の取得にも失敗:`, getError.response?.data || getError.message);
        }
      }
    }
  }

  return createdTypes;
}

// 店舗を作成
async function createStores(token, businessTypes) {
  const stores = [
    { name: '珈琲館　渋谷店', businessTypeId: businessTypes.find(bt => bt.name === 'カフェ')?.id },
    { name: '麺屋　一番', businessTypeId: businessTypes.find(bt => bt.name === 'ラーメン')?.id },
    { name: '焼肉　大将', businessTypeId: businessTypes.find(bt => bt.name === '焼肉')?.id }
  ];

  const createdStores = [];

  for (const store of stores) {
    if (!store.businessTypeId) {
      console.error(`❌ 店舗「${store.name}」の業態IDが見つかりません`);
      continue;
    }

    try {
      const response = await axios.post(
        `${API_URL}/stores`,
        store,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log(`✅ 店舗作成: ${store.name} (ID: ${response.data.data.id})`);
      createdStores.push(response.data.data);
    } catch (error) {
      console.error(`❌ 店舗作成失敗: ${store.name}`, error.response?.data || error.message);
    }
  }

  return createdStores;
}

// 各店舗に3ヶ月分の売上データを作成
async function createSalesData(token, stores) {
  const today = new Date();
  const months = [
    { year: today.getFullYear(), month: today.getMonth() + 1 },
    { year: today.getFullYear(), month: today.getMonth() },
    { year: today.getFullYear(), month: today.getMonth() - 1 }
  ].map(({ year, month }) => {
    if (month <= 0) {
      return { year: year - 1, month: 12 + month };
    }
    return { year, month };
  });

  console.log('\n📊 売上データ作成開始...');

  for (const store of stores) {
    console.log(`\n店舗: ${store.name}`);

    for (const { year, month } of months) {
      // 月の日数を取得
      const daysInMonth = new Date(year, month, 0).getDate();

      console.log(`  ${year}年${month}月のデータ作成中...`);

      // 月全体のデータを1つのオブジェクトに集約
      const dailyData = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // ランダムな売上データ
        const baseAmount = 100000 + Math.random() * 200000;
        dailyData[date] = {
          date: date,
          storeNetSales: Math.floor(baseAmount),
          creditCardSales: Math.floor(baseAmount * 0.4),
          cashSales: Math.floor(baseAmount * 0.3),
          emoneyPayment: Math.floor(baseAmount * 0.2),
          qrCodePayment: Math.floor(baseAmount * 0.1),
          otherSales: 0,
          partTimeWages: Math.floor(baseAmount * 0.15),
          cost: Math.floor(baseAmount * 0.30),
          cardPoints: Math.floor(baseAmount * 0.02),
          variableCost1: 0,
          variableCost2: 0,
          variableCost3: 0,
          rent: Math.floor(200000),
          utilities: Math.floor(30000 + Math.random() * 20000),
          advertising: Math.floor(50000 + Math.random() * 30000),
          communication: Math.floor(10000 + Math.random() * 5000),
          fixedCost1: 0,
          fixedCost2: 0,
          fixedCost3: 0,
          other: Math.floor(10000 + Math.random() * 10000)
        };
      }

      // 月全体のデータを一度に送信
      try {
        await axios.post(
          `${API_URL}/sales`,
          {
            year: year,
            month: month,
            storeId: store.id,
            dailyData: dailyData
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        console.log(`  ✅ ${year}年${month}月: ${daysInMonth}日分作成完了`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`  ⚠️  ${year}年${month}月のデータは既に存在します`);
        } else {
          console.error(`  ❌ ${year}年${month}月のデータ作成失敗:`, error.response?.data || error.message);
        }
      }
    }
  }
}

// P&Lデータを作成
async function createPLData(token, stores) {
  const today = new Date();
  const months = [
    { year: today.getFullYear(), month: today.getMonth() + 1 },
    { year: today.getFullYear(), month: today.getMonth() },
    { year: today.getFullYear(), month: today.getMonth() - 1 }
  ].map(({ year, month }) => {
    if (month <= 0) {
      return { year: year - 1, month: 12 + month };
    }
    return { year, month };
  });

  console.log('\n📈 P&Lデータ作成開始...');

  for (const store of stores) {
    console.log(`\n店舗: ${store.name}`);

    for (const { year, month } of months) {
      // P&Lデータ項目を作成
      const items = [
        { name: '売上高', estimate: 10000000, actual: 9000000, is_highlighted: true, type: 'variable' },
        { name: '変動費合計', estimate: 0, actual: 0, is_subtotal: true, type: 'variable' },
        { name: 'バイト給与', estimate: 1600000, actual: 1500000, is_indented: true, type: 'variable' },
        { name: '原価', estimate: 2800000, actual: 2700000, is_indented: true, type: 'variable' },
        { name: 'カードポイント', estimate: 200000, actual: 180000, is_indented: true, type: 'variable' },
        { name: '限界利益', estimate: 0, actual: 0, is_subtotal: true, type: 'variable' },
        { name: '固定費合計', estimate: 0, actual: 0, is_subtotal: true, type: 'fixed' },
        { name: '正社員給与', estimate: 2000000, actual: 2000000, is_indented: true, type: 'fixed' },
        { name: '賃料', estimate: 600000, actual: 600000, is_indented: true, type: 'fixed' },
        { name: '水道光熱費', estimate: 1000000, actual: 900000, is_indented: true, type: 'fixed' },
        { name: '広告宣伝費', estimate: 1600000, actual: 1500000, is_indented: true, type: 'fixed' },
        { name: '通信費', estimate: 300000, actual: 300000, is_indented: true, type: 'fixed' },
        { name: '営業利益', estimate: 0, actual: 0, is_highlighted: true }
      ];

      const plData = {
        storeId: store.id,
        year: year,
        month: month,
        items: items
      };

      try {
        await axios.post(
          `${API_URL}/pl`,
          plData,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        console.log(`  ✅ ${year}年${month}月のP&Lデータ作成完了`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`  ⚠️  ${year}年${month}月のP&Lデータは既に存在します`);
        } else {
          console.error(`  ❌ ${year}年${month}月のP&Lデータ作成失敗:`, error.response?.data || error.message);
        }
      }
    }
  }
}

// メイン処理
async function main() {
  console.log('🚀 テストデータ作成開始\n');
  console.log('=' .repeat(60));

  try {
    // 1. ログイン
    console.log('\n📝 ステップ 1: ログイン');
    const token = await login();

    // 2. 業態作成
    console.log('\n📝 ステップ 2: 業態作成');
    const businessTypes = await createBusinessTypes(token);
    console.log(`\n業態作成完了: ${businessTypes.length}件`);

    // 3. 店舗作成
    console.log('\n📝 ステップ 3: 店舗作成');
    const stores = await createStores(token, businessTypes);
    console.log(`\n店舗作成完了: ${stores.length}件`);

    if (stores.length === 0) {
      console.error('\n❌ 店舗が作成されませんでした。処理を中止します。');
      return;
    }

    // 4. 売上データ作成
    console.log('\n📝 ステップ 4: 売上データ作成');
    await createSalesData(token, stores);

    // 5. P&Lデータ作成
    console.log('\n📝 ステップ 5: P&Lデータ作成');
    await createPLData(token, stores);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ すべてのテストデータ作成が完了しました！\n');
    console.log('作成されたデータ:');
    console.log(`  - 業態: ${businessTypes.length}件`);
    console.log(`  - 店舗: ${stores.length}件`);
    console.log(`  - 売上データ: 各店舗3ヶ月分（約90日分/店舗）`);
    console.log(`  - P&Lデータ: 各店舗3ヶ月分`);
    console.log('');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

// スクリプト実行
main();
