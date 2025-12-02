// 天気データの保存状況を確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

const STORE_ID = 1;
const DEFAULT_LATITUDE = 36.66995390;
const DEFAULT_LONGITUDE = 137.20684780;

async function checkWeatherData() {
  try {
    console.log('天気データの保存状況を確認中...');
    
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
    
    // 天気データの統計情報を取得
    const statsResult = await pool.query(
      `SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date 
       FROM weather_data 
       WHERE latitude = $1 AND longitude = $2`,
      [latitude, longitude]
    );
    
    const stats = statsResult.rows[0];
    console.log('\n=== 天気データ統計 ===');
    console.log(`総件数: ${stats.count}`);
    console.log(`最小日付: ${stats.min_date}`);
    console.log(`最大日付: ${stats.max_date}`);
    
    // 最新5件のサンプルを取得
    const sampleResult = await pool.query(
      `SELECT date, weather, temperature, humidity, precipitation, snow 
       FROM weather_data 
       WHERE latitude = $1 AND longitude = $2 
       ORDER BY date DESC 
       LIMIT 5`,
      [latitude, longitude]
    );
    
    console.log('\n=== 最新5件のサンプル ===');
    sampleResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.date}: 天気=${row.weather || 'null'}, 気温=${row.temperature !== null ? row.temperature + '°C' : 'null'}, 湿度=${row.humidity !== null ? row.humidity + '%' : 'null'}`);
    });
    
    // 2023年6月のデータを確認
    const june2023Result = await pool.query(
      `SELECT date, weather, temperature, humidity 
       FROM weather_data 
       WHERE latitude = $1 AND longitude = $2 
       AND date >= '2023-06-01' AND date <= '2023-06-30'
       ORDER BY date`,
      [latitude, longitude]
    );
    
    console.log(`\n=== 2023年6月のデータ (${june2023Result.rows.length}件) ===`);
    if (june2023Result.rows.length > 0) {
      june2023Result.rows.slice(0, 5).forEach(row => {
        console.log(`${row.date}: 天気=${row.weather || 'null'}, 気温=${row.temperature !== null ? row.temperature + '°C' : 'null'}`);
      });
      if (june2023Result.rows.length > 5) {
        console.log(`... 他 ${june2023Result.rows.length - 5}件`);
      }
    } else {
      console.log('データがありません');
    }
    
  } catch (error) {
    console.error('確認エラー:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkWeatherData();

