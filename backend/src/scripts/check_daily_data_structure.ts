import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkStructure() {
  try {
    console.log('データベース構造を確認中...\n');
    
    const result = await pool.query(`
      SELECT id, store_id, year, month, daily_data
      FROM sales_data
      WHERE store_id = 1 AND year = 2025 AND month = 12
    `);
    
    if (result.rows.length === 0) {
      console.log('2025年12月のデータが見つかりません');
      await pool.end();
      return;
    }
    
    const row = result.rows[0];
    const dailyData = row.daily_data || {};
    
    console.log(`店舗ID: ${row.store_id}, 年: ${row.year}, 月: ${row.month}`);
    console.log(`daily_dataの型: ${typeof dailyData}`);
    console.log(`daily_dataのキー数: ${Object.keys(dailyData).length}`);
    console.log(`daily_dataのキー: ${Object.keys(dailyData).join(', ')}\n`);
    
    // 各キーの内容を確認
    for (const key of Object.keys(dailyData)) {
      const dayData = dailyData[key];
      console.log(`キー "${key}":`, {
        hasNetSales: !!dayData.netSales,
        netSales: dayData.netSales,
        hasIsPredicted: 'is_predicted' in dayData,
        isPredicted: dayData.is_predicted,
        date: dayData.date,
      });
    }
    
    await pool.end();
  } catch (err) {
    console.error('エラー:', err);
    await pool.end();
    process.exit(1);
  }
}

checkStructure();

