// 2025年5月の天気データを確認するスクリプト

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

async function checkWeatherData202505() {
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
    
    // 2025年5月の全データを取得
    const result = await pool.query(
      `SELECT date, weather, temperature, humidity, precipitation, snow 
       FROM weather_data 
       WHERE latitude = $1 AND longitude = $2 
       AND date >= '2025-05-01' AND date <= '2025-05-31'
       ORDER BY date`,
      [latitude, longitude]
    );
    
    console.log(`2025年5月の天気データ: ${result.rows.length}件\n`);
    
    // 空欄または文字化けのデータを確認
    const emptyOrCorrupted = result.rows.filter(row => {
      const weather = row.weather || '';
      return !weather || weather.trim() === '' || weather.includes('�') || weather.includes('���');
    });
    
    console.log(`空欄または文字化けデータ: ${emptyOrCorrupted.length}件`);
    if (emptyOrCorrupted.length > 0) {
      console.log('\n空欄または文字化けデータの詳細:');
      emptyOrCorrupted.slice(0, 10).forEach(row => {
        console.log(`  ${row.date}: weather="${row.weather}", temperature=${row.temperature}`);
      });
    }
    
    // サンプルデータを表示
    console.log('\nサンプルデータ（最初の5件）:');
    result.rows.slice(0, 5).forEach(row => {
      console.log(`  ${row.date}: weather="${row.weather}", temperature=${row.temperature}°C`);
    });
    
    console.log('\nサンプルデータ（最後の5件）:');
    result.rows.slice(-5).forEach(row => {
      console.log(`  ${row.date}: weather="${row.weather}", temperature=${row.temperature}°C`);
    });
    
    // 欠けている日付を確認
    const dates = result.rows.map(row => {
      const date = row.date instanceof Date ? row.date : new Date(row.date);
      return date.toISOString().split('T')[0];
    });
    
    console.log('\n欠けている日付:');
    let missingCount = 0;
    for (let day = 1; day <= 31; day++) {
      const dateStr = `2025-05-${String(day).padStart(2, '0')}`;
      if (!dates.includes(dateStr)) {
        console.log(`  ${dateStr}`);
        missingCount++;
      }
    }
    if (missingCount === 0) {
      console.log('  なし（全31日分のデータが存在します）');
    } else {
      console.log(`\n合計 ${missingCount} 日分のデータが欠けています。`);
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkWeatherData202505();

