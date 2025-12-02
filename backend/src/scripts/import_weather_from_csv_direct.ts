// CSVデータを直接埋め込んでインポートするスクリプト
// 店舗ID 1（富山二口店）の天気データをインポート

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

// 店舗ID 1（富山二口店）の緯度経度
const STORE_ID = 1;
const DEFAULT_LATITUDE = 36.66995390;
const DEFAULT_LONGITUDE = 137.20684780;

// CSVデータ（実際のファイルから読み込む）
// このスクリプトは、CSVファイルがサーバー上に存在することを前提としています
const CSV_FILE_PATH = path.join(__dirname, '../../weather_data_toyama.csv');

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
  // 2023/6/1 形式をパース
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    return null;
  }
  
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  
  return new Date(year, month - 1, day);
}

async function importWeatherDataFromCSV() {
  try {
    console.log('CSVファイルから天気データをインポート開始...');
    console.log(`ファイルパス: ${CSV_FILE_PATH}`);
    
    const fs = require('fs');
    
    // ファイルの存在確認
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`ファイルが見つかりません: ${CSV_FILE_PATH}`);
      console.log('CSVファイルをサーバーにアップロードしてください。');
      process.exit(1);
    }
    
    // CSVファイルを読み込む
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
    const lines = fileContent.split('\n').filter((line: string) => line.trim() !== '');
    
    if (lines.length < 2) {
      console.error('CSVファイルにデータがありません');
      process.exit(1);
    }
    
    // ヘッダー行をスキップ
    const dataLines = lines.slice(1);
    
    console.log(`読み込んだデータ行数: ${dataLines.length}`);
    
    // 店舗の緯度経度を取得
    const storeResult = await pool.query(
      'SELECT latitude, longitude FROM stores WHERE id = $1',
      [STORE_ID]
    );
    
    if (storeResult.rows.length === 0) {
      console.error(`店舗ID ${STORE_ID} が見つかりません`);
      process.exit(1);
    }
    
    const store = storeResult.rows[0];
    const latitude = store.latitude || DEFAULT_LATITUDE;
    const longitude = store.longitude || DEFAULT_LONGITUDE;
    
    console.log(`店舗ID ${STORE_ID} の緯度: ${latitude}, 経度: ${longitude}\n`);
    
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // 各行を処理
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      
      try {
        const columns = parseCSVLine(line);
        
        if (columns.length < 6) {
          console.warn(`行 ${i + 2}: カラム数が不足しています (${columns.length})`);
          errorCount++;
          continue;
        }
        
        const dateStr = columns[0];
        const temperatureStr = columns[1];
        const humidityStr = columns[2];
        const precipitationStr = columns[3];
        const snowStr = columns[4];
        const weatherStr = columns[5];
        
        // 日付をパース
        const date = parseDate(dateStr);
        if (!date || isNaN(date.getTime())) {
          console.warn(`行 ${i + 2}: 無効な日付形式: ${dateStr}`);
          errorCount++;
          continue;
        }
        
        const dateKey = date.toISOString().split('T')[0];
        
        // 数値をパース
        const temperature = temperatureStr && temperatureStr !== '' ? parseFloat(temperatureStr) : null;
        const humidity = humidityStr && humidityStr !== '' ? parseFloat(humidityStr) : null;
        const precipitation = precipitationStr && precipitationStr !== '' ? parseFloat(precipitationStr) : null;
        const snow = snowStr && snowStr !== '' ? parseFloat(snowStr) : null;
        
        // 天気データをクリーンアップ
        let weather = weatherStr || '';
        
        // 既存データを確認
        const existingResult = await pool.query(
          `SELECT id FROM weather_data 
           WHERE latitude = $1 AND longitude = $2 AND date = $3`,
          [latitude, longitude, dateKey]
        );
        
        if (existingResult.rows.length > 0) {
          // 既存データを更新
          await pool.query(
            `UPDATE weather_data 
             SET weather = $1, temperature = $2, humidity = $3, precipitation = $4, snow = $5, updated_at = NOW()
             WHERE latitude = $6 AND longitude = $7 AND date = $8`,
            [weather || null, temperature, humidity, precipitation, snow, latitude, longitude, dateKey]
          );
          updatedCount++;
        } else {
          // 新規データを挿入
          await pool.query(
            `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [latitude, longitude, dateKey, weather || null, temperature, humidity, precipitation, snow]
          );
          importedCount++;
        }
        
        if ((importedCount + updatedCount) % 100 === 0) {
          console.log(`  進捗: ${importedCount + updatedCount}件処理しました`);
        }
      } catch (err) {
        console.error(`行 ${i + 2} の処理エラー:`, err);
        errorCount++;
      }
    }
    
    console.log('\n=== インポート完了 ===');
    console.log(`新規インポート: ${importedCount}件`);
    console.log(`更新: ${updatedCount}件`);
    console.log(`スキップ: ${skippedCount}件`);
    console.log(`エラー: ${errorCount}件`);
    console.log(`合計処理: ${importedCount + updatedCount}件`);
    
  } catch (error) {
    console.error('インポートエラー:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importWeatherDataFromCSV();

