/**
 * 予測APIをテスト実行するスクリプト
 */
import fetch from 'node-fetch';

const PREDICTOR_SERVICE_URL = process.env.PREDICTOR_SERVICE_URL || 'http://localhost:8000';

async function testPrediction() {
  try {
    console.log('[テスト] 予測APIを実行中...');
    
    const response = await fetch(`${PREDICTOR_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        store_id: 1,
        predict_days: 7,
        start_date: '2025-12-01',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`予測サービスエラー: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    console.log('[テスト] 予測結果:');
    console.log(`  成功: ${result.success}`);
    console.log(`  予測件数: ${result.predictions?.length || 0}`);
    
    if (result.predictions && result.predictions.length > 0) {
      console.log('\n[テスト] 予測値サンプル（最初の3件）:');
      result.predictions.slice(0, 3).forEach((pred: any, index: number) => {
        console.log(`  ${index + 1}. 日付: ${pred.date}`);
        const keys = Object.keys(pred).filter(k => k !== 'date');
        keys.forEach(key => {
          console.log(`     ${key}: ${pred[key]}`);
        });
      });
    }
    
    if (result.sales_fields) {
      console.log('\n[テスト] 予測対象項目:');
      result.sales_fields.forEach((field: any) => {
        console.log(`  - ${field.key}: ${field.label}`);
      });
    }
    
    console.log('\n[テスト] netSalesが予測対象に含まれているか:');
    const hasNetSales = result.sales_fields?.some((f: any) => 
      f.key.toLowerCase() === 'netsales' || f.key.toLowerCase() === 'net_sales'
    );
    console.log(`  ${hasNetSales ? '❌ 含まれています（問題あり）' : '✅ 含まれていません（正常）'}`);
    
  } catch (err: any) {
    console.error('[テスト] エラー:', err.message);
    process.exit(1);
  }
}

testPrediction();

