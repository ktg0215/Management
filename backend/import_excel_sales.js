const XLSX = require('xlsx');
const path = require('path');
const { Pool } = require('pg');

// データベース接続
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'shift_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123'
});

// Excelの列番号とシステムのフィールドキーのマッピング (24年度シート用)
const COLUMN_MAPPING = {
  0: 'date',                    // 日付
  1: 'dayOfWeek',               // 曜日
  2: 'salesTarget',             // 売上目標
  3: 'targetCumulative',        // 目標累計
  4: 'targetRatio',             // 対目標比
  5: 'yearOverYear',            // 前年比
  6: 'edwYearOverYear',         // EDW前年比
  7: 'ohbYearOverYear',         // OHB前年比
  8: 'aggregator',              // 集計担当者
  9: 'netSales',                // 店舗純売上
  10: 'netSalesCumulative',     // 店舗純売上累計
  11: 'edwNetSales',            // EDW純売上
  12: 'edwNetSalesCumulative',  // EDW純売上累計
  13: 'ohbNetSales',            // OHB純売上
  14: 'ohbNetSalesCumulative',  // OHB純売上累計
  15: 'totalGroups',            // 組数（計）
  16: 'totalCustomers',         // 客数（計）
  17: 'groupUnitPrice',         // 組単価
  18: 'customerUnitPrice',      // 客単価
  // 人件費関連 (19-27)
  19: 'katougi',                // 加藤木
  20: 'ishimori',               // 石森
  21: 'osawa',                  // 大澤
  22: 'washizuka',              // 鷲塚
  23: 'employeeHours',          // 社員時間
  24: 'asHours',                // AS時間
  25: 'salesPerHour',           // 人時売上高
  26: 'laborCost',              // 人件費額
  27: 'laborCostRate',          // 人件費率
  // EDW営業明細 (28-36)
  28: 'lunchSales',             // L：売上
  29: 'dinnerSales',            // D：売上
  30: 'lunchCustomers',         // L：客数
  31: 'dinnerCustomers',        // D：客数
  32: 'lunchGroups',            // L：組数
  33: 'dinnerGroups',           // D：組数
  34: 'edwCustomerUnitPrice',   // 客単価
  35: 'lunchUnitPrice',         // L：単価
  36: 'dinnerUnitPrice',        // D：単価
  // OHB (37-40)
  37: 'ohbSales',               // 売上
  38: 'ohbCustomers',           // 客数
  39: 'ohbGroups',              // 組数
  40: 'ohbCustomerUnitPrice',   // 客単価
  // VOID関連 (41-43)
  41: 'voidCount',              // VOID件数
  42: 'voidAmount',             // VOID金額
  43: 'salesDiscrepancy',       // 売上金過不足
  // 生産性 (44-49)
  44: 'totalHours',             // 総時間
  45: 'edwBaitHours',           // EDWバイト時間
  46: 'ohbBaitHours',           // OHBバイト時間
  47: 'edwProductivity',        // EDW生産性
  48: 'ohbProductivity',        // OHB生産性
  49: 'totalProductivity',      // 総生産性
  // OHB予約 (50-53)
  50: 'reservationCount',       // 予約件数
  51: 'plain',                  // プレーン
  52: 'junsei',                 // 純生
  53: 'seasonal',               // 季節
  // アンケート (61-62)
  61: 'surveyCount',            // 取得枚数
  62: 'surveyRate'              // 取得率
};

// Excelの日付シリアル値をJavaScriptの日付に変換
function excelDateToJSDate(serial) {
  if (typeof serial === 'number') {
    // Excelの日付シリアル値（1900年1月1日からの日数）
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info;
  }
  return null;
}

// 曜日を取得
function getDayOfWeek(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

async function importExcelData() {
  console.log('=== Excelデータインポート開始 ===\n');

  // Excelファイルを読み込む
  const filePath = path.join(__dirname, '..', '計数管理表2024【EDW富山】.xlsx');
  console.log('ファイル読み込み:', filePath);

  const workbook = XLSX.readFile(filePath);

  // 処理するシートと対応する年度範囲（年度は6月〜翌年5月）
  const sheets = [
    { name: '23年度', startYear: 2023, startMonth: 6, endYear: 2024, endMonth: 5 },
    { name: '24年度', startYear: 2024, startMonth: 6, endYear: 2025, endMonth: 5 },
    { name: '25年度', startYear: 2025, startMonth: 6, endYear: 2026, endMonth: 5 }
  ];

  // 月ごとにデータを集計
  const monthlyData = {};

  for (const sheetInfo of sheets) {
    const sheet = workbook.Sheets[sheetInfo.name];

    if (!sheet) {
      console.error(`${sheetInfo.name}シートが見つかりません`);
      continue;
    }

    // シートをJSONに変換
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    console.log(`シート "${sheetInfo.name}" を読み込みました`);
    console.log(`総行数: ${data.length}`);

    // データ行は3行目から開始 (0-indexed で 3)
    const dataStartRow = 3;

    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      // 日付を取得
      const dateValue = row[0];
      if (!dateValue || typeof dateValue !== 'number') continue;

      const date = excelDateToJSDate(dateValue);
      if (!date) continue;

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();

      // 該当年度範囲のデータのみ処理（年度は6月〜翌年5月）
      const isInRange = (
        (year === sheetInfo.startYear && month >= sheetInfo.startMonth) ||
        (year === sheetInfo.endYear && month <= sheetInfo.endMonth) ||
        (year > sheetInfo.startYear && year < sheetInfo.endYear)
      );
      if (!isInRange) continue;

      const monthKey = `${year}-${month}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          year,
          month,
          days: {}
        };
      }

      // 日次データを作成
      const dayData = {};

      for (const [colIndex, fieldKey] of Object.entries(COLUMN_MAPPING)) {
        const value = row[parseInt(colIndex)];
        if (value !== null && value !== undefined && value !== '') {
          // 日付の場合はフォーマット
          if (fieldKey === 'date') {
            dayData[fieldKey] = `${month}/${day}`;
          } else if (fieldKey === 'dayOfWeek') {
            dayData[fieldKey] = getDayOfWeek(date);
          } else {
            // 数値の場合の処理
            if (typeof value === 'number') {
              // 比率系はパーセンテージに変換（小数点2桁）
              if (fieldKey.includes('Rate') || fieldKey.includes('Ratio') || fieldKey.includes('YearOverYear')) {
                dayData[fieldKey] = Math.round(value * 10000) / 100; // パーセンテージに変換
              }
              // 単価・生産性は小数点2桁
              else if (fieldKey.includes('Productivity') || fieldKey.includes('UnitPrice') || fieldKey.includes('PerHour')) {
                dayData[fieldKey] = Math.round(value * 100) / 100;
              }
              // 時間関連は小数点2桁を保持
              else if (fieldKey.includes('Hours') || fieldKey.includes('時間') ||
                       fieldKey === 'katougi' || fieldKey === 'ishimori' ||
                       fieldKey === 'osawa' || fieldKey === 'washizuka') {
                dayData[fieldKey] = Math.round(value * 100) / 100;
              }
              // 金額・人数は整数に
              else {
                dayData[fieldKey] = Math.round(value);
              }
            } else {
              dayData[fieldKey] = value;
            }
          }
        }
      }

      // 空のデータは保存しない
      if (Object.keys(dayData).length > 2) { // date と dayOfWeek 以外にデータがある場合
        monthlyData[monthKey].days[day] = dayData;
      }
    }
  }

  console.log('\n月別データ集計完了:');
  for (const [monthKey, data] of Object.entries(monthlyData)) {
    console.log(`  ${monthKey}: ${Object.keys(data.days).length}日分`);
  }
  console.log('');

  // データベースに保存
  const client = await pool.connect();
  try {
    // 店舗IDを取得（EDW富山二口店）
    // まず店舗が存在するか確認
    const storeResult = await client.query(
      "SELECT id FROM stores WHERE name LIKE '%富山%' OR name LIKE '%EDW%' LIMIT 1"
    );

    let storeId;
    if (storeResult.rows.length === 0) {
      // 店舗が存在しない場合は作成
      console.log('店舗が見つかりません。新規作成します...');
      const insertResult = await client.query(
        "INSERT INTO stores (name, address, business_type_id) VALUES ($1, $2, $3) RETURNING id",
        ['EDW富山二口店', '富山県', 1]
      );
      storeId = insertResult.rows[0].id;
      console.log(`店舗を作成しました: ID=${storeId}\n`);
    } else {
      storeId = storeResult.rows[0].id;
      console.log(`既存の店舗を使用: ID=${storeId}\n`);
    }

    // 各月のデータを保存
    let savedCount = 0;
    for (const [monthKey, monthData] of Object.entries(monthlyData)) {
      const { year, month, days } = monthData;

      // UPSERT (存在する場合は更新、しない場合は挿入)
      const query = `
        INSERT INTO sales_data (store_id, year, month, daily_data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (store_id, year, month)
        DO UPDATE SET daily_data = $4, updated_at = NOW()
        RETURNING id
      `;

      const result = await client.query(query, [storeId, year, month, JSON.stringify(days)]);
      console.log(`保存: ${year}年${month}月 (ID: ${result.rows[0].id})`);
      savedCount++;
    }

    console.log(`\n=== インポート完了 ===`);
    console.log(`保存した月数: ${savedCount}`);

  } catch (error) {
    console.error('データベースエラー:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 実行
importExcelData().catch(console.error);
