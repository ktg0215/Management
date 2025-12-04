// 2025年8月の売上データを確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkAugust2025Data() {
  try {
    console.log('=== 2025年8月の売上データを確認中 ===\n');
    
    // 2025年8月の売上データを確認
    const result = await pool.query(
      `SELECT id, store_id, year, month, 
              jsonb_object_keys(daily_data) as day_key,
              daily_data->jsonb_object_keys(daily_data)::text as first_day_data
       FROM sales_data 
       WHERE store_id = 1 AND year = 2025 AND month = 8
       LIMIT 1`,
      []
    );
    
    if (result.rows.length === 0) {
      console.log('2025年8月の売上データは存在しません。');
    } else {
      const row = result.rows[0];
      console.log(`データが見つかりました:`);
      console.log(`  Store ID: ${row.store_id}`);
      console.log(`  Year: ${row.year}, Month: ${row.month}`);
      console.log(`  最初の日付キー: ${row.day_key}`);
      
      // 全データを確認
      const allDataResult = await pool.query(
        `SELECT daily_data
         FROM sales_data 
         WHERE store_id = 1 AND year = 2025 AND month = 8`,
        []
      );
      
      if (allDataResult.rows.length > 0) {
        const dailyData = allDataResult.rows[0].daily_data;
        const keys = Object.keys(dailyData);
        console.log(`\n日付キーの数: ${keys.length}`);
        console.log(`最初の5件: ${keys.slice(0, 5).join(', ')}`);
        console.log(`最後の5件: ${keys.slice(-5).join(', ')}`);
        
        // 最初の1件のデータを確認
        if (keys.length > 0) {
          const firstKey = keys[0];
          const firstData = dailyData[firstKey];
          console.log(`\n最初のデータ（キー: ${firstKey}）:`);
          console.log(JSON.stringify(firstData, null, 2).substring(0, 500));
        }
      }
    }
    
    // 他の月のデータも確認（比較用）
    console.log('\n=== 他の月のデータ確認（比較用）===');
    const otherMonthsResult = await pool.query(
      `SELECT year, month, COUNT(*) as day_count
       FROM sales_data 
       WHERE store_id = 1 AND year = 2025
       GROUP BY year, month
       ORDER BY year, month`,
      []
    );
    
    console.log(`2025年のデータ:`);
    otherMonthsResult.rows.forEach(row => {
      console.log(`  ${row.year}年${row.month}月: ${row.day_count}日分`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkAugust2025Data();

