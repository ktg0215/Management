// 2025年8月の売上データを確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkAugustSalesData() {
  try {
    console.log('=== 2025年8月の売上データを確認中 ===\n');
    
    // 2025年8月の売上データを確認
    const result = await pool.query(
      `SELECT id, store_id, year, month, daily_data
       FROM sales_data 
       WHERE store_id = 1 AND year = 2025 AND month = 8`,
      []
    );
    
    if (result.rows.length === 0) {
      console.log('2025年8月の売上データは存在しません。');
      console.log('\nデータを作成する必要があります。');
    } else {
      const row = result.rows[0];
      const dailyData = row.daily_data || {};
      const keys = Object.keys(dailyData);
      
      console.log(`データが見つかりました:`);
      console.log(`  Store ID: ${row.store_id}`);
      console.log(`  Year: ${row.year}, Month: ${row.month}`);
      console.log(`  日付キーの数: ${keys.length}`);
      
      if (keys.length > 0) {
        console.log(`\n最初の5件のキー: ${keys.slice(0, 5).join(', ')}`);
        console.log(`最後の5件のキー: ${keys.slice(-5).join(', ')}`);
        
        // 最初の1件のデータを確認
        const firstKey = keys[0];
        const firstData = dailyData[firstKey];
        console.log(`\n最初のデータ（キー: ${firstKey}）:`);
        console.log(JSON.stringify(firstData, null, 2).substring(0, 800));
        
        // データが空かどうかを確認
        const hasData = keys.some(key => {
          const dayData = dailyData[key];
          return dayData && (
            (dayData.netSales && dayData.netSales > 0) ||
            (dayData.edwNetSales && dayData.edwNetSales > 0) ||
            (dayData.ohbNetSales && dayData.ohbNetSales > 0)
          );
        });
        
        if (!hasData) {
          console.log('\n⚠️  警告: データ構造は存在しますが、売上データの値が0または空です。');
        }
      } else {
        console.log('\n⚠️  警告: daily_dataが空です。');
      }
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkAugustSalesData();

