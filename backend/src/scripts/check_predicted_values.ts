import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkPredictedValues() {
  try {
    console.log('予測値のis_predictedフラグを確認中...\n');
    
    // 2025年12月のデータを確認
    const result = await pool.query(`
      SELECT store_id, year, month, daily_data
      FROM sales_data
      WHERE year = 2025 AND month = 12
      ORDER BY store_id
    `);
    
    console.log(`2025年12月のデータ件数: ${result.rows.length}\n`);
    
    for (const row of result.rows) {
      console.log(`店舗ID: ${row.store_id}, 年: ${row.year}, 月: ${row.month}`);
      
      if (row.daily_data) {
        const dailyData = row.daily_data;
        const dayKeys = Object.keys(dailyData).sort((a, b) => {
          const dayA = parseInt(a);
          const dayB = parseInt(b);
          if (!isNaN(dayA) && !isNaN(dayB)) {
            return dayA - dayB;
          }
          return a.localeCompare(b);
        });
        
        console.log(`  日付キー数: ${dayKeys.length}`);
        
        // 最初の5日分を確認
        for (let i = 0; i < Math.min(5, dayKeys.length); i++) {
          const dayKey = dayKeys[i];
          const dayData = dailyData[dayKey];
          
          if (dayData) {
            const isPredicted = dayData.is_predicted || false;
            const predictedAt = dayData.predicted_at || 'なし';
            const netSales = dayData.netSales || 0;
            const edwNetSales = dayData.edwNetSales || 0;
            const ohbNetSales = dayData.ohbNetSales || 0;
            
            console.log(`    ${dayKey}日:`);
            console.log(`      is_predicted: ${isPredicted}`);
            console.log(`      predicted_at: ${predictedAt}`);
            console.log(`      netSales: ${netSales}`);
            console.log(`      edwNetSales: ${edwNetSales}`);
            console.log(`      ohbNetSales: ${ohbNetSales}`);
            console.log(`      全キー: ${Object.keys(dayData).join(', ')}`);
          }
        }
        
        // is_predictedがtrueの日をカウント
        const predictedDays = dayKeys.filter(key => {
          const dayData = dailyData[key];
          return dayData && dayData.is_predicted === true;
        });
        
        console.log(`  予測値フラグがtrueの日数: ${predictedDays.length}`);
        if (predictedDays.length > 0) {
          console.log(`  予測値フラグがtrueの日: ${predictedDays.join(', ')}`);
        }
      }
      
      console.log('');
    }
    
    await pool.end();
  } catch (err) {
    console.error('エラー:', err);
    await pool.end();
    process.exit(1);
  }
}

checkPredictedValues();

