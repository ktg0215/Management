// データベース内の天気の種類を確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkWeatherTypes() {
  try {
    console.log('データベース内の天気の種類を確認中...\n');
    
    // データベース内の天気の種類を取得
    const result = await pool.query(
      `SELECT DISTINCT weather, COUNT(*) as count 
       FROM weather_data 
       WHERE weather IS NOT NULL AND weather != '' 
       GROUP BY weather 
       ORDER BY count DESC, weather`,
      []
    );
    
    console.log(`=== データベース内の天気の種類（総数: ${result.rows.length}種類）===\n`);
    result.rows.forEach((row, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${row.weather.padEnd(20, ' ')} (${row.count}件)`);
    });
    
    console.log('\n=== フロントエンドで使用されているアイコンの種類 ===\n');
    console.log('1. Sun (太陽) - 晴れ');
    console.log('2. Cloud (雲) - 曇り');
    console.log('3. CloudRain (雨雲) - 雨');
    console.log('4. CloudDrizzle (小雨雲) - にわか雨');
    console.log('5. CloudSnow (雪雲) - 雪');
    console.log('6. CloudLightning (雷雲) - 雷雨');
    console.log('7. Sun + Cloud (太陽+雲) - 晴れ時々曇り、晴れのち曇り');
    
    console.log('\n=== バックエンドで対応している天気コード（JMA）===\n');
    const jmaCodes = [
      '100: 晴れ',
      '101: 晴れ時々曇り',
      '102: 晴れ一時雨',
      '103: 晴れ一時雪',
      '104: 晴れのち曇り',
      '105: 晴れのち雨',
      '106: 晴れのち雪',
      '200: 曇り',
      '201: 曇り時々晴れ',
      '202: 曇り一時雨',
      '203: 曇り一時雪',
      '204: 曇り時々雨',
      '205: 曇り時々雪',
      '206: 曇りのち晴れ',
      '207: 曇りのち雨',
      '208: 曇りのち雪',
      '300: 雨',
      '301: 雨時々止む',
      '302: 雨一時雪',
      '303: 雨のち晴れ',
      '304: 雨のち曇り',
      '305: 雨のち雪',
      '306: 雨時々雪',
      '308: 雨一時強く降る',
      '309: 弱い雨',
      '400: 雪',
      '401: 雪時々止む',
      '402: 雪一時雨',
      '403: 雪のち晴れ',
      '404: 雪のち曇り',
      '405: 雪のち雨',
      '406: 雪時々雨',
      '407: 弱い雪',
    ];
    jmaCodes.forEach((code, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${code}`);
    });
    
    console.log('\n=== Visual Crossing APIで対応している天気の種類 ===\n');
    const visualCrossingTypes = [
      'Clear → 晴れ',
      'Partially cloudy → 晴れ時々曇り',
      'Rain → 雨',
      'Snow → 雪',
      'Overcast → 曇り',
      'Fog → 霧',
      'Thunderstorm → 雷雨',
      'Showers → にわか雨',
    ];
    visualCrossingTypes.forEach((type, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${type}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkWeatherTypes();

