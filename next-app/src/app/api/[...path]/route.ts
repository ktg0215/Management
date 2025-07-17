import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://management-backend:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, 'GET', resolvedParams.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, 'POST', resolvedParams.path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, 'PUT', resolvedParams.path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, 'DELETE', resolvedParams.path);
}

async function proxyRequest(request: NextRequest, method: string, pathSegments: string[]) {
  try {
    const authorization = request.headers.get('authorization');
    const url = `${BACKEND_URL}/api/${pathSegments.join('/')}`;
    
    // クエリパラメータを追加
    const searchParams = request.nextUrl.searchParams;
    const fullUrl = searchParams.toString() ? `${url}?${searchParams.toString()}` : url;
    
    let body;
    if (method !== 'GET' && method !== 'DELETE') {
      body = await request.text();
    }

    console.log(`Proxying ${method} request to: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authorization && { 'Authorization': authorization }),
      },
      ...(body && { body }),
    });

    const data = await response.text();
    
    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    console.error(`API proxy error (${method} ${pathSegments.join('/')}):`, error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
} 