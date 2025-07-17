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

    // TODO: 実際のデータベースクエリに置き換える
    // const monthlyData = await db.monthlyData.findMany({
    //   where: {
    //     storeId,
    //     businessTypeId,
    //   },
    //   orderBy: [
    //     { year: 'asc' },
    //     { month: 'asc' }
    //   ]
    // });

    // 現在は空配列を返す
    const monthlyData: MonthlyData[] = [];

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

    // TODO: 実際のデータベース保存処理に置き換える
    // const savedData = await db.monthlyData.upsert({
    //   where: {
    //     storeId_businessTypeId_year_month: {
    //       storeId,
    //       businessTypeId,
    //       year,
    //       month
    //     }
    //   },
    //   update: {
    //     data,
    //     updatedAt: new Date()
    //   },
    //   create: {
    //     id: generateId(),
    //     storeId,
    //     businessTypeId,
    //     year,
    //     month,
    //     data,
    //     createdAt: new Date(),
    //     updatedAt: new Date()
    //   }
    // });

    return NextResponse.json({
      success: true,
      message: 'データが正常に保存されました'
    });

  } catch (error) {
    console.error('月次データ保存エラー:', error);
    return NextResponse.json(
      { success: false, error: 'データの保存に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE: 月次データの削除
export async function DELETE(request: NextRequest) {
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

    // TODO: 実際のデータベース削除処理に置き換える
    // await db.monthlyData.deleteMany({
    //   where: {
    //     storeId,
    //     businessTypeId
    //   }
    // });

    return NextResponse.json({
      success: true,
      message: 'データが正常に削除されました'
    });

  } catch (error) {
    console.error('月次データ削除エラー:', error);
    return NextResponse.json(
      { success: false, error: 'データの削除に失敗しました' },
      { status: 500 }
    );
  }
}