// 売上データがあるが天気データがない日を確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

const STORE_ID = 1;
const DEFAULT_LATITUDE = 36.66995390;
const DEFAULT_LONGITUDE = 137.20684780;

async function checkMissingWeatherData() {
  try {
    console.log('売上データがあるが天気データがない日を確認中...');
    
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
    
    // 売上データが存在するすべての日付を取得
    const salesResult = await pool.query(
      `SELECT DISTINCT 
         year, 
         month,
         jsonb_object_keys(daily_data) as day_key
       FROM sales_data
       WHERE store_id = $1
       ORDER BY year, month, day_key`,
      [STORE_ID]
    );
    
    console.log(`売上データが存在するレコード数: ${salesResult.rows.length}`);
    
    // 日付のセットを作成
    const salesDates = new Set<string>();
    const salesDatesByMonth: { [key: string]: string[] } = {};
    
    for (const row of salesResult.rows) {
      const year = parseInt(String(row.year));
      const month = parseInt(String(row.month));
      const dayKey = String(row.day_key);
      
      // day_keyが数値（1-31）の場合
      if (/^\d+$/.test(dayKey)) {
        const day = parseInt(dayKey);
        if (day >= 1 && day <= 31) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          salesDates.add(dateStr);
          
          const monthKey = `${year}-${String(month).padStart(2, '0')}`;
          if (!salesDatesByMonth[monthKey]) {
            salesDatesByMonth[monthKey] = [];
          }
          salesDatesByMonth[monthKey].push(dateStr);
        }
      }
    }
    
    console.log(`売上データが存在する日付数: ${salesDates.size}\n`);
    
    // 天気データが存在するすべての日付を取得
    const weatherResult = await pool.query(
      `SELECT date 
       FROM weather_data 
       WHERE latitude = $1 AND longitude = $2
       ORDER BY date`,
      [latitude, longitude]
    );
    
    const weatherDates = new Set<string>();
    for (const row of weatherResult.rows) {
      const date = new Date(row.date);
      const dateStr = date.toISOString().split('T')[0];
      weatherDates.add(dateStr);
    }
    
    console.log(`天気データが存在する日付数: ${weatherDates.size}\n`);
    
    // 売上データがあるが天気データがない日を特定
    const missingDates: string[] = [];
    for (const dateStr of salesDates) {
      if (!weatherDates.has(dateStr)) {
        missingDates.push(dateStr);
      }
    }
    
    console.log(`=== 天気データがない日 (${missingDates.length}日) ===\n`);
    
    if (missingDates.length === 0) {
      console.log('すべての売上データに対応する天気データが存在します。');
    } else {
      // 月ごとにグループ化
      const missingByMonth: { [key: string]: string[] } = {};
      for (const dateStr of missingDates) {
        const monthKey = dateStr.substring(0, 7); // YYYY-MM
        if (!missingByMonth[monthKey]) {
          missingByMonth[monthKey] = [];
        }
        missingByMonth[monthKey].push(dateStr);
      }
      
      // 月ごとに表示
      const sortedMonths = Object.keys(missingByMonth).sort();
      for (const monthKey of sortedMonths) {
        const dates = missingByMonth[monthKey].sort();
        console.log(`${monthKey} (${dates.length}日):`);
        console.log(`  ${dates.join(', ')}`);
        console.log('');
      }
      
      // 統計情報
      console.log(`\n=== 統計情報 ===`);
      console.log(`売上データがある日: ${salesDates.size}日`);
      console.log(`天気データがある日: ${weatherDates.size}日`);
      console.log(`天気データがない日: ${missingDates.length}日`);
      console.log(`カバー率: ${((salesDates.size - missingDates.length) / salesDates.size * 100).toFixed(2)}%`);
    }
    
  } catch (error) {
    console.error('確認エラー:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkMissingWeatherData();

