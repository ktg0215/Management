// CSVからインポートしたデータが正しく保存されているか確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

const STORE_ID = 1;
const DEFAULT_LATITUDE = 36.66995390;
const DEFAULT_LONGITUDE = 137.20684780;

async function checkCSVImportedData() {
  try {
    // 店舗の緯度経度を取得
    const storeResult = await pool.query(
      'SELECT latitude, longitude FROM stores WHERE id = $1',
      [STORE_ID]
    );
    
    const store = storeResult.rows[0];
    const latitude = store?.latitude || DEFAULT_LATITUDE;
    const longitude = store?.longitude || DEFAULT_LONGITUDE;
    
    console.log(`店舗ID ${STORE_ID} の緯度: ${latitude}, 経度: ${longitude}\n`);
    
    // 2024年12月のデータを確認（CSVからインポートしたデータ）
    const result202412 = await pool.query(
      `SELECT date, weather, temperature 
       FROM weather_data 
       WHERE latitude = $1 AND longitude = $2 
       AND date >= '2024-12-01' AND date <= '2024-12-31'
       ORDER BY date`,
      [latitude, longitude]
    );
    
    console.log(`2024年12月の天気データ: ${result202412.rows.length}件\n`);
    
    // 空欄または文字化けのデータを確認
    const emptyOrCorrupted = result202412.rows.filter(row => {
      const weather = row.weather || '';
      return !weather || weather.trim() === '' || weather.includes('�') || weather.includes('���');
    });
    
    console.log(`空欄または文字化けデータ: ${emptyOrCorrupted.length}件`);
    if (emptyOrCorrupted.length > 0) {
      console.log('\n空欄または文字化けデータの詳細:');
      emptyOrCorrupted.slice(0, 10).forEach(row => {
        const d = row.date instanceof Date ? row.date : new Date(row.date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        console.log(`  ${dateStr}: weather="${row.weather}", temperature=${row.temperature}`);
      });
    }
    
    // サンプルデータを表示（最初の5件と最後の5件）
    console.log('\nサンプルデータ（最初の5件）:');
    result202412.rows.slice(0, 5).forEach(row => {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      console.log(`  ${dateStr}: weather="${row.weather || ''}", temperature=${row.temperature}°C`);
    });
    
    console.log('\nサンプルデータ（最後の5件）:');
    result202412.rows.slice(-5).forEach(row => {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      console.log(`  ${dateStr}: weather="${row.weather || ''}", temperature=${row.temperature}°C`);
    });
    
    // 2025年5月のデータも確認（Excelからインポートしたデータ）
    const result202505 = await pool.query(
      `SELECT date, weather, temperature 
       FROM weather_data 
       WHERE latitude = $1 AND longitude = $2 
       AND date >= '2025-05-01' AND date <= '2025-05-31'
       ORDER BY date`,
      [latitude, longitude]
    );
    
    console.log(`\n2025年5月の天気データ: ${result202505.rows.length}件`);
    console.log('サンプルデータ（最初の3件）:');
    result202505.rows.slice(0, 3).forEach(row => {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      console.log(`  ${dateStr}: weather="${row.weather || ''}", temperature=${row.temperature}°C`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkCSVImportedData();

