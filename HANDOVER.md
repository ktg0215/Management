# シフト提出システム - プロジェクト引継ぎドキュメント

## プロジェクト概要

シフト提出システムは、従業員がシフト希望を提出し、管理者がそれを管理・承認するためのWebアプリケーションです。

### 主要機能

#### 従業員機能
- ログイン・新規登録
- シフト希望の提出・編集
- 提出履歴の確認
- 下書き保存機能

#### 管理者機能
- 従業員管理（追加・編集・削除）
- 店舗管理
- シフト承認・管理
- Excel形式でのシフト表出力
- 管理者アカウント作成

## 技術スタック

### フロントエンド
- **React 18** - UIライブラリ
- **TypeScript** - 型安全性
- **Vite** - ビルドツール・開発サーバー
- **Tailwind CSS** - スタイリング
- **React Router DOM** - ルーティング
- **Zustand** - 状態管理
- **Lucide React** - アイコン
- **date-fns** - 日付操作
- **xlsx** - Excel出力
- **React Hook Form** - フォーム管理

### バックエンド（実装予定）
- **Node.js** + **Express** または **Fastify**
- **PostgreSQL** - データベース
- **JWT** - 認証
- **bcrypt** - パスワードハッシュ化

### デプロイ環境
- **ConoHa VPS** - サーバーホスティング
- **Nginx** - リバースプロキシ
- **PM2** - プロセス管理

## フォルダ構成

```
src/
├── components/          # 共通コンポーネント
│   ├── Layout.tsx      # レイアウトコンポーネント
│   ├── LoadingSpinner.tsx
│   └── ProtectedRoute.tsx
├── lib/                # ユーティリティ・設定
│   └── api.ts          # APIクライアント
├── pages/              # ページコンポーネント
│   ├── admin/          # 管理者ページ
│   │   ├── Dashboard.tsx
│   │   ├── EmployeeManagement.tsx
│   │   ├── ShiftApproval.tsx
│   │   ├── StoreManagement.tsx
│   │   └── AddAdmin.tsx
│   ├── employee/       # 従業員ページ
│   │   ├── Dashboard.tsx
│   │   ├── ShiftSubmission.tsx
│   │   └── ShiftHistory.tsx
│   ├── LoginPage.tsx
│   └── RegisterPage.tsx
├── stores/             # Zustand状態管理
│   ├── authStore.ts    # 認証状態
│   ├── storeStore.ts   # 店舗データ
│   └── shiftStore.ts   # シフトデータ
├── App.tsx             # メインアプリケーション
├── main.tsx           # エントリーポイント
└── index.css          # グローバルスタイル
```

## 現在の実装状況

### ✅ 完了済み
- フロントエンドUI（全画面）
- 認証フロー（ログイン・登録）
- 状態管理（Zustand）
- ルーティング設定
- レスポンシブデザイン
- Excel出力機能
- APIクライアント設計
- Supabase依存関係の削除
- モックデータによる動作確認

### 🚧 実装中・要修正
- バックエンドAPI（未実装）
- データベース設計（要実装）
- 認証システム（バックエンド側）
- シフトデータの永続化

### ❌ 未実装
- バックエンドサーバー
- データベースマイグレーション
- 本番環境デプロイ設定
- テストコード

## データベース設計（実装予定）

### テーブル構成

#### stores（店舗）
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### employees（従業員）
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(4) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  nickname VARCHAR(255) NOT NULL,
  store_id UUID REFERENCES stores(id),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### shift_periods（シフト期間）
```sql
CREATE TABLE shift_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  is_first_half BOOLEAN NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  submission_deadline DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### shift_submissions（シフト提出）
```sql
CREATE TABLE shift_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  period_id UUID REFERENCES shift_periods(id),
  is_submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, period_id)
);
```

#### shift_entries（シフト入力）
```sql
CREATE TABLE shift_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES shift_submissions(id),
  work_date DATE NOT NULL,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  is_holiday BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(submission_id, work_date)
);
```

## 今後実装が必要な機能

### 1. バックエンドAPI開発
- Express.jsまたはFastifyでRESTful API
- JWT認証ミドルウェア
- バリデーション（Joi、Yup等）
- エラーハンドリング

### 2. データベース実装
- PostgreSQL設定
- マイグレーションスクリプト
- シードデータ作成

### 3. 認証システム
- パスワードハッシュ化（bcrypt）
- JWTトークン生成・検証
- セッション管理

### 4. API エンドポイント実装

#### 認証
- `POST /api/auth/login` - ログイン
- `POST /api/auth/register` - 新規登録
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報

#### 店舗管理
- `GET /api/stores` - 店舗一覧
- `POST /api/stores` - 店舗作成
- `PUT /api/stores/:id` - 店舗更新
- `DELETE /api/stores/:id` - 店舗削除

#### 従業員管理
- `GET /api/employees` - 従業員一覧
- `POST /api/employees` - 従業員作成
- `PUT /api/employees/:id` - 従業員更新
- `DELETE /api/employees/:id` - 従業員削除

#### シフト管理
- `GET /api/shift-periods` - シフト期間一覧
- `GET /api/shift-submissions` - シフト提出一覧
- `POST /api/shift-submissions` - シフト提出作成
- `PUT /api/shift-submissions/:id` - シフト提出更新
- `POST /api/shift-submissions/:id/submit` - シフト提出確定

## ConoHa VPS デプロイ予定

### サーバー構成
- **OS**: Ubuntu 22.04 LTS
- **Node.js**: v18以上
- **PostgreSQL**: v14以上
- **Nginx**: リバースプロキシ
- **SSL**: Let's Encrypt

### デプロイ手順（予定）
1. VPSセットアップ
2. Node.js、PostgreSQL、Nginxインストール
3. データベース初期化
4. アプリケーションデプロイ
5. SSL証明書設定
6. PM2でプロセス管理

## 推奨される次のステップ

### 1. 開発環境構築（優先度：高）
```bash
# バックエンドプロジェクト作成
mkdir shift-system-backend
cd shift-system-backend
npm init -y
npm install express cors helmet morgan dotenv bcryptjs jsonwebtoken pg
npm install -D nodemon @types/node typescript ts-node @types/express @types/pg
```

### 2. データベース設定（優先度：高）
- PostgreSQLインストール・設定
- データベース作成
- マイグレーションスクリプト作成

### 3. 認証API実装（優先度：高）
- JWT認証システム
- パスワードハッシュ化
- ログイン・登録エンドポイント

### 4. 基本CRUD API実装（優先度：中）
- 店舗管理API
- 従業員管理API
- シフト管理API

### 5. フロントエンド接続（優先度：中）
- APIクライアント動作確認
- エラーハンドリング改善
- ローディング状態管理

## 環境構築手順

### フロントエンド
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev
```

### バックエンド（実装予定）
```bash
# プロジェクト作成
mkdir backend
cd backend
npm init -y

# 必要なパッケージインストール
npm install express cors helmet morgan dotenv bcryptjs jsonwebtoken pg
npm install -D nodemon @types/node typescript ts-node @types/express @types/pg

# 開発サーバー起動
npm run dev
```

## 重要な設定項目・注意点

### 1. 環境変数
```env
# バックエンド用（.env）
DATABASE_URL=postgresql://username:password@localhost:5432/shift_system
JWT_SECRET=your-super-secret-jwt-key
PORT=3001
NODE_ENV=development
```

### 2. セキュリティ考慮事項
- パスワードは必ずハッシュ化
- JWTシークレットは強力なものを使用
- CORS設定を適切に行う
- SQLインジェクション対策
- XSS対策

### 3. パフォーマンス
- データベースインデックス設定
- ページネーション実装
- キャッシュ戦略

### 4. エラーハンドリング
- 統一されたエラーレスポンス形式
- ログ出力設定
- ユーザーフレンドリーなエラーメッセージ

## 開発時の注意点

1. **型安全性**: TypeScriptの型定義を活用
2. **コードの可読性**: ESLint、Prettierの設定
3. **テスト**: Jest、React Testing Libraryでテスト実装
4. **ドキュメント**: API仕様書の作成（Swagger等）
5. **バージョン管理**: 適切なコミットメッセージ

## モックデータについて

現在、フロントエンドは以下のファイルでモックデータを使用しています：

- `src/pages/admin/ShiftApproval.tsx` - シフト管理画面
- `src/pages/admin/EmployeeManagement.tsx` - 従業員管理画面
- `src/stores/authStore.ts` - 認証状態管理
- `src/stores/storeStore.ts` - 店舗データ管理
- `src/stores/shiftStore.ts` - シフトデータ管理

バックエンドAPI実装後は、これらのモックデータを実際のAPI呼び出しに置き換える必要があります。

## API クライアント設計

`src/lib/api.ts` にAPIクライアントが実装されており、以下の機能を提供します：

- 認証トークン管理
- 統一されたエラーハンドリング
- 型安全なAPIレスポンス
- 自動的なリクエストヘッダー設定

バックエンド実装時は、このクライアントの設定を調整するだけで接続可能です。

## 状態管理（Zustand）

以下の3つのストアで状態を管理しています：

1. **authStore** - ユーザー認証状態
2. **storeStore** - 店舗データ
3. **shiftStore** - シフトデータ（下書き含む）

各ストアは永続化設定されており、ページリロード時もデータが保持されます。

## UI/UXの特徴

- **レスポンシブデザイン**: モバイル・タブレット・デスクトップ対応
- **アクセシビリティ**: キーボードナビゲーション、適切なコントラスト
- **ユーザビリティ**: 直感的な操作、明確なフィードバック
- **パフォーマンス**: 遅延読み込み、最適化されたバンドル

## サポート・連絡先

このプロジェクトに関する質問や問題がある場合は、開発チームまでお問い合わせください。

---

**最終更新**: 2024年12月
**作成者**: 開発チーム
**プロジェクト状況**: フロントエンド完成、バックエンド実装待ち
**デプロイ予定**: ConoHa VPS