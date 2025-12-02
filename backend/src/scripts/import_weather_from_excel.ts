// Excelファイルから天気データをインポートするスクリプト
// 店舗ID 1（富山二口店）の天気データをインポート

import dotenv from 'dotenv';
import { Pool } from 'pg';
import ExcelJS from 'exceljs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

// Excelファイルのパス（プロジェクトルートからの相対パス）
// サーバー上ではスペースがアンダースコアに置き換えられている可能性があるため、両方を試す
const EXCEL_FILE_PATHS = [
  path.join(process.cwd(), 'weather_data_toyama_copy.xlsx'), // プロジェクトルート
  path.join(__dirname, '../../weather_data_toyama_copy.xlsx'), // backend/src/scripts/ から見た相対パス
  path.join(__dirname, '../../../weather_data_toyama_copy.xlsx'), // 念のため
  path.join(process.cwd(), 'weather_data_toyama copy.xlsx'), // スペース版
  path.join(__dirname, '../../weather_data_toyama copy.xlsx'),
];

// 店舗ID 1（富山二口店）の緯度経度
const STORE_ID = 1;
const DEFAULT_LATITUDE = 36.66995390;
const DEFAULT_LONGITUDE = 137.20684780;

interface WeatherRow {
  date: string;
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  snow: number | null;
  weather: string;
}

// 日付文字列をパースする関数 (YYYY/MM/DD形式に対応)
function parseDate(dateValue: ExcelJS.CellValue): Date | null {
  if (dateValue === null || dateValue === undefined) {
    return null;
  }
  
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  if (typeof dateValue === 'number') {
    // Excelのシリアル日付番号の場合
    const excelEpoch = new Date(1899, 11, 30); // Excelのエポック（1900年1月0日）
    const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
    return date;
  }
  
  const str = String(dateValue);
  const parts = str.split('/');
  if (parts.length === 3) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return null;
    }
    
    return new Date(year, month - 1, day);
  }
  
  // YYYY-MM-DD形式も試す
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return null;
    }
    
    return new Date(year, month - 1, day);
  }
  
  return null;
}

async function importWeatherDataFromExcel() {
  console.log('Excelファイルから天気データをインポート開始...');
  
  // ファイルパスを検索
  let EXCEL_FILE_PATH = '';
  for (const possiblePath of EXCEL_FILE_PATHS) {
    const fs = require('fs');
    if (fs.existsSync(possiblePath)) {
      EXCEL_FILE_PATH = possiblePath;
      break;
    }
  }
  
  if (!EXCEL_FILE_PATH) {
    console.error('Excelファイルが見つかりません。試したパス:');
    EXCEL_FILE_PATHS.forEach(p => console.error(`  - ${p}`));
    await pool.end();
    return;
  }
  
  console.log(`ファイルパス: ${EXCEL_FILE_PATH}`);

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);
    
    // 最初のシートを取得
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      console.error('シートが見つかりません');
      await pool.end();
      return;
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

    let latitude = DEFAULT_LATITUDE;
    let longitude = DEFAULT_LONGITUDE;

    if (storeResult.rows.length > 0 && storeResult.rows[0].latitude && storeResult.rows[0].longitude) {
      latitude = storeResult.rows[0].latitude;
      longitude = storeResult.rows[0].longitude;
    } else {
      console.warn(`店舗ID ${STORE_ID} に緯度経度情報がないため、デフォルト値を使用します。`);
    }
    console.log(`店舗ID ${STORE_ID} の緯度: ${latitude}, 経度: ${longitude}\n`);

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let emptyWeatherCount = 0;

    // 各行を処理
    for (let rowNum = startRow; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      
      // 空行をスキップ
      if (!row.getCell(1).value) {
        continue;
      }
      
      try {
        // 列のマッピング（Excelファイルの構造に応じて調整）
        // 想定: 日付, 気温, 湿度, 降水量, 雪, 天気
        const dateValue = row.getCell(1).value; // 1列目: 日付
        const temperatureValue = row.getCell(2).value; // 2列目: 気温
        const humidityValue = row.getCell(3).value; // 3列目: 湿度
        const precipitationValue = row.getCell(4).value; // 4列目: 降水量
        const snowValue = row.getCell(5).value; // 5列目: 雪
        const weatherValue = row.getCell(6).value; // 6列目: 天気
        
        const date = dateValue ? parseDate(dateValue) : null;
        if (!date || isNaN(date.getTime())) {
          console.warn(`スキップ: 無効な日付形式 '${dateValue}' (行${rowNum}, 型: ${typeof dateValue})`);
          skippedCount++;
          continue;
        }
        
        const formattedDate = date.toISOString().split('T')[0];
        
        // 数値の変換
        const temperature = temperatureValue !== null && temperatureValue !== undefined 
          ? (typeof temperatureValue === 'number' ? temperatureValue : parseFloat(String(temperatureValue)))
          : null;
        const humidity = humidityValue !== null && humidityValue !== undefined
          ? (typeof humidityValue === 'number' ? humidityValue : parseFloat(String(humidityValue)))
          : null;
        const precipitation = precipitationValue !== null && precipitationValue !== undefined
          ? (typeof precipitationValue === 'number' ? precipitationValue : parseFloat(String(precipitationValue)))
          : null;
        const snow = snowValue !== null && snowValue !== undefined
          ? (typeof snowValue === 'number' ? snowValue : parseFloat(String(snowValue)))
          : null;
        
        // 天気文字列の処理
        let weather = '';
        if (weatherValue !== null && weatherValue !== undefined) {
          weather = String(weatherValue).trim();
        }
        
        if (!weather) {
          emptyWeatherCount++;
          console.warn(`警告: 天気データが空です (${formattedDate}, 行${rowNum})`);
        }
        
        // データベースに挿入または更新
        await pool.query(
          `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (latitude, longitude, date) 
           DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
          [latitude, longitude, formattedDate, weather || null, temperature || null, humidity || null, precipitation || null, snow || null]
        );
        
        updatedCount++; // ON CONFLICT DO UPDATE なので、更新としてカウント
        
        if ((importedCount + updatedCount) % 100 === 0) {
          console.log(`進捗: ${importedCount + updatedCount}件のデータを処理しました...`);
        }
      } catch (recordError) {
        console.error(`レコード処理エラー (行${rowNum}):`, recordError);
        errorCount++;
      }
    }

    console.log('\nExcelファイルからの天気データインポートが完了しました。');
    console.log(`  新規インポート: ${importedCount}件`);
    console.log(`  更新: ${updatedCount}件`);
    console.log(`  スキップ: ${skippedCount}件`);
    console.log(`  エラー: ${errorCount}件`);
    console.log(`  天気データが空のレコード: ${emptyWeatherCount}件`);
    console.log(`  合計処理: ${importedCount + updatedCount}件`);

  } catch (fileError) {
    console.error('Excelファイル読み込みまたはパースエラー:', fileError);
  } finally {
    await pool.end();
  }
}

importWeatherDataFromExcel();

