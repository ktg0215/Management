import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function manualPredict() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`予測を手動実行します: ${today}`);
    
    const response = await fetch('http://localhost:3001/api/sales/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || ''}`,
      },
      body: JSON.stringify({
        storeId: 1,
        predictDays: 7,
        startDate: today,
        retrain: false,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('予測が完了しました:', JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.error('予測に失敗しました:', response.status, errorText);
    }
  } catch (error) {
    console.error('予測エラー:', error);
  }
}

manualPredict();

