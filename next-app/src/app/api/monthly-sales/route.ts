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

// GET: 月次データの取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const businessTypeId = searchParams.get('businessTypeId');

    if (!storeId || !businessTypeId) {
      return NextResponse.json(
        { success: false, error: 'storeIdとbusinessTypeIdが必要です' },
        { status: 400 }
      );
    }

    // バックエンドAPIから月次データを取得
    const response = await fetch(
      `${API_BASE_URL}/api/sales?storeId=${storeId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('バックエンドからのデータ取得に失敗しました');
    }

    const result = await response.json();

    // sales_dataテーブルから取得したデータを変換
    const monthlyData: MonthlyData[] = result.data ? [{
      id: result.data.id || `${storeId}-${result.data.year}-${result.data.month}`,
      storeId: storeId,
      businessTypeId: businessTypeId,
      year: result.data.year,
      month: result.data.month,
      data: typeof result.data.daily_data === 'string'
        ? JSON.parse(result.data.daily_data)
        : result.data.daily_data || {},
      createdAt: new Date(result.data.created_at),
      updatedAt: new Date(result.data.updated_at)
    }] : [];

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