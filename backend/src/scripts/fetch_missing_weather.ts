// Visual Crossing APIから不足している天気データを取得するスクリプト
// 店舗ID 1（富山二口店）の不足している日付の天気データを取得

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

async function fetchMissingWeatherData() {
  console.log('不足している天気データを取得開始...');
  
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
    
    // 不足している日付のリスト
    const missingDates: Date[] = [];
    
    // 2025年4月19日～30日
    for (let day = 19; day <= 30; day++) {
      missingDates.push(new Date(2025, 3, day)); // 月は0から始まるため3 = 4月
    }
    
    // 2025年5月1日～31日
    for (let day = 1; day <= 31; day++) {
      missingDates.push(new Date(2025, 4, day)); // 4 = 5月
    }
    
    // 2025年6月1日～30日
    for (let day = 1; day <= 30; day++) {
      missingDates.push(new Date(2025, 5, day)); // 5 = 6月
    }
    
    // 2025年7月1日～31日
    for (let day = 1; day <= 31; day++) {
      missingDates.push(new Date(2025, 6, day)); // 6 = 7月
    }
    
    // 2025年8月1日～31日
    for (let day = 1; day <= 31; day++) {
      missingDates.push(new Date(2025, 7, day)); // 7 = 8月
    }
    
    // 2025年9月1日～30日
    for (let day = 1; day <= 30; day++) {
      missingDates.push(new Date(2025, 8, day)); // 8 = 9月
    }
    
    // 2025年10月1日～31日
    for (let day = 1; day <= 31; day++) {
      missingDates.push(new Date(2025, 9, day)); // 9 = 10月
    }
    
    // 2025年11月1日～29日
    for (let day = 1; day <= 29; day++) {
      missingDates.push(new Date(2025, 10, day)); // 10 = 11月
    }
    
    console.log(`取得対象日数: ${missingDates.length}日\n`);
    
    let fetchedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // 各日付のデータを取得
    for (let i = 0; i < missingDates.length; i++) {
      const date = missingDates[i];
      const dateStr = date.toISOString().split('T')[0];
      
      // 既にデータが存在するか確認
      const existingResult = await pool.query(
        `SELECT id FROM weather_data 
         WHERE latitude = $1 AND longitude = $2 AND date = $3`,
        [latitude, longitude, dateStr]
      );
      
      if (existingResult.rows.length > 0) {
        console.log(`[${i + 1}/${missingDates.length}] ${dateStr}: 既にデータが存在するためスキップ`);
        skippedCount++;
        continue;
      }
      
      try {
        console.log(`[${i + 1}/${missingDates.length}] ${dateStr}: 天気データを取得中...`);
        const weatherData = await fetchWeatherDataFromVisualCrossing(latitude, longitude, date);
        
        if (weatherData.weather || weatherData.temperature !== null) {
          await pool.query(
            `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             ON CONFLICT (latitude, longitude, date) 
             DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
            [latitude, longitude, dateStr, weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow]
          );
          fetchedCount++;
          console.log(`  ✓ 取得完了: 天気=${weatherData.weather || 'null'}, 気温=${weatherData.temperature || 'null'}°C`);
        } else {
          console.log(`  ⚠ データが取得できませんでした`);
          errorCount++;
        }
        
        // レート制限を回避するため、リクエスト間に200msの遅延を追加
        if (i < missingDates.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (err) {
        console.error(`  ✗ エラー:`, err);
        errorCount++;
      }
    }
    
    console.log('\n=== 取得完了 ===');
    console.log(`新規取得: ${fetchedCount}件`);
    console.log(`更新: ${updatedCount}件`);
    console.log(`スキップ: ${skippedCount}件`);
    console.log(`エラー: ${errorCount}件`);
    console.log(`合計処理: ${fetchedCount + updatedCount}件`);
    
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fetchMissingWeatherData();

