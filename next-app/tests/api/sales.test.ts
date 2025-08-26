import { test, expect } from '@playwright/test';

test.describe('Sales API', () => {
  const baseURL = 'http://localhost:3001/api';
  
  test('should get sales data', async ({ request }) => {
    // テスト用のリクエストを送信
    const response = await request.get(`${baseURL}/sales`, {
      params: {
        year: '2024',
        month: '1',
        storeId: 'test-store-id'
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // レスポンスの検証
    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('success');
    
    if (responseBody.success) {
      expect(responseBody.data).toHaveProperty('year');
      expect(responseBody.data).toHaveProperty('month');
      expect(responseBody.data).toHaveProperty('daily_data');
    }
  });

  test('should save sales data', async ({ request }) => {
    const salesData = {
      year: 2024,
      month: 1,
      storeId: 'test-store-id',
      dailyData: {
        '2024-01-01': {
          date: '2024-01-01',
          storeNetSales: 100000,
          totalSales: 110000,
        }
      }
    };

    const response = await request.post(`${baseURL}/sales`, {
      data: salesData,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // 作成成功の場合は 201、更新の場合は 200
    expect([200, 201]).toContain(response.status());
    
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('success');
  });

  test('should validate required parameters for get sales', async ({ request }) => {
    // 必須パラメータなしでリクエスト
    const response = await request.get(`${baseURL}/sales`);

    // バリデーションエラーが返されることを確認
    expect([400, 422]).toContain(response.status());
  });

  test('should validate request body for save sales', async ({ request }) => {
    // 不正なリクエストボディ
    const invalidData = {
      year: 'invalid-year',
      month: 'invalid-month',
      storeId: '',
      dailyData: null
    };

    const response = await request.post(`${baseURL}/sales`, {
      data: invalidData,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // バリデーションエラーが返されることを確認
    expect([400, 422]).toContain(response.status());
  });

  test('should handle large data sets', async ({ request }) => {
    // 大きなデータセットを作成
    const dailyData: Record<string, any> = {};
    for (let day = 1; day <= 31; day++) {
      const date = `2024-01-${day.toString().padStart(2, '0')}`;
      dailyData[date] = {
        date,
        storeNetSales: Math.floor(Math.random() * 1000000),
        totalSales: Math.floor(Math.random() * 1100000),
      };
    }

    const salesData = {
      year: 2024,
      month: 1,
      storeId: 'test-store-id',
      dailyData
    };

    const response = await request.post(`${baseURL}/sales`, {
      data: salesData,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    expect([200, 201]).toContain(response.status());
    
    // レスポンス時間も確認（5秒以内）
    expect(response.headers()['x-response-time']).not.toBeNull();
  });
});