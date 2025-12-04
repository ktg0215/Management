// 新しいtoyama_weather_data.csv/xlsxファイルから天気データをインポートするスクリプト
// 店舗ID 1（富山二口店）の天気データをインポート

import dotenv from 'dotenv';
import { Pool } from 'pg';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

// ファイルパス（プロジェクトルートからの相対パス）
// 複数のパスを試す
const possibleRoots = [
  path.resolve(__dirname, '../..'), // backend/src/scripts/ から見た相対パス
  path.resolve(__dirname, '../../..'), // backend/src/scripts/ から見た相対パス（もう一段上）
  process.cwd(), // 現在の作業ディレクトリ
];

let PROJECT_ROOT = '';
for (const root of possibleRoots) {
  const testPath = path.join(root, 'toyama_weather_data.csv');
  if (fs.existsSync(testPath)) {
    PROJECT_ROOT = root;
    console.log(`プロジェクトルートを検出: ${PROJECT_ROOT}`);
    break;
  }
}

if (!PROJECT_ROOT) {
  console.error('プロジェクトルートが見つかりません。試したパス:');
  possibleRoots.forEach(r => console.error(`  - ${r}`));
  console.error(`__dirname: ${__dirname}`);
  console.error(`process.cwd(): ${process.cwd()}`);
}

const CSV_FILE_PATH = PROJECT_ROOT ? path.join(PROJECT_ROOT, 'toyama_weather_data.csv') : '';
const EXCEL_FILE_PATH = PROJECT_ROOT ? path.join(PROJECT_ROOT, 'toyama_weather_data.xlsx') : '';

// 店舗ID 1（富山二口店）の緯度経度
const STORE_ID = 1;
const DEFAULT_LATITUDE = 36.66995390;
const DEFAULT_LONGITUDE = 137.20684780;

interface WeatherRow {
  date: string;
  precipitation: number | null;
  temperature: number | null;
  humidity: number | null;
  snow: number | null;
  weather: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseDate(dateStr: string): Date | null {
  // YYYY-MM-DD形式をパース
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return null;
    }
    
    return new Date(year, month - 1, day);
  }
  
  // YYYY/MM/DD形式も試す
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return null;
    }
    
    return new Date(year, month - 1, day);
  }
  
  return null;
}

async function importWeatherDataFromCSV() {
  try {
    console.log('CSVファイルから天気データをインポート開始...');
    console.log(`ファイルパス: ${CSV_FILE_PATH}`);
    
    // ファイルの存在確認
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`CSVファイルが見つかりません: ${CSV_FILE_PATH}`);
      return false;
    }
    
    // CSVファイルを読み込む（UTF-8）
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      console.error('CSVファイルにデータがありません');
      return false;
    }
    
    // ヘッダー行をスキップ
    const dataLines = lines.slice(1);
    
    console.log(`読み込んだデータ行数: ${dataLines.length}`);
    
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // 店舗の緯度経度を取得
    const storeResult = await pool.query(
      'SELECT latitude, longitude FROM stores WHERE id = $1',
      [STORE_ID]
    );
    
    if (storeResult.rows.length === 0) {
      console.error(`店舗ID ${STORE_ID} が見つかりません`);
      return false;
    }
    
    const store = storeResult.rows[0];
    const latitude = store.latitude || DEFAULT_LATITUDE;
    const longitude = store.longitude || DEFAULT_LONGITUDE;
    
    console.log(`店舗ID ${STORE_ID} の緯度: ${latitude}, 経度: ${longitude}\n`);
    
    // 各行を処理
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      
      try {
        const columns = parseCSVLine(line);
        
        // 新しいCSVファイルの列順序:
        // 日付, 降水量合計_mm, 平均気温_℃, 平均湿度_%, 降雪量合計_cm, 天気概況_昼
        if (columns.length < 6) {
          if (i < 5 || i > dataLines.length - 5) {
            console.warn(`行 ${i + 2}: カラム数が不足しています (${columns.length}): ${line.substring(0, 100)}`);
          }
          skippedCount++;
          continue;
        }
        
        const dateStr = columns[0];
        const precipitationStr = columns[1]; // 降水量合計_mm
        const temperatureStr = columns[2]; // 平均気温_℃
        const humidityStr = columns[3]; // 平均湿度_%
        const snowStr = columns[4]; // 降雪量合計_cm
        const weatherStr = columns[5]; // 天気概況_昼
        
        // 日付をパース
        const date = parseDate(dateStr);
        if (!date || isNaN(date.getTime())) {
          if (i < 5 || i > dataLines.length - 5) {
            console.warn(`行 ${i + 2}: 無効な日付形式: ${dateStr}`);
          }
          skippedCount++;
          continue;
        }
        
        const dateKey = date.toISOString().split('T')[0];
        
        // 数値をパース（空文字列の場合はnull）
        const precipitation = precipitationStr && precipitationStr !== '' ? parseFloat(precipitationStr) : null;
        const temperature = temperatureStr && temperatureStr !== '' ? parseFloat(temperatureStr) : null;
        const humidity = humidityStr && humidityStr !== '' ? parseFloat(humidityStr) : null;
        const snow = snowStr && snowStr !== '' ? parseFloat(snowStr) : null;
        
        // 天気データ
        let weather = weatherStr || '';
        weather = weather.trim();
        
        // データベースに挿入または更新
        await pool.query(
          `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (latitude, longitude, date) 
           DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
          [latitude, longitude, dateKey, weather || null, temperature, humidity, precipitation, snow]
        );
        
        updatedCount++; // ON CONFLICT DO UPDATE なので、更新としてカウント
        
        if ((importedCount + updatedCount) % 100 === 0) {
          console.log(`  進捗: ${importedCount + updatedCount}件処理しました`);
        }
      } catch (err) {
        if (i < 5 || i > dataLines.length - 5) {
          console.error(`行 ${i + 2} の処理エラー:`, err);
        }
        errorCount++;
      }
    }
    
    console.log('\n=== CSVインポート完了 ===');
    console.log(`新規インポート: ${importedCount}件`);
    console.log(`更新: ${updatedCount}件`);
    console.log(`スキップ: ${skippedCount}件`);
    console.log(`エラー: ${errorCount}件`);
    console.log(`合計処理: ${importedCount + updatedCount}件`);
    
    return true;
  } catch (error) {
    console.error('CSVインポートエラー:', error);
    return false;
  }
}

async function importWeatherDataFromExcel() {
  console.log('\nExcelファイルから天気データをインポート開始...');
  console.log(`ファイルパス: ${EXCEL_FILE_PATH}`);
  
  // ファイルの存在確認
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`Excelファイルが見つかりません: ${EXCEL_FILE_PATH}`);
    return false;
  }
  
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);
    
    // 最初のシートを取得
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      console.error('シートが見つかりません');
      return false;
    }
    
    console.log(`シート名: ${worksheet.name}`);
    console.log(`総行数: ${worksheet.rowCount}`);
    
    // ヘッダー行をスキップ（1行目がヘッダーの場合）
    let startRow = 1;
    const firstRow = worksheet.getRow(1);
    const firstCell = firstRow.getCell(1);
    
    // ヘッダー行を検出（最初のセルが日付でない場合）
    if (firstCell.value && typeof firstCell.value === 'string' && firstCell.value.includes('日付')) {
      startRow = 2;
      console.log('ヘッダー行を検出しました。2行目からデータを読み込みます。');
    }
    
    // 店舗の緯度経度を取得
    const storeResult = await pool.query(
      'SELECT latitude, longitude FROM stores WHERE id = $1',
      [STORE_ID]
    );
    
    if (storeResult.rows.length === 0) {
      console.error(`店舗ID ${STORE_ID} が見つかりません`);
      return false;
    }
    
    const store = storeResult.rows[0];
    const latitude = store.latitude || DEFAULT_LATITUDE;
    const longitude = store.longitude || DEFAULT_LONGITUDE;
    
    console.log(`店舗ID ${STORE_ID} の緯度: ${latitude}, 経度: ${longitude}\n`);
    
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // 日付をパースする関数
    function parseDateFromExcel(dateValue: ExcelJS.CellValue): Date | null {
      if (dateValue === null || dateValue === undefined) {
        return null;
      }
      
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      if (typeof dateValue === 'number') {
        // Excelのシリアル日付番号の場合
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        return date;
      }
      
      const str = String(dateValue);
      return parseDate(str);
    }
    
    // 各行を処理
    const totalDataRows = worksheet.rowCount - startRow + 1;
    console.log(`データ行の処理開始: ${startRow}行目から${worksheet.rowCount}行目まで（${totalDataRows}行）`);
    for (let rowNum = startRow; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      
      // 空行をスキップ
      if (!row.getCell(1).value) {
        if (rowNum > worksheet.rowCount - 5) {
          console.log(`警告: 行${rowNum}が空です（最後の5行以内）`);
        }
        continue;
      }
      
      try {
        // 新しいExcelファイルの列順序:
        // 日付, 降水量合計_mm, 平均気温_℃, 平均湿度_%, 降雪量合計_cm, 天気概況_昼
        const dateValue = row.getCell(1).value; // 1列目: 日付
        const precipitationValue = row.getCell(2).value; // 2列目: 降水量合計_mm
        const temperatureValue = row.getCell(3).value; // 3列目: 平均気温_℃
        const humidityValue = row.getCell(4).value; // 4列目: 平均湿度_%
        const snowValue = row.getCell(5).value; // 5列目: 降雪量合計_cm
        const weatherValue = row.getCell(6).value; // 6列目: 天気概況_昼
        
        const date = dateValue ? parseDateFromExcel(dateValue) : null;
        if (!date || isNaN(date.getTime())) {
          if (rowNum > worksheet.rowCount - 5) {
            console.warn(`スキップ: 無効な日付形式 '${dateValue}' (行${rowNum})`);
          }
          skippedCount++;
          continue;
        }
        
        const formattedDate = date.toISOString().split('T')[0];
        
        // 数値の変換
        const precipitation = precipitationValue !== null && precipitationValue !== undefined 
          ? (typeof precipitationValue === 'number' ? precipitationValue : parseFloat(String(precipitationValue)))
          : null;
        const temperature = temperatureValue !== null && temperatureValue !== undefined 
          ? (typeof temperatureValue === 'number' ? temperatureValue : parseFloat(String(temperatureValue)))
          : null;
        const humidity = humidityValue !== null && humidityValue !== undefined
          ? (typeof humidityValue === 'number' ? humidityValue : parseFloat(String(humidityValue)))
          : null;
        const snow = snowValue !== null && snowValue !== undefined
          ? (typeof snowValue === 'number' ? snowValue : parseFloat(String(snowValue)))
          : null;
        
        // 天気文字列の処理
        let weather = '';
        if (weatherValue !== null && weatherValue !== undefined) {
          weather = String(weatherValue).trim();
        }
        
        // データベースに挿入または更新
        await pool.query(
          `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (latitude, longitude, date) 
           DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
          [latitude, longitude, formattedDate, weather || null, temperature, humidity, precipitation, snow]
        );
        
        updatedCount++; // ON CONFLICT DO UPDATE なので、更新としてカウント
        
        // 最後の10件は詳細ログを出力
        if (rowNum > worksheet.rowCount - 10) {
          console.log(`  [行${rowNum}] ${formattedDate}: weather="${weather}", temperature=${temperature}°C`);
        }
        
        if ((importedCount + updatedCount) % 100 === 0) {
          console.log(`進捗: ${importedCount + updatedCount}件のデータを処理しました...`);
        }
      } catch (recordError) {
        if (rowNum > worksheet.rowCount - 5) {
          console.error(`レコード処理エラー (行${rowNum}):`, recordError);
        }
        errorCount++;
      }
    }
    
    console.log('\n=== Excelインポート完了 ===');
    console.log(`新規インポート: ${importedCount}件`);
    console.log(`更新: ${updatedCount}件`);
    console.log(`スキップ: ${skippedCount}件`);
    console.log(`エラー: ${errorCount}件`);
    console.log(`合計処理: ${importedCount + updatedCount}件`);
    
    return true;
  } catch (fileError) {
    console.error('Excelファイル読み込みまたはパースエラー:', fileError);
    return false;
  }
}

async function main() {
  console.log('=== 富山天気データインポート開始 ===\n');
  
  // まずCSVファイルを試す
  const csvSuccess = await importWeatherDataFromCSV();
  
  // CSVが失敗した場合、またはExcelファイルもインポートする場合
  if (!csvSuccess || fs.existsSync(EXCEL_FILE_PATH)) {
    await importWeatherDataFromExcel();
  }
  
  await pool.end();
  console.log('\n=== インポート処理完了 ===');
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});

