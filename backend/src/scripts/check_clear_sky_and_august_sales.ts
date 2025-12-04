// 「快晴」の天気データと2025年8月の売上データを確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkClearSkyAndAugustSales() {
  try {
    console.log('=== 「快晴」の天気データを確認中 ===\n');
    
    // 「快晴」を含む天気データを検索
    const clearSkyResult = await pool.query(
      `SELECT date, weather, temperature 
       FROM weather_data 
       WHERE weather LIKE '%快晴%' 
       ORDER BY date DESC
       LIMIT 20`,
      []
    );
    
    console.log(`「快晴」を含む天気データ: ${clearSkyResult.rows.length}件\n`);
    
    if (clearSkyResult.rows.length > 0) {
      console.log('最初の20件:');
      clearSkyResult.rows.forEach((row, i) => {
        const dateStr = row.date instanceof Date 
          ? row.date.toISOString().split('T')[0]
          : String(row.date).split('T')[0];
        console.log(`  ${i + 1}. ${dateStr}: "${row.weather}", ${row.temperature}°C`);
      });
    } else {
      console.log('「快晴」を含む天気データは見つかりませんでした。');
    }
    
    // 「快晴」に近い天気データも確認（「晴」「晴れ」など）
    console.log('\n=== 「晴」を含む天気データのサンプル ===\n');
    const sunnyResult = await pool.query(
      `SELECT DISTINCT weather, COUNT(*) as count 
       FROM weather_data 
       WHERE weather LIKE '%晴%' AND weather NOT LIKE '%快晴%'
       GROUP BY weather 
       ORDER BY count DESC 
       LIMIT 10`,
      []
    );
    
    console.log(`「晴」を含む天気データの種類（「快晴」を除く）: ${sunnyResult.rows.length}種類\n`);
    sunnyResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. "${row.weather}" (${row.count}件)`);
    });
    
    console.log('\n=== 2025年8月の売上データを確認中 ===\n');
    
    // 2025年8月の売上データを確認
    const salesResult = await pool.query(
      `SELECT id, store_id, year, month, 
              CASE WHEN daily_data IS NULL THEN 'NULL' 
                   WHEN daily_data::text = '{}' THEN '空のオブジェクト'
                   ELSE 'データあり' END as data_status,
              jsonb_object_keys(daily_data) as first_key
       FROM sales_data 
       WHERE year = 2025 AND month = 8
       ORDER BY store_id`,
      []
    );
    
    console.log(`2025年8月の売上データ: ${salesResult.rows.length}件\n`);
    
    if (salesResult.rows.length === 0) {
      console.log('2025年8月の売上データは存在しません。');
    } else {
      salesResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. Store ID: ${row.store_id}, Status: ${row.data_status}`);
        if (row.first_key) {
          console.log(`     最初のキー: ${row.first_key}`);
        }
      });
      
      // 詳細を確認
      const detailResult = await pool.query(
        `SELECT id, store_id, year, month, 
                jsonb_object_keys(daily_data) as date_key
         FROM sales_data 
         WHERE year = 2025 AND month = 8
         LIMIT 10`,
        []
      );
      
      console.log('\n最初の10件の日付キー:');
      detailResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. Store ${row.store_id}: ${row.date_key}`);
      });
    }
    
    // 店舗ID 1の2025年8月のデータを詳細確認
    console.log('\n=== 店舗ID 1の2025年8月のデータ詳細 ===\n');
    const store1Result = await pool.query(
      `SELECT id, store_id, year, month, daily_data
       FROM sales_data 
       WHERE store_id = 1 AND year = 2025 AND month = 8`,
      []
    );
    
    if (store1Result.rows.length === 0) {
      console.log('店舗ID 1の2025年8月のデータは存在しません。');
    } else {
      const row = store1Result.rows[0];
      const dailyData = row.daily_data || {};
      const keys = Object.keys(dailyData);
      console.log(`データキー数: ${keys.length}`);
      if (keys.length > 0) {
        console.log(`最初の5件のキー: ${keys.slice(0, 5).join(', ')}`);
        console.log(`最後の5件のキー: ${keys.slice(-5).join(', ')}`);
        
        // 最初の1件のデータを確認
        if (keys.length > 0) {
          const firstKey = keys[0];
          const firstData = dailyData[firstKey];
          console.log(`\n最初のデータ（キー: ${firstKey}）:`);
          console.log(JSON.stringify(firstData, null, 2).substring(0, 500));
        }
      } else {
        console.log('daily_dataは空です。');
      }
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkClearSkyAndAugustSales();

