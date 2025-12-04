// 重複した天気データを修正するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

// 富山県の緯度経度
const LATITUDE = 36.66995390;
const LONGITUDE = 137.20684780;

async function fixDuplicateWeather() {
  try {
    console.log('重複した天気データを確認・修正中...\n');
    
    // 2025年2月の重複データを確認
    const duplicatesResult = await pool.query(
      `SELECT date, COUNT(*) as count, 
              array_agg(id) as ids, 
              array_agg(weather) as weathers
       FROM weather_data 
       WHERE date >= '2025-02-01' AND date <= '2025-02-28'
       AND latitude = $1 AND longitude = $2
       GROUP BY date
       HAVING COUNT(*) > 1
       ORDER BY date`,
      [LATITUDE, LONGITUDE]
    );
    
    console.log(`重複データ: ${duplicatesResult.rows.length}件\n`);
    
    for (const row of duplicatesResult.rows) {
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0];
      
      console.log(`${dateStr}: ${row.count}件のレコード`);
      console.log(`  IDs: ${row.ids.join(', ')}`);
      console.log(`  Weathers: ${row.weathers.join(', ')}`);
      
      // 天気データが空でないレコードを優先して残し、他のレコードを削除
      const detailResult = await pool.query(
        `SELECT id, weather, temperature, updated_at 
         FROM weather_data 
         WHERE date = $1 AND latitude = $2 AND longitude = $3
         ORDER BY 
           CASE WHEN weather IS NOT NULL AND weather != '' AND weather != 'null' THEN 0 ELSE 1 END,
           updated_at DESC`,
        [dateStr, LATITUDE, LONGITUDE]
      );
      
      if (detailResult.rows.length > 1) {
        // 最初のレコード（最も良いデータ）を残し、残りを削除
        const keepId = detailResult.rows[0].id;
        const deleteIds = detailResult.rows.slice(1).map(r => r.id);
        
        console.log(`  保持するID: ${keepId} (weather: "${detailResult.rows[0].weather}")`);
        console.log(`  削除するIDs: ${deleteIds.join(', ')}`);
        
        await pool.query(
          `DELETE FROM weather_data WHERE id = ANY($1)`,
          [deleteIds]
        );
        
        console.log(`  ${deleteIds.length}件のレコードを削除しました\n`);
      }
    }
    
    // 空の天気データを再確認
    console.log('\n空の天気データを確認中...');
    const emptyResult = await pool.query(
      `SELECT date, weather, temperature FROM weather_data 
       WHERE date >= '2025-02-01' AND date <= '2025-02-28'
       AND latitude = $1 AND longitude = $2
       AND (weather IS NULL OR weather = '' OR weather = 'null')
       ORDER BY date`,
      [LATITUDE, LONGITUDE]
    );
    
    console.log(`空の天気データ: ${emptyResult.rows.length}件`);
    emptyResult.rows.forEach(row => {
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0];
      console.log(`  ${dateStr}: weather="${row.weather}", temperature=${row.temperature}`);
    });
    
    console.log('\n修正完了！');
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

fixDuplicateWeather();

