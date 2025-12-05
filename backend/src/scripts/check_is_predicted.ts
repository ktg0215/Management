import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkIsPredicted() {
  try {
    console.log('データベースのis_predictedフラグを確認中...\n');
    
    const result = await pool.query(`
      SELECT daily_data
      FROM sales_data
      WHERE store_id = 1 AND year = 2025 AND month = 12
    `);
    
    if (result.rows.length === 0) {
      console.log('2025年12月のデータが見つかりません');
      await pool.end();
      return;
    }
    
    const dailyData = result.rows[0].daily_data || {};
    console.log('daily_dataのキー:', Object.keys(dailyData));
    console.log('');
    
    // 日付文字列キーと数値キーの両方を確認
    const keysToCheck = ['2025-12-01', '2025-12-02', '2025-12-03', '1', '2', '3'];
    
    for (const key of keysToCheck) {
      if (dailyData[key]) {
        const dayData = dailyData[key];
        console.log(`キー "${key}":`);
        console.log(`  - is_predicted: ${dayData.is_predicted} (型: ${typeof dayData.is_predicted})`);
        console.log(`  - netSales: ${dayData.netSales}`);
        console.log(`  - edwNetSales: ${dayData.edwNetSales}`);
        console.log(`  - ohbNetSales: ${dayData.ohbNetSales}`);
        console.log(`  - date: ${dayData.date}`);
        console.log('');
      }
    }
    
    await pool.end();
  } catch (err) {
    console.error('エラー:', err);
    await pool.end();
    process.exit(1);
  }
}

checkIsPredicted();

