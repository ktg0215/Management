// 2024年12月1日の天気データを確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkWeather() {
  try {
    // 店舗ID 1の緯度経度を取得
    const storeResult = await pool.query(
      'SELECT latitude, longitude FROM stores WHERE id = 1 LIMIT 1'
    );
    
    if (storeResult.rows.length === 0) {
      console.log('店舗が見つかりません');
      return;
    }
    
    const { latitude, longitude } = storeResult.rows[0];
    console.log(`店舗の緯度: ${latitude}, 経度: ${longitude}`);
    
    // 2024年12月1日の天気データを取得
    const weatherResult = await pool.query(
      `SELECT date, weather, temperature FROM weather_data 
       WHERE date = '2024-12-01' 
       AND latitude = $1 AND longitude = $2 
       LIMIT 1`,
      [latitude, longitude]
    );
    
    if (weatherResult.rows.length === 0) {
      console.log('天気データが見つかりません');
      return;
    }
    
    const row = weatherResult.rows[0];
    console.log(`\n2024年12月1日の天気データ:`);
    console.log(`  日付: ${row.date}`);
    console.log(`  天気: "${row.weather}"`);
    console.log(`  天気の長さ: ${row.weather?.length || 0}`);
    console.log(`  気温: ${row.temperature}`);
    
    // 文字コードを確認
    if (row.weather) {
      const weatherStr = String(row.weather);
      const codes = Array.from(weatherStr).map((char) => char.charCodeAt(0));
      console.log(`  文字コード: [${codes.join(', ')}]`);
      console.log(`  文字列の各文字: [${Array.from(weatherStr).map((char) => `'${char}'(${char.charCodeAt(0)})`).join(', ')}]`);
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkWeather();

