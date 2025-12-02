// 天気データが正しく保存されているか確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkWeatherData() {
  try {
    // 店舗ID 1の緯度経度
    const latitude = 36.66995390;
    const longitude = 137.20684780;
    
    // 天気データの統計情報
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN weather IS NOT NULL AND weather != '' THEN 1 END) as weather_count,
        COUNT(CASE WHEN temperature IS NOT NULL THEN 1 END) as temperature_count,
        COUNT(CASE WHEN humidity IS NOT NULL THEN 1 END) as humidity_count,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM weather_data 
      WHERE latitude = $1 AND longitude = $2`,
      [latitude, longitude]
    );
    
    const stats = statsResult.rows[0];
    console.log('=== 天気データ統計情報 ===');
    console.log(`総レコード数: ${stats.total_records}`);
    console.log(`天気データあり: ${stats.weather_count}`);
    console.log(`気温データあり: ${stats.temperature_count}`);
    console.log(`湿度データあり: ${stats.humidity_count}`);
    console.log(`最も古い日付: ${stats.earliest_date}`);
    console.log(`最も新しい日付: ${stats.latest_date}`);
    
    // 最新10件のサンプルデータ
    const sampleResult = await pool.query(
      `SELECT date, weather, temperature, humidity 
      FROM weather_data 
      WHERE latitude = $1 AND longitude = $2 
      ORDER BY date DESC 
      LIMIT 10`,
      [latitude, longitude]
    );
    
    console.log('\n=== 最新10件のサンプルデータ ===');
    sampleResult.rows.forEach(row => {
      console.log(`${row.date}: 天気=${row.weather || 'null'}, 気温=${row.temperature || 'null'}°C, 湿度=${row.humidity || 'null'}%`);
    });
    
    // 2025年4月のデータ確認
    const aprilResult = await pool.query(
      `SELECT date, weather, temperature 
      FROM weather_data 
      WHERE latitude = $1 AND longitude = $2 
      AND date >= '2025-04-01' AND date <= '2025-04-30'
      ORDER BY date`,
      [latitude, longitude]
    );
    
    console.log(`\n=== 2025年4月のデータ (${aprilResult.rows.length}件) ===`);
    aprilResult.rows.forEach(row => {
      console.log(`${row.date}: 天気=${row.weather || 'null'}, 気温=${row.temperature || 'null'}°C`);
    });
    
    // 2025年5月のデータ確認
    const mayResult = await pool.query(
      `SELECT date, weather, temperature 
      FROM weather_data 
      WHERE latitude = $1 AND longitude = $2 
      AND date >= '2025-05-01' AND date <= '2025-05-31'
      ORDER BY date`,
      [latitude, longitude]
    );
    
    console.log(`\n=== 2025年5月のデータ (${mayResult.rows.length}件) ===`);
    mayResult.rows.forEach(row => {
      console.log(`${row.date}: 天気=${row.weather || 'null'}, 気温=${row.temperature || 'null'}°C`);
    });
    
    // 売上データがある日付で天気データが存在するか確認（2025年4月の例）
    const salesWeatherCheckResult = await pool.query(
      `SELECT 
        sd.year,
        sd.month,
        COUNT(DISTINCT wd.date) as weather_data_count
      FROM sales_data sd
      LEFT JOIN weather_data wd ON wd.latitude = $1 AND wd.longitude = $2
        AND wd.date >= TO_DATE(sd.year || '-' || LPAD(sd.month::text, 2, '0') || '-01', 'YYYY-MM-DD')
        AND wd.date < TO_DATE(sd.year || '-' || LPAD(sd.month::text, 2, '0') || '-01', 'YYYY-MM-DD') + INTERVAL '1 month'
      WHERE sd.store_id = 1 AND sd.year = 2025 AND sd.month = 4
      GROUP BY sd.year, sd.month`,
      [latitude, longitude]
    );
    
    console.log('\n=== 2025年4月の売上データと天気データの対応 ===');
    salesWeatherCheckResult.rows.forEach(row => {
      console.log(`${row.year}年${row.month}月: 天気データ ${row.weather_data_count}件`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkWeatherData();
