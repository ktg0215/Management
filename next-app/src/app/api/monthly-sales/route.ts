import { NextRequest, NextResponse } from 'next/server';

// 月次売上データの型定義
interface MonthlyData {
  id: string;
  storeId: string;
  businessTypeId: string;
  year: number;
  month: number;
  data: Record<string, number | string>;
  createdAt: Date;
  updatedAt: Date;
}

// バックエンドAPIのベースURL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// DBフィールド名からフロントエンドフィールドIDへのマッピング
// DEFAULT_FIELDSのorder値に合わせたマッピング (IDはdefault-{order}形式)
const FIELD_MAPPING: Record<string, { order: number; aggregation: 'sum' | 'average' | 'last' }> = {
  // 売上関連
  'salesTarget': { order: 3, aggregation: 'sum' },         // 売上目標
  'targetCumulative': { order: 4, aggregation: 'last' },   // 目標累計
  'targetRatio': { order: 5, aggregation: 'average' },     // 対目標比
  'yearOverYear': { order: 6, aggregation: 'average' },    // 前年比
  'edwYearOverYear': { order: 7, aggregation: 'average' }, // EDW前年比
  'ohbYearOverYear': { order: 8, aggregation: 'average' }, // OHB前年比
  'netSales': { order: 10, aggregation: 'sum' },           // 店舗純売上
  'netSalesCumulative': { order: 11, aggregation: 'last' }, // 店舗純売上累計
  'edwNetSales': { order: 12, aggregation: 'sum' },        // EDW純売上
  'edwNetSalesCumulative': { order: 13, aggregation: 'last' }, // EDW純売上累計
  'ohbNetSales': { order: 14, aggregation: 'sum' },        // OHB純売上
  'ohbNetSalesCumulative': { order: 16, aggregation: 'last' }, // OHB純売上累計

  // 客数・組数
  'totalGroups': { order: 17, aggregation: 'sum' },        // 組数（計）
  'totalCustomers': { order: 18, aggregation: 'sum' },     // 客数（計）
  'groupUnitPrice': { order: 19, aggregation: 'average' }, // 組単価
  'customerUnitPrice': { order: 20, aggregation: 'average' }, // 客単価

  // 人時・人件費
  'employeeHours': { order: 21, aggregation: 'sum' },      // 社員時間
  'asHours': { order: 22, aggregation: 'sum' },            // AS時間
  'salesPerHour': { order: 23, aggregation: 'average' },   // 人時売上高
  'laborCost': { order: 24, aggregation: 'sum' },          // 人件費額
  'laborCostRate': { order: 25, aggregation: 'average' },  // 人件費率

  // L/D売上
  'lunchSales': { order: 26, aggregation: 'sum' },         // L：売上
  'dinnerSales': { order: 27, aggregation: 'sum' },        // D：売上
  'lunchCustomers': { order: 28, aggregation: 'sum' },     // L：客数
  'dinnerCustomers': { order: 29, aggregation: 'sum' },    // D：客数
  'lunchGroups': { order: 30, aggregation: 'sum' },        // L：組数
  'dinnerGroups': { order: 31, aggregation: 'sum' },       // D：組数
  'lunchUnitPrice': { order: 32, aggregation: 'average' }, // L：単価
  'dinnerUnitPrice': { order: 33, aggregation: 'average' }, // D：単価

  // VOID・過不足
  'voidCount': { order: 37, aggregation: 'sum' },          // VOID件数
  'voidAmount': { order: 38, aggregation: 'sum' },         // VOID金額
  'salesDiscrepancy': { order: 39, aggregation: 'sum' },   // 売上金過不足

  // 総時間・生産性
  'totalHours': { order: 40, aggregation: 'sum' },         // 総時間社員込
  'edwBaitHours': { order: 41, aggregation: 'sum' },       // EDW総時間
  'ohbBaitHours': { order: 42, aggregation: 'sum' },       // OHB総時間
  'edwProductivity': { order: 43, aggregation: 'average' }, // EDW生産性
  'ohbProductivity': { order: 44, aggregation: 'average' }, // OHB生産性
  'totalProductivity': { order: 45, aggregation: 'average' }, // 総生産性

  // アンケート (DEFAULT_FIELDSにはないが互換性のため残す)
  'surveyCount': { order: 91, aggregation: 'sum' },        // アンケート取得枚数
  'surveyRate': { order: 92, aggregation: 'average' },     // アンケート取得率
};

// 日別データを月次集計に変換
function aggregateDailyData(dailyData: Record<string, any>): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  const aggregations: Record<number, { sum: number; count: number; last: number | null }> = {};

  // 日別データをループして集計
  Object.values(dailyData).forEach((dayData: any) => {
    if (typeof dayData !== 'object' || !dayData) return;

    Object.entries(FIELD_MAPPING).forEach(([dbField, { order, aggregation }]) => {
      if (dayData[dbField] !== undefined && dayData[dbField] !== null) {
        const value = typeof dayData[dbField] === 'number' ? dayData[dbField] : parseFloat(dayData[dbField]);
        if (!isNaN(value)) {
          if (!aggregations[order]) {
            aggregations[order] = { sum: 0, count: 0, last: null };
          }
          aggregations[order].sum += value;
          aggregations[order].count += 1;
          aggregations[order].last = value;
        }
      }
    });
  });

  // 集計結果をフィールドIDにマッピング
  Object.entries(FIELD_MAPPING).forEach(([, { order, aggregation }]) => {
    const fieldId = `default-${order}`;
    const agg = aggregations[order];

    if (agg && agg.count > 0) {
      switch (aggregation) {
        case 'sum':
          result[fieldId] = Math.round(agg.sum);
          break;
        case 'average':
          result[fieldId] = Math.round((agg.sum / agg.count) * 100) / 100;
          break;
        case 'last':
          result[fieldId] = agg.last !== null ? Math.round(agg.last) : 0;
          break;
      }
    }
  });

  return result;
}

// GET: 月次データの取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const businessTypeId = searchParams.get('businessTypeId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'storeIdが必要です' },
        { status: 400 }
      );
    }

    // 認証トークンを取得（クッキーまたはヘッダーから）
    const authHeader = request.headers.get('authorization');

    // バックエンドAPIから月次データを取得
    let url = `${API_BASE_URL}/api/sales?storeId=${storeId}`;
    if (year && month) {
      url += `&year=${year}&month=${month}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      throw new Error('バックエンドからのデータ取得に失敗しました');
    }

    const result = await response.json();

    // sales_dataテーブルから取得したデータを変換
    let monthlyData: MonthlyData[] = [];

    if (result.data) {
      // 配列の場合（全期間データ）
      if (Array.isArray(result.data)) {
        monthlyData = result.data.map((item: any) => {
          const dailyData = typeof item.daily_data === 'string'
            ? JSON.parse(item.daily_data)
            : item.daily_data || {};

          // 日別データを月次集計に変換
          const aggregatedData = aggregateDailyData(dailyData);

          return {
            id: item.id || `${storeId}-${item.year}-${item.month}`,
            storeId: storeId,
            businessTypeId: businessTypeId || '',
            year: item.year,
            month: item.month,
            data: aggregatedData,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at)
          };
        });
      } else {
        // 単一オブジェクトの場合（特定月データ）
        const dailyData = typeof result.data.daily_data === 'string'
          ? JSON.parse(result.data.daily_data)
          : result.data.daily_data || {};

        // 日別データを月次集計に変換
        const aggregatedData = aggregateDailyData(dailyData);

        monthlyData = [{
          id: result.data.id || `${storeId}-${result.data.year}-${result.data.month}`,
          storeId: storeId,
          businessTypeId: businessTypeId || '',
          year: result.data.year,
          month: result.data.month,
          data: aggregatedData,
          createdAt: new Date(result.data.created_at),
          updatedAt: new Date(result.data.updated_at)
        }];
      }
    }

    return NextResponse.json({
      success: true,
      data: monthlyData
    });

  } catch (error) {
    console.error('月次データ取得エラー:', error);
    return NextResponse.json(
      { success: false, error: 'データの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: 月次データの保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storeId, businessTypeId, year, month, data } = body;

    if (!storeId || !businessTypeId || !year || !month) {
      return NextResponse.json(
        { success: false, error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }

    // バックエンドAPIにデータを保存
    const response = await fetch(`${API_BASE_URL}/api/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        year,
        month,
        storeId,
        dailyData: data, // monthly-salesのdataをdailyDataとして保存
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'バックエンドへの保存に失敗しました');
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'データが正常に保存されました',
      data: result
    });

  } catch (error) {
    console.error('月次データ保存エラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'データの保存に失敗しました';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE: 月次データの削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!storeId || !year || !month) {
      return NextResponse.json(
        { success: false, error: 'storeId、year、monthが必要です' },
        { status: 400 }
      );
    }

    // バックエンドAPIでデータを削除
    // 注: バックエンドに削除エンドポイントがない場合は、空データで上書きする
    const response = await fetch(`${API_BASE_URL}/api/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        year: parseInt(year),
        month: parseInt(month),
        storeId,
        dailyData: {}, // 空のデータで上書き
      }),
    });

    if (!response.ok) {
      throw new Error('バックエンドでの削除に失敗しました');
    }

    return NextResponse.json({
      success: true,
      message: 'データが正常に削除されました'
    });

  } catch (error) {
    console.error('月次データ削除エラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'データの削除に失敗しました';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}