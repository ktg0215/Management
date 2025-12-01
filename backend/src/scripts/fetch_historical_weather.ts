// 過去の天気データをVisual Crossing APIから取得して保存するスクリプト
// 売上データが存在する期間の天気データを取得

import dotenv from 'dotenv';
import { Pool } from 'pg';
import https from 'https';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

const API_KEY = process.env.VISUAL_CROSSING_API_KEY || '2BE5S9Y63SA2EXGEALZG7S7QM';

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

interface WeatherData {
  weather: string;
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  snow: number | null;
}

async function fetchWeatherDataFromVisualCrossing(latitude: number, longitude: number, date: Date): Promise<WeatherData> {
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

async function fetchHistoricalWeatherForStore(storeId: string, latitude: number, longitude: number) {
  try {
    // 売上データが存在する期間を取得
    const salesResult = await pool.query(
      `SELECT DISTINCT year, month FROM sales_data 
       WHERE store_id = $1 
       ORDER BY year, month`,
      [storeId]
    );
    
    if (salesResult.rows.length === 0) {
      console.log(`店舗ID ${storeId} には売上データがありません`);
      return;
    }
    
    console.log(`店舗ID ${storeId} の売上データ期間: ${salesResult.rows.length}ヶ月`);
    
    let totalDays = 0;
    let fetchedDays = 0;
    let skippedDays = 0;
    let errorDays = 0;
    
    for (const row of salesResult.rows) {
      const year = parseInt(String(row.year));
      const month = parseInt(String(row.month));
      const daysInMonth = new Date(year, month, 0).getDate();
      
      console.log(`\n${year}年${month}月の天気データを取得中...`);
      
      for (let day = 1; day <= daysInMonth; day++) {
        totalDays++;
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        
        // 既にデータが存在するか確認
        const existingResult = await pool.query(
          `SELECT id FROM weather_data 
           WHERE latitude = $1 AND longitude = $2 AND date = $3`,
          [latitude, longitude, dateStr]
        );
        
        if (existingResult.rows.length > 0) {
          skippedDays++;
          continue;
        }
        
        try {
          const weatherData = await fetchWeatherDataFromVisualCrossing(latitude, longitude, date);
          
          if (weatherData.weather || weatherData.temperature !== null) {
            await pool.query(
              `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
               ON CONFLICT (latitude, longitude, date) 
               DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
              [latitude, longitude, dateStr, weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow]
            );
            fetchedDays++;
            
            if (fetchedDays % 10 === 0) {
              console.log(`  進捗: ${fetchedDays}日分のデータを取得しました`);
            }
          }
          
          // レート制限を回避するため、リクエスト間に100msの遅延を追加
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`  エラー (${dateStr}):`, err);
          errorDays++;
        }
      }
    }
    
    console.log(`\n店舗ID ${storeId} の処理完了:`);
    console.log(`  総日数: ${totalDays}日`);
    console.log(`  取得: ${fetchedDays}日`);
    console.log(`  スキップ（既存）: ${skippedDays}日`);
    console.log(`  エラー: ${errorDays}日`);
  } catch (err) {
    console.error(`店舗ID ${storeId} の処理エラー:`, err);
  }
}

async function main() {
  console.log('過去の天気データ取得スクリプトを開始します...');
  
  try {
    // すべての店舗を取得
    const storesResult = await pool.query(
      'SELECT id, latitude, longitude FROM stores WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
    );
    
    console.log(`${storesResult.rows.length}店舗の天気データを取得します\n`);
    
    for (const store of storesResult.rows) {
      await fetchHistoricalWeatherForStore(store.id, store.latitude, store.longitude);
    }
    
    console.log('\nすべての店舗の処理が完了しました');
  } catch (error) {
    console.error('スクリプト実行エラー:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

