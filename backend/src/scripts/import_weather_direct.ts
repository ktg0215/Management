// CSVデータを直接埋め込んでインポートするスクリプト
// 店舗ID 1（富山二口店）の天気データをインポート

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

// 店舗ID 1（富山二口店）の緯度経度
const STORE_ID = 1;
const DEFAULT_LATITUDE = 36.66995390;
const DEFAULT_LONGITUDE = 137.20684780;

// CSVデータ（最初の100行のみサンプルとして）
// 実際のデータはファイルから読み込む必要があります
const CSV_LINES = [
  'date,temperature,humidity,precipitation,snow,weather',
  '2023/6/1,20.8,63.6,4,0,晴れ時々曇り',
  '2023/6/2,20,96.2,93,0,晴れ時々曇り',
  '2023/6/3,19.5,74.2,0.3,0,晴れ時々曇り',
  // ... 残りのデータ
];

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

async function importWeatherData() {
  try {
    console.log('天気データをインポート開始...');
    
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
    
    console.log(`店舗ID ${STORE_ID} の緯度: ${latitude}, 経度: ${longitude}`);
    
    // CSVデータを読み込む（実際のファイルから読み込む必要があります）
    // ここでは、ユーザーが提供したCSVファイルの内容を直接処理する必要があります
    
    console.log('CSVファイルの内容を読み込んで処理する必要があります。');
    console.log('ファイルパスを指定するか、データを直接埋め込んでください。');
    
  } catch (error) {
    console.error('インポートエラー:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importWeatherData();

