// 日次バッチ：未来1週間の天気データを更新
// このスクリプトは毎日実行されることを想定

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim(),
});

// 未来1週間の天気データを更新する関数
async function updateFutureWeatherForAllStores() {
  try {
    // すべての店舗を取得
    const storesResult = await pool.query(
      'SELECT id, latitude, longitude FROM stores WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
    );
    
    console.log(`${storesResult.rows.length}店舗の天気データを更新します...`);
    
    for (const store of storesResult.rows) {
      await updateFutureWeatherData(store.latitude, store.longitude);
      console.log(`店舗ID ${store.id} の天気データを更新しました`);
    }
    
    console.log('すべての店舗の天気データ更新が完了しました');
  } catch (err) {
    console.error('天気データ更新エラー:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 未来1週間の天気データを一括更新する関数
async function updateFutureWeatherData(latitude: number, longitude: number): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Visual Crossing APIを使用して未来1週間のデータを取得
  const API_KEY = process.env.VISUAL_CROSSING_API_KEY || '2BE5S9Y63SA2EXGEALZG7S7QM';
  const startDate = today.toISOString().split('T')[0];
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${latitude},${longitude}/${startDate}/${endDateStr}?unitGroup=metric&key=${API_KEY}`;
  
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
  
  try {
    const https = require('https');
    const weatherData = await new Promise<any>((resolve, reject) => {
      https.get(url, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
    
    if (weatherData.days && weatherData.days.length > 0) {
      for (const day of weatherData.days) {
        const dateStr = day.datetime;
        const condition = day.conditions || '';
        let weather = condition;
        
        // 天気を日本語に翻訳
        for (const [key, value] of Object.entries(weatherTranslation)) {
          if (condition.toLowerCase().includes(key.toLowerCase())) {
            weather = value;
            break;
          }
        }
        
        const temperature = day.temp || null;
        
        await pool.query(
          `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (latitude, longitude, date) 
           DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, updated_at = NOW()`,
          [latitude, longitude, dateStr, weather || null, temperature]
        );
      }
    }
    
    // 昨日の実績データも取得（Tomorrow.io API）
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const yesterdayCheck = await pool.query(
      `SELECT id FROM weather_data WHERE latitude = $1 AND longitude = $2 AND date = $3`,
      [latitude, longitude, yesterdayStr]
    );
    
    if (yesterdayCheck.rows.length === 0) {
      await updateYesterdayWeatherData(latitude, longitude, yesterday);
    }
  } catch (err) {
    console.error('未来天気データ更新エラー:', err);
  }
}

// 昨日の実績データを取得（Tomorrow.io API）
async function updateYesterdayWeatherData(latitude: number, longitude: number, date: Date): Promise<void> {
  const API_KEY = process.env.TOMORROW_IO_API_KEY || 'LaRsCCbEFOwKGaqHNtprA8Ejyw3ulHCl';
  const https = require('https');
  
  const startTime = new Date(date);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(date);
  endTime.setHours(23, 59, 59, 999);
  
  const payload = {
    location: `${latitude},${longitude}`,
    fields: ['temperatureAvg', 'humidityAvg', 'rainAccumulationSum', 'weatherCodeMax'],
    units: 'metric',
    timesteps: ['1d'],
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  };
  
  const WEATHER_CODE_TRANSLATIONS: Record<number, string> = {
    1000: "晴れ", 1001: "曇り", 1100: "晴れ", 1101: "晴れ時々曇り", 1102: "曇り",
    2000: "霧", 4000: "弱い雨", 4001: "雨", 4200: "弱い雨", 4201: "強い雨",
    5000: "雪", 5100: "弱い雪", 5101: "強い雪", 6000: "凍雨", 6001: "凍雨", 8000: "雷雨",
  };
  
  try {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'api.tomorrow.io',
      path: '/v4/timelines',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'apikey': API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const weatherData = await new Promise<any>((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`API Error: ${res.statusCode}`));
              return;
            }
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    const intervals = weatherData?.data?.timelines?.[0]?.intervals;
    if (intervals && intervals.length > 0) {
      const item = intervals[0];
      const values = item.values;
      const temp = values.temperatureAvg;
      const weatherCode = values.weatherCodeMax;
      const weather = WEATHER_CODE_TRANSLATIONS[weatherCode] || '不明';
      const dateStr = date.toISOString().split('T')[0];
      
      await pool.query(
        `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (latitude, longitude, date) 
         DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, updated_at = NOW()`,
        [latitude, longitude, dateStr, weather, temp !== null && temp !== undefined ? Math.round(temp) : null]
      );
    }
  } catch (err) {
    console.error('昨日の天気実績データ取得エラー:', err);
  }
}

// スクリプト実行
updateFutureWeatherForAllStores();

