import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const STORE_ID = 1; // EDW富山二口店
const PREDICT_DAYS = 7;
const START_DATE = '2025-12-01'; // 12月1日から予測

async function runPrediction() {
  try {
    console.log('予測値を実行中...\n');
    console.log(`店舗ID: ${STORE_ID}`);
    console.log(`予測日数: ${PREDICT_DAYS}`);
    console.log(`開始日: ${START_DATE}\n`);

    // まず、ログインしてトークンを取得
    const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: '0000@example.com',
        password: 'admin123',
      }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('ログインエラー:', loginResponse.status, errorText);
      process.exit(1);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('ログイン成功\n');

    // 予測を実行
    const predictResponse = await fetch(`${BACKEND_URL}/api/sales/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        storeId: STORE_ID,
        predictDays: PREDICT_DAYS,
        startDate: START_DATE,
      }),
    });

    if (!predictResponse.ok) {
      const errorText = await predictResponse.text();
      console.error('予測エラー:', predictResponse.status, errorText);
      process.exit(1);
    }

    const predictData = await predictResponse.json();
    
    if (predictData.success) {
      console.log('予測が正常に完了しました！\n');
      console.log(`予測結果数: ${predictData.predictions?.length || 0}`);
      
      if (predictData.predictions && predictData.predictions.length > 0) {
        console.log('\n予測結果（最初の5件）:');
        predictData.predictions.slice(0, 5).forEach((pred: any, index: number) => {
          console.log(`  ${index + 1}. ${pred.date}:`);
          console.log(`     - EDW売上: ${pred.edw_sales || pred.edwNetSales || 'N/A'}`);
          console.log(`     - OHB売上: ${pred.ohb_sales || pred.ohbNetSales || 'N/A'}`);
        });
      }
      
      if (predictData.metrics) {
        console.log('\n予測精度:');
        console.log(`  EDW - MAE: ${predictData.metrics.edw?.mae || 'N/A'}`);
        console.log(`  EDW - R2: ${predictData.metrics.edw?.r2 || 'N/A'}`);
        console.log(`  OHB - MAE: ${predictData.metrics.ohb?.mae || 'N/A'}`);
        console.log(`  OHB - R2: ${predictData.metrics.ohb?.r2 || 'N/A'}`);
      }
    } else {
      console.error('予測に失敗しました:', predictData.error || 'Unknown error');
      process.exit(1);
    }
  } catch (err) {
    console.error('エラー:', err);
    process.exit(1);
  }
}

runPrediction();

