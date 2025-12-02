// Visual Crossing APIから2025年5月30日と31日の天気データを取得するスクリプト

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
  date: Date,
  retryCount: number = 0
): Promise<{ weather: string; temperature: number | null; humidity: number | null; precipitation: number | null; snow: number | null }> {
  const dateStr = date.toISOString().split('T')[0];
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${latitude},${longitude}/${dateStr}?unitGroup=metric&key=${API_KEY}`;

  if (retryCount === 0) {
    console.log(`[Visual Crossing API] リクエスト: ${url}`);
  } else {
    console.log(`[Visual Crossing API] リトライ ${retryCount}回目: ${url}`);
  }

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', async () => {
        try {
          if (res.statusCode !== 200) {
            if (res.statusCode === 429) {
              // レート制限エラーの場合、エクスポネンシャルバックオフでリトライ
              if (retryCount < 3) {
                const waitTime = Math.pow(2, retryCount) * 5; // 5秒、10秒、20秒
                console.error(`[Visual Crossing API] レート制限エラー (${res.statusCode})。${waitTime}秒待機してリトライします...`);
                await new Promise(r => setTimeout(r, waitTime * 1000));
                const result = await fetchWeatherDataFromVisualCrossing(latitude, longitude, date, retryCount + 1);
                resolve(result);
                return;
              } else {
                console.error(`[Visual Crossing API] レート制限エラーが続いています。最大リトライ回数に達しました。`);
              }
            } else {
              console.error(`[Visual Crossing API] HTTPエラー: ${res.statusCode}, 日付: ${dateStr}`);
              console.error(`レスポンス: ${data.substring(0, 200)}`);
            }
            resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
            return;
          }
          const weatherData = JSON.parse(data);
          if (weatherData.days && weatherData.days.length > 0) {
            const day = weatherData.days[0];
            const condition = day.conditions || '';
            const weather = translateWeather(condition);
            
            console.log(`[Visual Crossing API] 取得成功: ${dateStr}, 天気=${weather}, 気温=${day.temp}°C`);
            
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

async function fetchMay30And31Weather() {
  console.log('2025年5月30日と31日の天気データを取得開始...\n');
  
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
    
    const dates = [
      new Date(2025, 4, 30), // 5月30日（月は0から始まるため4 = 5月）
      new Date(2025, 4, 31), // 5月31日
    ];
    
    console.log(`取得対象日付: ${dates.map(d => d.toISOString().split('T')[0]).join(', ')}\n`);
    
    let fetchedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const dateStr = date.toISOString().split('T')[0];
      
      try {
        console.log(`[${i + 1}/${dates.length}] ${dateStr}: 天気データを取得中...`);
        const weatherData = await fetchWeatherDataFromVisualCrossing(latitude, longitude, date);
        
        if (weatherData.weather || weatherData.temperature !== null) {
          await pool.query(
            `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             ON CONFLICT (latitude, longitude, date) 
             DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
            [latitude, longitude, dateStr, weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow]
          );
          updatedCount++;
          console.log(`  ✓ 更新完了: 天気=${weatherData.weather || 'null'}, 気温=${weatherData.temperature || 'null'}°C`);
        } else {
          console.log(`  ⚠ データが取得できませんでした`);
          errorCount++;
        }
        
        // レート制限を回避するため、リクエスト間に500msの遅延を追加
        if (i < dates.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`  ✗ エラー:`, err);
        errorCount++;
      }
    }
    
    console.log('\n=== 取得完了 ===');
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

fetchMay30And31Weather();

