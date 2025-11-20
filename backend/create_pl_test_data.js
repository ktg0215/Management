const { Pool } = require('pg');

// データベース接続
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'shift_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123'
});

// P&Lテストデータを生成
function generatePLData(year, month, baseMultiplier = 1) {
  // 月によって季節変動を加える
  const seasonalFactor = 1 + (Math.sin((month - 3) * Math.PI / 6) * 0.15);
  const randomFactor = () => 0.95 + Math.random() * 0.1;

  // 基本売上（月500万〜800万程度）
  const baseSales = Math.round(6000000 * baseMultiplier * seasonalFactor * randomFactor());

  // EDW/OHB比率（7:3程度）
  const edwSales = Math.round(baseSales * 0.7 * randomFactor());
  const ohbSales = baseSales - edwSales;

  // 原価率（28-32%）
  const foodCostRate = 0.28 + Math.random() * 0.04;
  const foodCost = Math.round(baseSales * foodCostRate);

  // 人件費率（25-30%）
  const laborCostRate = 0.25 + Math.random() * 0.05;
  const laborCost = Math.round(baseSales * laborCostRate);

  // その他経費
  const rent = Math.round(450000 * randomFactor()); // 家賃
  const utilities = Math.round(120000 * seasonalFactor * randomFactor()); // 水道光熱費
  const advertising = Math.round(80000 * randomFactor()); // 広告宣伝費
  const supplies = Math.round(60000 * randomFactor()); // 消耗品費
  const maintenance = Math.round(40000 * randomFactor()); // 修繕費
  const insurance = Math.round(30000 * randomFactor()); // 保険料
  const communication = Math.round(25000 * randomFactor()); // 通信費
  const depreciation = Math.round(150000 * randomFactor()); // 減価償却費
  const otherExpenses = Math.round(100000 * randomFactor()); // その他経費

  // 経費合計
  const totalExpenses = foodCost + laborCost + rent + utilities + advertising +
                        supplies + maintenance + insurance + communication +
                        depreciation + otherExpenses;

  // 営業利益
  const operatingProfit = baseSales - totalExpenses;
  const operatingProfitRate = operatingProfit / baseSales;

  // 償却前利益
  const profitBeforeDepreciation = operatingProfit + depreciation;

  // 目標値（実績の±10%程度）
  const targetSales = Math.round(baseSales * (0.95 + Math.random() * 0.1));
  const targetProfit = Math.round(operatingProfit * (0.9 + Math.random() * 0.2));

  // 前年値（今年の90-110%程度）
  const prevYearSales = Math.round(baseSales * (0.9 + Math.random() * 0.2));
  const prevYearProfit = Math.round(operatingProfit * (0.85 + Math.random() * 0.3));

  return {
    // 売上
    totalSales: baseSales,
    edwSales: edwSales,
    ohbSales: ohbSales,

    // 目標・前年比較
    targetSales: targetSales,
    prevYearSales: prevYearSales,
    salesAchievementRate: Math.round((baseSales / targetSales) * 10000) / 100,
    salesYoYRate: Math.round((baseSales / prevYearSales) * 10000) / 100,

    // 原価
    foodCost: foodCost,
    foodCostRate: Math.round(foodCostRate * 10000) / 100,

    // 人件費
    laborCost: laborCost,
    laborCostRate: Math.round(laborCostRate * 10000) / 100,
    employeeCount: Math.round(8 + Math.random() * 4),
    partTimeHours: Math.round(400 + Math.random() * 200),

    // 経費明細
    rent: rent,
    utilities: utilities,
    advertising: advertising,
    supplies: supplies,
    maintenance: maintenance,
    insurance: insurance,
    communication: communication,
    depreciation: depreciation,
    otherExpenses: otherExpenses,

    // FL比率
    flCost: foodCost + laborCost,
    flCostRate: Math.round((foodCost + laborCost) / baseSales * 10000) / 100,

    // 利益
    grossProfit: baseSales - foodCost,
    grossProfitRate: Math.round((baseSales - foodCost) / baseSales * 10000) / 100,
    operatingProfit: operatingProfit,
    operatingProfitRate: Math.round(operatingProfitRate * 10000) / 100,
    profitBeforeDepreciation: profitBeforeDepreciation,
    profitBeforeDepreciationRate: Math.round(profitBeforeDepreciation / baseSales * 10000) / 100,

    // 目標利益
    targetProfit: targetProfit,
    prevYearProfit: prevYearProfit,
    profitAchievementRate: Math.round((operatingProfit / targetProfit) * 10000) / 100,

    // 客数・単価
    totalCustomers: Math.round(3000 + Math.random() * 1000),
    customerUnitPrice: Math.round(baseSales / (3000 + Math.random() * 1000)),

    // 在庫
    beginningInventory: Math.round(300000 + Math.random() * 100000),
    endingInventory: Math.round(280000 + Math.random() * 120000),
    inventoryTurnover: Math.round((5 + Math.random() * 3) * 100) / 100
  };
}

async function createPLTestData() {
  console.log('=== P&L テストデータ作成開始 ===\n');

  const client = await pool.connect();

  try {
    // 店舗を取得
    const storesResult = await client.query(
      "SELECT id, name FROM stores WHERE name LIKE '%富山%' OR name LIKE '%EDW%' LIMIT 1"
    );

    if (storesResult.rows.length === 0) {
      console.error('対象店舗が見つかりません');
      return;
    }

    const store = storesResult.rows[0];
    console.log(`対象店舗: ${store.name} (ID: ${store.id})\n`);

    // 2024年の各月のデータを作成
    const year = 2024;
    let savedCount = 0;

    for (let month = 1; month <= 12; month++) {
      const plData = generatePLData(year, month);

      const query = `
        INSERT INTO pl_data (store_id, year, month, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (store_id, year, month)
        DO UPDATE SET data = $4, updated_at = NOW()
        RETURNING id
      `;

      const result = await client.query(query, [
        store.id,
        year,
        month,
        JSON.stringify(plData)
      ]);

      console.log(`保存: ${year}年${month}月 - 売上: ¥${plData.totalSales.toLocaleString()}, 営業利益: ¥${plData.operatingProfit.toLocaleString()} (${plData.operatingProfitRate}%)`);
      savedCount++;
    }

    // 2025年1-11月のデータも作成
    const currentYear = 2025;
    for (let month = 1; month <= 11; month++) {
      const plData = generatePLData(currentYear, month, 1.05); // 前年比5%増

      const query = `
        INSERT INTO pl_data (store_id, year, month, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (store_id, year, month)
        DO UPDATE SET data = $4, updated_at = NOW()
        RETURNING id
      `;

      const result = await client.query(query, [
        store.id,
        currentYear,
        month,
        JSON.stringify(plData)
      ]);

      console.log(`保存: ${currentYear}年${month}月 - 売上: ¥${plData.totalSales.toLocaleString()}, 営業利益: ¥${plData.operatingProfit.toLocaleString()} (${plData.operatingProfitRate}%)`);
      savedCount++;
    }

    console.log(`\n=== 完了 ===`);
    console.log(`作成したデータ: ${savedCount}ヶ月分`);

  } catch (error) {
    console.error('エラー:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 実行
createPLTestData().catch(console.error);
