import { Pool } from 'pg';
import * as https from 'https';
import * as http from 'http';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'shift_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function triggerPrediction() {
  try {
    console.log('予測APIを呼び出します...');
    
    // まず、認証トークンを取得するためにログイン
    const loginData = JSON.stringify({
      email: '0000@example.com',
      password: 'admin123'
    });

    const loginOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };

    const loginToken = await new Promise<string>((resolve, reject) => {
      const req = http.request(loginOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.token) {
              resolve(response.token);
            } else {
              reject(new Error('ログインに失敗しました: ' + JSON.stringify(response)));
            }
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });

    console.log('ログイン成功。トークンを取得しました。');

    // 予測APIを呼び出す
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + 1); // 明日から
    const startDateStr = startDate.toISOString().split('T')[0];

    const predictData = JSON.stringify({
      storeId: 1,
      predictDays: 7,
      startDate: startDateStr,
      retrain: false
    });

    const predictOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/sales/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginToken}`,
        'Content-Length': Buffer.byteLength(predictData)
      }
    };

    console.log(`予測を実行します: storeId=1, predictDays=7, startDate=${startDateStr}`);

    const predictResponse = await new Promise<any>((resolve, reject) => {
      const req = http.request(predictOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (err) {
            reject(new Error('予測APIのレスポンス解析に失敗: ' + data));
          }
        });
      });
      req.on('error', reject);
      req.write(predictData);
      req.end();
    });

    console.log('予測APIレスポンス:', JSON.stringify(predictResponse, null, 2));

    // データベースで予測値が保存されたか確認
    const checkResult = await pool.query(
      `SELECT 
        daily_data->'5'->>'is_predicted' as day5_is_predicted,
        daily_data->'5'->>'edwNetSales' as day5_edwNetSales,
        daily_data->'5'->>'ohbNetSales' as day5_ohbNetSales,
        daily_data->'2025-12-05'->>'is_predicted' as date5_is_predicted,
        daily_data->'2025-12-05'->>'edwNetSales' as date5_edwNetSales,
        daily_data->'2025-12-05'->>'ohbNetSales' as date5_ohbNetSales
      FROM sales_data 
      WHERE store_id = 1 AND year = 2025 AND month = 12`
    );

    if (checkResult.rows.length > 0) {
      console.log('\nデータベース確認結果:');
      console.log(JSON.stringify(checkResult.rows[0], null, 2));
    } else {
      console.log('\nデータが見つかりませんでした。');
    }

    await pool.end();
    console.log('\n完了しました。');
  } catch (err: any) {
    console.error('エラー:', err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

triggerPrediction();

