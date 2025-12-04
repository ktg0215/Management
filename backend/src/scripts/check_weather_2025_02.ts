// 2025年2月の天気データを確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkWeatherData() {
  try {
    console.log('2025年2月の天気データを確認中...\n');
    
    // 2025年2月の天気データを取得
    const result = await pool.query(
      `SELECT date, weather, temperature 
       FROM weather_data 
       WHERE date >= '2025-02-01' AND date <= '2025-02-28' 
       ORDER BY date`,
      []
    );
    
    console.log(`総レコード数: ${result.rows.length}件\n`);
    
    const missingWeather: any[] = [];
    const emptyWeather: any[] = [];
    
    // 2月の全日をチェック
    for (let day = 1; day <= 28; day++) {
      const dateStr = `2025-02-${String(day).padStart(2, '0')}`;
      const row = result.rows.find(r => {
        let rowDate: string;
        if (r.date instanceof Date) {
          rowDate = r.date.toISOString().split('T')[0];
        } else {
          const dateStr = String(r.date);
          // タイムゾーン情報を含む場合は分割
          if (dateStr.includes('T')) {
            rowDate = dateStr.split('T')[0];
          } else if (dateStr.includes(' ')) {
            // "Mon Feb 10 2025 00:00:00 GMT+0900"形式の場合
            const dateObj = new Date(dateStr);
            rowDate = dateObj.toISOString().split('T')[0];
          } else {
            rowDate = dateStr;
          }
        }
        return rowDate === dateStr;
      });
      
      if (!row) {
        missingWeather.push({ date: dateStr, weather: null, temperature: null });
      } else if (!row.weather || row.weather.trim() === '') {
        emptyWeather.push({ date: dateStr, weather: row.weather, temperature: row.temperature });
      }
    }
    
    console.log('=== 天気データがない日 ===');
    if (missingWeather.length === 0) {
      console.log('なし');
    } else {
      missingWeather.forEach(item => {
        console.log(`${item.date}: データなし`);
      });
    }
    
    console.log('\n=== 天気データが空文字列の日 ===');
    if (emptyWeather.length === 0) {
      console.log('なし');
    } else {
      emptyWeather.forEach(item => {
        console.log(`${item.date}: weather="${item.weather}", temperature=${item.temperature}`);
      });
    }
    
    console.log('\n=== サンプルデータ（最初の5件） ===');
    result.rows.slice(0, 5).forEach(row => {
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0];
      console.log(`${dateStr}: weather="${row.weather || ''}", temperature=${row.temperature}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkWeatherData();

