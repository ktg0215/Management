// 2025年2月の天気データを直接確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function verifyWeatherData() {
  try {
    console.log('2025年2月の天気データを直接確認中...\n');
    
    // 2025-02-28を直接確認
    const result28 = await pool.query(
      `SELECT date, weather, temperature FROM weather_data WHERE date = $1`,
      ['2025-02-28']
    );
    console.log('2025-02-28のデータ:');
    if (result28.rows.length === 0) {
      console.log('  データなし');
    } else {
      result28.rows.forEach(row => {
        const dateStr = row.date instanceof Date 
          ? row.date.toISOString().split('T')[0]
          : String(row.date).split('T')[0];
        console.log(`  date: ${dateStr}, weather: "${row.weather}", temperature: ${row.temperature}`);
      });
    }
    
    // 2025-02-10を直接確認
    const result10 = await pool.query(
      `SELECT date, weather, temperature FROM weather_data WHERE date = $1`,
      ['2025-02-10']
    );
    console.log('\n2025-02-10のデータ:');
    if (result10.rows.length === 0) {
      console.log('  データなし');
    } else {
      result10.rows.forEach(row => {
        const dateStr = row.date instanceof Date 
          ? row.date.toISOString().split('T')[0]
          : String(row.date).split('T')[0];
        console.log(`  date: ${dateStr}, weather: "${row.weather}", temperature: ${row.temperature}`);
        console.log(`  weather type: ${typeof row.weather}, length: ${row.weather?.length || 0}`);
        if (row.weather) {
          console.log(`  weather char codes: ${Array.from(String(row.weather)).map(c => c.charCodeAt(0)).join(',')}`);
        }
      });
    }
    
    // すべての2月のデータを確認
    const allResult = await pool.query(
      `SELECT date, weather, temperature FROM weather_data 
       WHERE date >= '2025-02-01' AND date <= '2025-02-28' 
       ORDER BY date`,
      []
    );
    console.log(`\n2月の全データ: ${allResult.rows.length}件`);
    allResult.rows.forEach(row => {
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0];
      const weather = row.weather || '';
      if (!weather || weather.trim() === '' || weather === 'null' || weather === '"null"') {
        console.log(`  ${dateStr}: weather="${weather}", temperature=${row.temperature}`);
      }
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

verifyWeatherData();

