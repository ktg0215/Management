# Management System

## 概要
シフト管理システム - Next.js + Docker + PostgreSQL を使用したフルスタック Web アプリケーション

## 🚀 機能

### 管理者機能
- **ダッシュボード**: 店舗の統計情報表示
- **シフト管理**: 従業員のシフト承認・管理
- **売上管理**: 月次売上データの管理
- **損益管理**: P&L作成・管理
- **従業員管理**: 従業員の追加・編集・削除
- **店舗管理**: 店舗情報の管理
- **取引先管理**: 取引先情報の管理
- **業態管理**: 業態の設定・管理

### 従業員機能
- **シフト提出**: シフト希望の提出
- **シフト履歴**: 過去のシフト履歴確認
- **ダッシュボード**: 個人の勤務状況確認

## 🛠️ 技術スタック

### フロントエンド
- **Next.js 15.3.5** (App Router)
- **React 18.2.0**
- **TypeScript 5**
- **Tailwind CSS 3.4.0**
- **Zustand 5.0.6** (状態管理)
- **Lucide React** (アイコン)

### バックエンド
- **Node.js 18**
- **Express.js**
- **PostgreSQL 15**

### 開発・運用
- **Docker & Docker Compose**
- **ESLint** (コード品質管理)
- **ExcelJS** (Excel出力機能)

## 🔧 セットアップ

### 必要な環境
- Docker Desktop
- Node.js 18以上
- Git

### 1. リポジトリのクローン
```bash
git clone https://github.com/ktg0215/Management.git
cd Management
```

### 2. 環境変数の設定
```bash
# .env.local ファイルを作成
cp .env.example .env.local
```

### 3. Docker環境の起動
```bash
# 全サービスを起動
docker-compose up -d

# ログを確認
docker-compose logs -f
```

### 4. アプリケーションにアクセス
- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:3001
- **データベース**: localhost:5432

## 📊 システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Port 80/443)                  │
│                    (Reverse Proxy)                          │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴────────────────┐
                │                                │
┌───────────────▼────────────────┐  ┌───────────▼────────────────┐
│         Frontend                │  │         Backend             │
│       (Next.js App)             │  │      (Node.js API)          │
│         Port 3000               │  │         Port 3001           │
└─────────────────────────────────┘  └─────────────────────────────┘
                                                │
                                ┌───────────────▼────────────────┐
                                │         Database                │
                                │       (PostgreSQL)              │
                                │         Port 5432               │
                                └─────────────────────────────────┘
```

## 🔐 セキュリティ

### 実装済みセキュリティ対策
- **認証・認可**: JWT ベースの認証システム
- **CORS設定**: 適切なCORS設定
- **入力検証**: フロントエンド・バックエンドでの入力検証
- **SQL インジェクション対策**: パラメータ化クエリ
- **XSS対策**: React の自動エスケープ機能
- **脆弱性対策**: 定期的なパッケージ更新

### セキュリティ監査結果
```
✅ npm audit: 0 vulnerabilities found
```

## 📈 パフォーマンス

### 最適化項目
- **Next.js App Router**: 最新のルーティングシステム
- **TypeScript**: 型安全性とコード品質
- **Docker最適化**: マルチステージビルド
- **データベース最適化**: 適切なインデックス設定

### パフォーマンス指標
- **TypeScript**: 0 エラー
- **ESLint**: 警告数75%削減
- **ビルド時間**: 最適化済み
- **メモリ使用量**: 効率的な利用

## 🧪 テスト

### 品質保証
- **TypeScript型チェック**: `npm run type-check`
- **ESLint検査**: `npm run lint`
- **セキュリティ監査**: `npm audit`

### 実行方法
```bash
# フロントエンド内でテスト実行
docker-compose exec frontend npm run lint
docker-compose exec frontend npm run type-check
```

## 🚀 デプロイ

### 本番環境デプロイ
```bash
# 本番ビルド
docker-compose -f docker-compose.prod.yml up -d

# ヘルスチェック
docker-compose ps
```

## 📝 API ドキュメント

### 認証
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - ユーザー情報取得

### シフト管理
- `GET /api/shifts` - シフト一覧取得
- `POST /api/shifts` - シフト作成
- `PUT /api/shifts/:id` - シフト更新
- `DELETE /api/shifts/:id` - シフト削除

### 売上管理
- `GET /api/sales` - 売上データ取得
- `POST /api/sales` - 売上データ作成
- `PUT /api/sales/:id` - 売上データ更新

## 🤝 開発への貢献

### 開発フロー
1. リポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### コーディング規約
- **TypeScript**: 厳密な型定義
- **ESLint**: 設定に従ったコーディング
- **Prettier**: 自動フォーマッティング
- **Git**: 意味のあるコミットメッセージ

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🆘 サポート

### 問題報告
- GitHub Issues: [Issues](https://github.com/ktg0215/Management/issues)
- メール: [サポート用メールアドレス]

### よくある質問
- **Docker起動エラー**: `docker-compose down` → `docker-compose up -d`
- **ポート競合**: 他のサービスが3000, 3001ポートを使用していないか確認
- **データベース接続エラー**: PostgreSQLコンテナが起動しているか確認

## 🔄 更新履歴

### v1.0.0 (2024-07-16)
- 初回リリース
- セキュリティ脆弱性の完全解決
- TypeScript型安全性の向上
- ESLint警告の大幅削減
- Docker環境の最適化

---
**開発者**: ktg0215  
**最終更新**: 2024-07-16  
**ステータス**: 本番運用可能 ✅