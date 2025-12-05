import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function addPredictedFlag() {
  try {
    console.log('予測値フラグを手動で追加中...\n');
    
    // 2025年12月のデータを取得
    const result = await pool.query(`
      SELECT id, store_id, year, month, daily_data
      FROM sales_data
      WHERE year = 2025 AND month = 12 AND store_id = 1
    `);
    
    if (result.rows.length === 0) {
      console.log('2025年12月のデータが見つかりません');
      await pool.end();
      return;
    }
    
    const row = result.rows[0];
    const dailyData = row.daily_data || {};
    
    console.log(`店舗ID: ${row.store_id}, 年: ${row.year}, 月: ${row.month}`);
    console.log(`日付キー数: ${Object.keys(dailyData).length}\n`);
    
    let updatedCount = 0;
    
    // 12月1、2、3日のデータにis_predictedフラグを追加
    for (const dayKey of ['1', '2', '3']) {
      if (dailyData[dayKey]) {
        const dayData = dailyData[dayKey];
        
        // 既にis_predictedが設定されている場合はスキップ
        if (dayData.is_predicted === true) {
          console.log(`${dayKey}日: 既にis_predicted=trueが設定されています`);
          continue;
        }
        
        // is_predictedフラグを追加
        dailyData[dayKey] = {
          ...dayData,
          is_predicted: true,
          predicted_at: new Date().toISOString(),
        };
        
        updatedCount++;
        console.log(`${dayKey}日: is_predictedフラグを追加しました`);
        console.log(`  - netSales: ${dayData.netSales || 'N/A'}`);
        console.log(`  - edwNetSales: ${dayData.edwNetSales || 'N/A'}`);
        console.log(`  - ohbNetSales: ${dayData.ohbNetSales || 'N/A'}`);
      } else {
        console.log(`${dayKey}日: データが存在しません`);
      }
    }
    
    if (updatedCount > 0) {
      // データベースを更新
      await pool.query(
        'UPDATE sales_data SET daily_data = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(dailyData), row.id]
      );
      
      console.log(`\n${updatedCount}件のデータを更新しました`);
    } else {
      console.log('\n更新するデータがありませんでした');
    }
    
    await pool.end();
  } catch (err) {
    console.error('エラー:', err);
    await pool.end();
    process.exit(1);
  }
}

addPredictedFlag();

