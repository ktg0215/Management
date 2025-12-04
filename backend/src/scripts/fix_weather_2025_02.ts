// 2025年2月の天気データを修正するスクリプト

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

async function fixWeatherData() {
  try {
    console.log('2025年2月の天気データを修正中...\n');
    
    // 1. "null"という文字列の天気データを修正（シングルクォートとダブルクォートの両方をチェック）
    console.log('1. "null"文字列の天気データを修正中...');
    
    // まず、"null"文字列のレコードを確認
    const nullCheckResult = await pool.query(
      `SELECT date, weather FROM weather_data 
       WHERE date >= '2025-02-01' AND date <= '2025-02-28'
       AND (weather = 'null' OR weather = '"null"' OR weather LIKE '%null%')`,
      []
    );
    console.log(`   "null"文字列のレコード: ${nullCheckResult.rows.length}件`);
    nullCheckResult.rows.forEach(row => {
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0];
      console.log(`     ${dateStr}: weather="${row.weather}"`);
    });
    
    // "null"文字列をNULLに更新
    const nullStringResult = await pool.query(
      `UPDATE weather_data 
       SET weather = NULL 
       WHERE date >= '2025-02-01' AND date <= '2025-02-28'
       AND (weather = 'null' OR weather = '"null"' OR weather LIKE '%null%')`,
      []
    );
    console.log(`   ${nullStringResult.rowCount}件のレコードを更新しました`);
    
    // 2. 2025-02-28のデータを取得
    console.log('\n2. 2025-02-28の天気データを取得中...');
    const date20250228 = new Date('2025-02-28');
    const weatherData = await fetchWeatherDataFromVisualCrossing(LATITUDE, LONGITUDE, date20250228);
    
    if (weatherData.weather || weatherData.temperature !== null) {
      await pool.query(
        `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (latitude, longitude, date) 
         DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
        [LATITUDE, LONGITUDE, '2025-02-28', weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow]
      );
      console.log(`   2025-02-28のデータを保存しました: weather="${weatherData.weather}", temperature=${weatherData.temperature}`);
    } else {
      console.log('   2025-02-28のデータを取得できませんでした');
    }
    
    // 3. 空の天気データを再取得
    console.log('\n3. 空の天気データを再取得中...');
    const emptyWeatherResult = await pool.query(
      `SELECT date FROM weather_data 
       WHERE (weather IS NULL OR weather = '' OR weather = 'null') 
       AND date >= '2025-02-01' AND date <= '2025-02-28'
       ORDER BY date`,
      []
    );
    
    console.log(`   ${emptyWeatherResult.rows.length}件の空データが見つかりました`);
    
    for (const row of emptyWeatherResult.rows) {
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0];
      const date = new Date(dateStr);
      
      console.log(`   ${dateStr}のデータを取得中...`);
      const weatherData = await fetchWeatherDataFromVisualCrossing(LATITUDE, LONGITUDE, date);
      
      if (weatherData.weather || weatherData.temperature !== null) {
        await pool.query(
          `UPDATE weather_data 
           SET weather = $1, temperature = $2, humidity = $3, precipitation = $4, snow = $5, updated_at = NOW()
           WHERE latitude = $6 AND longitude = $7 AND date = $8`,
          [weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow, LATITUDE, LONGITUDE, dateStr]
        );
        console.log(`     ${dateStr}のデータを更新しました: weather="${weatherData.weather}", temperature=${weatherData.temperature}`);
      } else {
        console.log(`     ${dateStr}のデータを取得できませんでした`);
      }
      
      // APIレート制限を避けるため、少し待機
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n修正完了！');
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

fixWeatherData();

