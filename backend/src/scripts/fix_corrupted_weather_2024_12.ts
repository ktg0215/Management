// 2024年12月の文字化けした天気データを修正するスクリプト
// Visual Crossing APIから再取得して更新

import dotenv from 'dotenv';
import { Pool } from 'pg';
import https from 'https';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

const API_KEY = process.env.VISUAL_CROSSING_API_KEY || '2BE5S9Y63SA2EXGEALZG7S7QM';

// 店舗ID 1（富山二口店）の緯度経度
const STORE_ID = 1;
const DEFAULT_LATITUDE = 36.66995390;
const DEFAULT_LONGITUDE = 137.20684780;

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

function translateWeather(condition: string): string {
  if (!condition) return '';
  
  const conditionLower = condition.toLowerCase();
  for (const [key, value] of Object.entries(weatherTranslation)) {
    if (conditionLower.includes(key.toLowerCase())) {
      return value;
    }
  }
  return condition;
}

async function fetchWeatherDataFromVisualCrossing(
  latitude: number,
  longitude: number,
  date: Date
): Promise<{ weather: string; temperature: number | null; humidity: number | null; precipitation: number | null; snow: number | null }> {
  const dateStr = date.toISOString().split('T')[0];
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${latitude},${longitude}/${dateStr}?unitGroup=metric&key=${API_KEY}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`[Visual Crossing API] HTTPエラー: ${res.statusCode}, 日付: ${dateStr}`);
            if (res.statusCode === 429) {
              console.error('レート制限に達しました。しばらく待ってから再試行してください。');
            }
            resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
            return;
          }
          const weatherData = JSON.parse(data);
          if (weatherData.days && weatherData.days.length > 0) {
            const day = weatherData.days[0];
            const condition = day.conditions || '';
            const weather = translateWeather(condition);
            
            resolve({
              weather,
              temperature: day.temp !== null && day.temp !== undefined ? Math.round(day.temp) : null,
              humidity: day.humidity !== null && day.humidity !== undefined ? Math.round(day.humidity * 100) / 100 : null,
              precipitation: day.precip !== null && day.precip !== undefined ? Math.round(day.precip * 100) / 100 : (day.precipitation !== null && day.precipitation !== undefined ? Math.round(day.precipitation * 100) / 100 : null),
              snow: day.snow !== null && day.snow !== undefined ? Math.round(day.snow * 100) / 100 : null
            });
          } else {
            console.warn(`[Visual Crossing API] 日次データが見つかりませんでした。日付: ${dateStr}`);
            resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
          }
        } catch (err) {
          console.error(`[Visual Crossing API] パースエラー (${dateStr}):`, err);
          resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
        }
      });
    }).on('error', (err) => {
      console.error(`[Visual Crossing API] ネットワークエラー (${dateStr}):`, err);
      resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
    });
  });
}

async function fixCorruptedWeatherData() {
  console.log('2024年12月の文字化けした天気データを修正開始...');
  
  try {
    // 店舗の緯度経度を取得
    const storeResult = await pool.query(
      'SELECT latitude, longitude FROM stores WHERE id = $1',
      [STORE_ID]
    );
    
    if (storeResult.rows.length === 0) {
      console.error(`店舗ID ${STORE_ID} が見つかりません`);
      process.exit(1);
    }
    
    const store = storeResult.rows[0];
    const latitude = store.latitude || DEFAULT_LATITUDE;
    const longitude = store.longitude || DEFAULT_LONGITUDE;
    
    console.log(`店舗ID ${STORE_ID} の緯度: ${latitude}, 経度: ${longitude}\n`);
    
    // 2024年12月の文字化けしたデータを検出
    const corruptedResult = await pool.query(
      `SELECT date, weather FROM weather_data 
       WHERE latitude = $1 AND longitude = $2 
       AND date >= '2024-12-01' AND date <= '2024-12-31'
       AND (weather LIKE '%�%' OR weather LIKE '%���%' OR weather = '' OR weather IS NULL)`,
      [latitude, longitude]
    );
    
    console.log(`文字化けまたは空のデータ: ${corruptedResult.rows.length}件\n`);
    
    if (corruptedResult.rows.length === 0) {
      console.log('修正対象のデータがありません。');
      await pool.end();
      return;
    }
    
    let fetchedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    // 各日付のデータを再取得
    for (let i = 0; i < corruptedResult.rows.length; i++) {
      const row = corruptedResult.rows[i];
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0];
      const date = new Date(dateStr);
      
      try {
        console.log(`[${i + 1}/${corruptedResult.rows.length}] ${dateStr}: 天気データを再取得中...`);
        const weatherData = await fetchWeatherDataFromVisualCrossing(latitude, longitude, date);
        
        if (weatherData.weather || weatherData.temperature !== null) {
          await pool.query(
            `UPDATE weather_data 
             SET weather = $1, temperature = $2, humidity = $3, precipitation = $4, snow = $5, updated_at = NOW()
             WHERE latitude = $6 AND longitude = $7 AND date = $8`,
            [weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow, latitude, longitude, dateStr]
          );
          updatedCount++;
          console.log(`  ✓ 更新完了: 天気=${weatherData.weather || 'null'}, 気温=${weatherData.temperature || 'null'}°C`);
        } else {
          console.log(`  ⚠ データが取得できませんでした`);
          errorCount++;
        }
        
        // レート制限を回避するため、リクエスト間に200msの遅延を追加
        if (i < corruptedResult.rows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (err) {
        console.error(`  ✗ エラー:`, err);
        errorCount++;
      }
    }
    
    console.log('\n=== 修正完了 ===');
    console.log(`更新: ${updatedCount}件`);
    console.log(`エラー: ${errorCount}件`);
    console.log(`合計処理: ${updatedCount}件`);
    
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCorruptedWeatherData();

