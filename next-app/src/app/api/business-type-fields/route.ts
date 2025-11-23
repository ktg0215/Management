import { NextRequest, NextResponse } from 'next/server';

// 業態別フィールド設定を保存するためのインメモリストレージ（本番ではDBに保存）
// キー: businessTypeId, 値: フィールド設定配列
const businessTypeFieldsStorage: Record<string, any[]> = {};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessTypeId = searchParams.get('businessTypeId');

    if (!businessTypeId) {
      return NextResponse.json(
        { success: false, error: 'businessTypeId is required' },
        { status: 400 }
      );
    }

    // 保存されている設定を取得、なければnullを返す
    const fields = businessTypeFieldsStorage[businessTypeId] || null;

    return NextResponse.json({
      success: true,
      data: fields
    });
  } catch (error) {
    console.error('業態別フィールド設定取得エラー:', error);
    return NextResponse.json(
      { success: false, error: 'フィールド設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessTypeId, fields } = body;

    if (!businessTypeId) {
      return NextResponse.json(
        { success: false, error: 'businessTypeId is required' },
        { status: 400 }
      );
    }

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { success: false, error: 'fields must be an array' },
        { status: 400 }
      );
    }

    // フィールド設定を保存
    businessTypeFieldsStorage[businessTypeId] = fields;

    return NextResponse.json({
      success: true,
      message: 'フィールド設定を保存しました'
    });
  } catch (error) {
    console.error('業態別フィールド設定保存エラー:', error);
    return NextResponse.json(
      { success: false, error: 'フィールド設定の保存に失敗しました' },
      { status: 500 }
    );
  }
}
