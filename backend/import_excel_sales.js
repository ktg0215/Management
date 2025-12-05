const XLSX = require('xlsx');
const path = require('path');
const { Pool } = require('pg');

// データベース接続
// Windows環境では host.docker.internal を使用してDockerコンテナに接続
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'shift_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  // 接続タイムアウトを長めに設定
  connectionTimeoutMillis: 30000,
  // SSLを無効化（ローカル開発環境）
  ssl: false
};

console.log('データベース接続設定:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: '***'
});

const pool = new Pool(dbConfig);

// 項目名からフィールドキーへのマッピング
const HEADER_TO_FIELD = {
  '日付': 'date',
  '曜': 'dayOfWeek',
  '売上目標': 'salesTarget',
  '目標累計': 'targetCumulative',
  '対目標比': 'targetRatio',
  '前年比': 'yearOverYear',
  'EDW前年比': 'edwYearOverYear',
  'OHB前年比': 'ohbYearOverYear',
  '集計担当者': 'aggregator',
  '店舗純売上': 'netSales',
  '店舗純売上累計': 'netSalesCumulative',
  'EDW純売上': 'edwNetSales',
  'EDW純売上累計': 'edwNetSalesCumulative',
  'OHB純売上': 'ohbNetSales',
  'OHB純売上累計': 'ohbNetSalesCumulative',
  '組数（計）': 'totalGroups',
  '客数（計）': 'totalCustomers',
  '組単価': 'groupUnitPrice',
  '客単価': 'customerUnitPrice',
  // 人名（時間）
  '加藤木': 'katougi',
  '石森': 'ishimori',
  '大澤': 'osawa',
  '鷲塚': 'washizuka',
  '渡邉': 'watanabe',
  '役員時間': 'executiveHours',
  '社員時間': 'employeeHours',
  'AS時間': 'asHours',
  '人時売上高': 'salesPerHour',
  '人件費額': 'laborCost',
  '人件費率': 'laborCostRate',
  // EDW営業明細
  'L：売上': 'lunchSales',
  'D：売上': 'dinnerSales',
  'L：客数': 'lunchCustomers',
  'D：客数': 'dinnerCustomers',
  'L：組数': 'lunchGroups',
  'D：組数': 'dinnerGroups',
  'L：単価': 'lunchUnitPrice',
  'D：単価': 'dinnerUnitPrice',
  // OHB
  '売上': 'ohbSales',
  '客数': 'ohbCustomers',
  '組数': 'ohbGroups',
  // VOID関連
  'VOID件数': 'voidCount',
  'VOID金額': 'voidAmount',
  '売上金過不足': 'salesDiscrepancy',
  // 生産性
  '総時間': 'totalHours',
  'EDＷﾊﾞｲﾄ時間': 'edwBaitHours',
  'OHBﾊﾞｲﾄ時間': 'ohbBaitHours',
  'EDW生産性': 'edwProductivity',
  'OHB生産性': 'ohbProductivity',
  '総生産性': 'totalProductivity',
  // OHB予約
  '予約件数': 'reservationCount',
  'プレーン': 'plain',
  '純生': 'junsei',
  '季節': 'seasonal',
  // アンケート
  '取得枚数': 'surveyCount',
  '取得率': 'surveyRate',
  // その他
  'Uber': 'uberSales'
};

// ヘッダー行から列番号とフィールドキーのマッピングを作成
function createColumnMapping(headerRow) {
  const mapping = {};

  for (let i = 0; i < headerRow.length; i++) {
    let headerName = headerRow[i];
    if (!headerName) continue;

    // 改行を除去
    headerName = headerName.toString().replace(/\n/g, '').trim();

    // マッピングを検索
    const fieldKey = HEADER_TO_FIELD[headerName];
    if (fieldKey) {
      mapping[i] = fieldKey;
    } else {
      // 部分一致で検索
      for (const [key, value] of Object.entries(HEADER_TO_FIELD)) {
        if (headerName.includes(key) || key.includes(headerName)) {
          mapping[i] = value;
          break;
        }
      }
    }
  }

  return mapping;
}

// Excelの日付シリアル値をJavaScriptの日付に変換
function excelDateToJSDate(serial) {
  if (typeof serial === 'number') {
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

// 数値の処理
function processNumericValue(fieldKey, value) {
  if (typeof value !== 'number') return value;

  // 比率系はパーセンテージに変換（小数点2桁）
  if (fieldKey.includes('Rate') || fieldKey.includes('Ratio') || fieldKey.includes('YearOverYear')) {
    return Math.round(value * 10000) / 100;
  }
  // 単価・生産性は小数点2桁
  if (fieldKey.includes('Productivity') || fieldKey.includes('UnitPrice') || fieldKey.includes('PerHour')) {
    return Math.round(value * 100) / 100;
  }
  // 時間関連は小数点2桁を保持
  if (fieldKey.includes('Hours') || fieldKey.includes('時間') ||
      fieldKey === 'katougi' || fieldKey === 'ishimori' ||
      fieldKey === 'osawa' || fieldKey === 'washizuka' ||
      fieldKey === 'watanabe' || fieldKey === 'executiveHours') {
    return Math.round(value * 100) / 100;
  }
  // 金額・人数は整数に
  return Math.round(value);
}

// 日付をYYYY-MM-DD形式に変換
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function importExcelData() {
  console.log('=== Excelデータインポート開始 ===\n');

  // Excelファイルを読み込む
  const filePath = path.join(__dirname, '..', '計数管理表2024【EDW富山】.xlsx');
  console.log('ファイル読み込み:', filePath);

  // ファイル存在確認
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    console.error('❌ エラー: Excelファイルが見つかりません:', filePath);
    console.error('   ファイルパスを確認してください');
    process.exit(1);
  }

  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (error) {
    console.error('❌ エラー: Excelファイルの読み込みに失敗しました:', error.message);
    process.exit(1);
  }

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

    // ヘッダー行（3行目、0-indexed で 2）から列マッピングを作成
    const headerRow = data[2];
    const columnMapping = createColumnMapping(headerRow);

    console.log(`  マッピングされた列数: ${Object.keys(columnMapping).length}`);

    // データ行は4行目から開始 (0-indexed で 3)
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
      const dayData = {
        date: formatDate(date),
        dayOfWeek: getDayOfWeek(date)
      };

      for (const [colIndex, fieldKey] of Object.entries(columnMapping)) {
        const value = row[parseInt(colIndex)];
        if (value !== null && value !== undefined && value !== '') {
          // dateとdayOfWeekは既に設定済み
          if (fieldKey === 'date' || fieldKey === 'dayOfWeek') continue;

          dayData[fieldKey] = processNumericValue(fieldKey, value);
        }
      }

      // netSalesフィールドの検証（netSalesが0の場合は許可）
      // netSalesが存在しない場合は0を設定
      if (dayData.netSales === undefined || dayData.netSales === null || dayData.netSales === '') {
        dayData.netSales = 0;
      }

      // netSalesが数値でない場合は0に変換
      if (typeof dayData.netSales !== 'number') {
        const numValue = parseFloat(dayData.netSales);
        if (isNaN(numValue)) {
          dayData.netSales = 0;
        } else {
          dayData.netSales = numValue;
        }
      }

      // 空のデータは保存しない（date と dayOfWeek 以外にデータがある場合）
      if (Object.keys(dayData).length > 2) {
        monthlyData[monthKey].days[day] = dayData;
      }
    }
  }

  console.log('\n月別データ集計完了:');
  for (const [monthKey, data] of Object.entries(monthlyData)) {
    console.log(`  ${monthKey}: ${Object.keys(data.days).length}日分`);
  }
  console.log('');

  // データ検証
  if (Object.keys(monthlyData).length === 0) {
    console.error('❌ エラー: インポート可能なデータがありません');
    console.error('   シート名、データ開始行、列マッピングを確認してください');
    process.exit(1);
  }

  // 各月のデータにnetSalesが含まれているか確認
  let validationErrors = [];
  for (const [monthKey, monthData] of Object.entries(monthlyData)) {
    const { year, month, days } = monthData;
    let missingNetSalesDays = [];
    
    for (const [day, dayData] of Object.entries(days)) {
      if (!dayData.netSales && dayData.netSales !== 0) {
        missingNetSalesDays.push(day);
      }
    }
    
    if (missingNetSalesDays.length > 0) {
      validationErrors.push(`${year}年${month}月: ${missingNetSalesDays.length}日分のデータにnetSalesがありません (日: ${missingNetSalesDays.join(', ')})`);
    }
  }

  if (validationErrors.length > 0) {
    console.error('\n❌ データ検証エラー:');
    validationErrors.forEach(err => console.error(`   - ${err}`));
    console.error('\nインポートを続行しますが、データが不完全な可能性があります。\n');
  }

  // データベースに保存
  let client;
  let retries = 3;
  let connected = false;
  
  while (retries > 0 && !connected) {
    try {
      client = await pool.connect();
      // データベース接続確認
      await client.query('SELECT 1');
      console.log('✅ データベース接続成功\n');
      connected = true;
    } catch (error) {
      retries--;
      console.error(`❌ データベース接続エラー (残り試行回数: ${retries}):`, error.message);
      if (retries > 0) {
        console.log('5秒後に再試行します...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        throw error;
      }
    }
  }
  
  try {

    // 店舗IDを取得（EDW富山二口店）
    let storeResult;
    try {
      storeResult = await client.query(
        "SELECT id FROM stores WHERE name LIKE '%富山%' OR name LIKE '%EDW%' LIMIT 1"
      );
    } catch (error) {
      console.error('❌ エラー: 店舗検索に失敗しました:', error.message);
      throw error;
    }

    let storeId;
    if (storeResult.rows.length === 0) {
      console.log('店舗が見つかりません。新規作成します...');
      try {
        const insertResult = await client.query(
          "INSERT INTO stores (name, address, business_type_id) VALUES ($1, $2, $3) RETURNING id",
          ['EDW富山二口店', '富山県', 1]
        );
        storeId = insertResult.rows[0].id;
        console.log(`✅ 店舗を作成しました: ID=${storeId}\n`);
      } catch (error) {
        console.error('❌ エラー: 店舗の作成に失敗しました:', error.message);
        throw error;
      }
    } else {
      storeId = storeResult.rows[0].id;
      console.log(`✅ 既存の店舗を使用: ID=${storeId}\n`);
    }

    // トランザクション開始
    await client.query('BEGIN');

    // 各月のデータを保存
    let savedCount = 0;
    let errorCount = 0;
    const savedMonths = [];

    for (const [monthKey, monthData] of Object.entries(monthlyData)) {
      const { year, month, days } = monthData;

      try {
        // sales_dataテーブルへのUPSERT
        const salesQuery = `
          INSERT INTO sales_data (store_id, year, month, daily_data, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT (store_id, year, month)
          DO UPDATE SET daily_data = $4, updated_at = NOW()
          RETURNING id
        `;

        const salesResult = await client.query(salesQuery, [storeId, year, month, JSON.stringify(days)]);
        console.log(`✅ sales_data保存: ${year}年${month}月 (ID: ${salesResult.rows[0].id})`);

        // monthly_salesテーブルへの自動同期
        try {
          const monthlyQuery = `
            INSERT INTO monthly_sales (store_id, year, month, daily_data, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (store_id, year, month)
            DO UPDATE SET daily_data = $4, updated_at = NOW()
            RETURNING id
          `;

          const monthlyResult = await client.query(monthlyQuery, [storeId, year, month, JSON.stringify(days)]);
          console.log(`✅ monthly_sales同期: ${year}年${month}月 (ID: ${monthlyResult.rows[0].id})`);
        } catch (syncError) {
          console.error(`⚠️  警告: monthly_salesへの同期でエラー (${year}年${month}月):`, syncError.message);
          // メイン処理は成功しているので続行
        }

        savedCount++;
        savedMonths.push(`${year}年${month}月`);
      } catch (error) {
        console.error(`❌ エラー: ${year}年${month}月の保存に失敗しました:`, error.message);
        errorCount++;
      }
    }

    // トランザクションコミット
    if (errorCount === 0) {
      await client.query('COMMIT');
      console.log(`\n✅ === インポート完了 ===`);
      console.log(`保存した月数: ${savedCount}`);
      console.log(`保存した月: ${savedMonths.join(', ')}`);
    } else {
      await client.query('ROLLBACK');
      console.error(`\n❌ === インポート失敗 ===`);
      console.error(`成功: ${savedCount}件, 失敗: ${errorCount}件`);
      throw new Error(`${errorCount}件のエラーが発生しました`);
    }

  } catch (error) {
    console.error('\n❌ データベースエラー:', error.message);
    console.error('スタックトレース:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 実行
importExcelData().catch(error => {
  console.error('\n❌ 致命的なエラーが発生しました:');
  console.error(error);
  process.exit(1);
});
