// "null"文字列を直接修正するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';
import https from 'https';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

// 富山県の緯度経度
const LATITUDE = 36.66995390;
const LONGITUDE = 137.20684780;

// Visual Crossing APIから天気データを取得
async function fetchWeatherDataFromVisualCrossing(latitude: number, longitude: number, date: Date): Promise<{ weather: string; temperature: number | null; humidity: number | null; precipitation: number | null; snow: number | null }> {
  const API_KEY = process.env.VISUAL_CROSSING_API_KEY || '2BE5S9Y63SA2EXGEALZG7S7QM';
  const dateStr = date.toISOString().split('T')[0];
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${latitude},${longitude}/${dateStr}?unitGroup=metric&key=${API_KEY}`;

  const weatherTranslation: Record<string, string> = {
    "Clear": "晴れ",
    "Partially cloudy": "晴れ時々曇り",
    "Rain": "雨",
    "Snow": "雪",
    "Overcast": "曇り",
    "Fog": "霧",
    "Thunderstorm": "雷雨",
    "Showers": "にわか雨",
  };

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`[Visual Crossing API] HTTPエラー: ${res.statusCode}`);
            resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
            return;
          }
          
          const weatherData = JSON.parse(data);
          
          if (weatherData.days && weatherData.days.length > 0) {
            const day = weatherData.days[0];
            const condition = day.conditions || '';
            let weather = condition;
            
            // 天気を日本語に翻訳
            for (const [key, value] of Object.entries(weatherTranslation)) {
              if (condition.toLowerCase().includes(key.toLowerCase())) {
                weather = value;
                break;
              }
            }
            
            const humidity = day.humidity !== null && day.humidity !== undefined ? Math.round(day.humidity * 100) / 100 : null;
            const precipitation = day.precip !== null && day.precip !== undefined ? Math.round(day.precip * 100) / 100 : (day.precipitation !== null && day.precipitation !== undefined ? Math.round(day.precipitation * 100) / 100 : null);
            const snow = day.snow !== null && day.snow !== undefined ? Math.round(day.snow * 100) / 100 : null;
            
            resolve({
              weather,
              temperature: day.temp !== null && day.temp !== undefined ? Math.round(day.temp) : null,
              humidity,
              precipitation,
              snow
            });
          } else {
            resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
          }
        } catch (err) {
          console.error('[Visual Crossing API] パースエラー:', err);
          resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
        }
      });
    }).on('error', (err) => {
      console.error('[Visual Crossing API] ネットワークエラー:', err);
      resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
    });
  });
}

async function fixNullString() {
  try {
    console.log('"null"文字列を修正中...\n');
    
    // 2025-02-10のデータを確認
    const checkResult = await pool.query(
      `SELECT id, date, weather, temperature FROM weather_data 
       WHERE date = '2025-02-10' AND latitude = $1 AND longitude = $2`,
      [LATITUDE, LONGITUDE]
    );
    
    console.log(`2025-02-10のレコード数: ${checkResult.rows.length}`);
    checkResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}, weather: "${row.weather}", type: ${typeof row.weather}, length: ${row.weather?.length || 0}`);
      if (row.weather) {
        const weatherStr = String(row.weather);
        console.log(`  Char codes: ${Array.from(weatherStr).map(c => c.charCodeAt(0)).join(',')}`);
      }
    });
    
    // "null"文字列をNULLに更新（すべてのパターンを試す）
    const updateResult = await pool.query(
      `UPDATE weather_data 
       SET weather = NULL 
       WHERE date = '2025-02-10' 
       AND latitude = $1 AND longitude = $2
       AND (weather = 'null' OR weather = '"null"' OR weather LIKE '%null%' OR weather = '')`,
      [LATITUDE, LONGITUDE]
    );
    console.log(`\n${updateResult.rowCount}件のレコードを更新しました`);
    
    // 空の天気データを再取得
    const date20250210 = new Date('2025-02-10');
    console.log('\n2025-02-10の天気データを再取得中...');
    const weatherData = await fetchWeatherDataFromVisualCrossing(LATITUDE, LONGITUDE, date20250210);
    
    if (weatherData.weather || weatherData.temperature !== null) {
      await pool.query(
        `UPDATE weather_data 
         SET weather = $1, temperature = $2, humidity = $3, precipitation = $4, snow = $5, updated_at = NOW()
         WHERE date = '2025-02-10' AND latitude = $6 AND longitude = $7`,
        [weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow, LATITUDE, LONGITUDE]
      );
      console.log(`2025-02-10のデータを更新しました: weather="${weatherData.weather}", temperature=${weatherData.temperature}`);
    } else {
      console.log('2025-02-10のデータを取得できませんでした');
    }
    
    // 最終確認
    const finalResult = await pool.query(
      `SELECT date, weather, temperature FROM weather_data 
       WHERE date = '2025-02-10' AND latitude = $1 AND longitude = $2`,
      [LATITUDE, LONGITUDE]
    );
    console.log('\n最終確認:');
    finalResult.rows.forEach(row => {
      console.log(`  date: ${row.date}, weather: "${row.weather}", temperature: ${row.temperature}`);
    });
    
    console.log('\n修正完了！');
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

fixNullString();

