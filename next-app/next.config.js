/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker用のスタンドアロンビルドを有効化
  output: 'standalone',
  // 静的ファイルの最適化
  images: {
    unoptimized: true
  },
  // 本番環境用の設定
  poweredByHeader: false,
  compress: true,
  // 環境変数の設定
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // 最適化されたキャッシュ設定
  generateEtags: true,
  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig 