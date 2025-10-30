# セットアップガイド

**最終更新**: 2025年10月30日

このガイドは、別のPC環境で本プロジェクトをクローンして開発を開始するための手順を説明します。

## 📋 目次

1. [前提条件](#前提条件)
2. [プロジェクトのクローン](#プロジェクトのクローン)
3. [依存関係のインストール](#依存関係のインストール)
4. [データベースのセットアップ](#データベースのセットアップ)
5. [環境変数の設定](#環境変数の設定)
6. [開発サーバーの起動](#開発サーバーの起動)
7. [テストデータの投入](#テストデータの投入)
8. [動作確認](#動作確認)
9. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

以下のソフトウェアがインストールされていることを確認してください：

- **Node.js**: v18以上
- **npm**: v9以上
- **PostgreSQL**: v15以上
- **Git**: 最新版

### バージョン確認コマンド

```bash
node --version   # v18.x.x 以上
npm --version    # v9.x.x 以上
psql --version   # PostgreSQL 15.x 以上
git --version    # Git version 2.x.x 以上
```

---

## プロジェクトのクローン

```bash
# リポジトリをクローン
git clone https://github.com/ktg0215/Management.git
cd Management
```

---

## 依存関係のインストール

### 1. ルートディレクトリの依存関係

```bash
# プロジェクトルートで実行（テストスクリプト用）
npm install
```

**インストールされる主要パッケージ**:
- `axios`: APIリクエスト用

### 2. バックエンドの依存関係

```bash
cd backend
npm install
cd ..
```

**主要パッケージ**:
- `express`: Webサーバーフレームワーク
- `pg`: PostgreSQLクライアント
- `jsonwebtoken`: JWT認証
- `bcrypt`: パスワードハッシュ化
- `express-validator`: バリデーション
- `cors`: CORS設定

### 3. フロントエンドの依存関係

```bash
cd next-app
npm install
cd ..
```

**主要パッケージ**:
- `next`: Next.js フレームワーク（v15.3.5）
- `react`: React ライブラリ（v18.2.0）
- `react-dom`: React DOM
- `typescript`: TypeScript
- `tailwindcss`: CSSフレームワーク
- `zustand`: 状態管理
- `@tanstack/react-query`: データフェッチング
- `date-fns`: 日付処理
- `lucide-react`: アイコンライブラリ
- `exceljs`: Excel出力

---

## データベースのセットアップ

### 1. PostgreSQLサーバーの起動

Windowsの場合:
```bash
# PostgreSQLサービスを起動
net start postgresql-x64-15
```

Linuxの場合:
```bash
sudo systemctl start postgresql
```

Macの場合:
```bash
brew services start postgresql@15
```

### 2. データベースの作成

```bash
# PostgreSQLにログイン
psql -U postgres

# データベース作成（psqlプロンプト内で実行）
CREATE DATABASE management_db;

# ユーザー作成（必要に応じて）
CREATE USER management_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE management_db TO management_user;

# 終了
\q
```

### 3. テーブルの作成

```bash
# backendディレクトリに移動
cd backend

# データベースマイグレーション実行
psql -U postgres -d management_db -f src/db/schema.sql

cd ..
```

**注意**: `schema.sql`ファイルが存在しない場合、アプリケーション初回起動時に自動的にテーブルが作成されます。

---

## 環境変数の設定

### 1. バックエンド環境変数

```bash
# backendディレクトリに .env ファイルを作成
cd backend
```

`.env` ファイル（`backend/.env`）:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=management_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:3002
```

### 2. フロントエンド環境変数

```bash
cd ../next-app
```

`.env.local` ファイル（`next-app/.env.local`）:
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Environment
NODE_ENV=development
```

---

## 開発サーバーの起動

### ターミナル1: バックエンドサーバー

```bash
cd backend
npm run dev
```

バックエンドサーバーが起動します:
```
🚀 Server running on http://localhost:3001
✅ Database connected successfully
```

### ターミナル2: フロントエンドサーバー

```bash
cd next-app
npm run dev
```

フロントエンドサーバーが起動します:
```
▲ Next.js 15.3.5
- Local:        http://localhost:3002
- Ready in X.Xs
```

**重要**: フロントエンドはポート `3002` で起動します（デフォルトの3000ではありません）

---

## テストデータの投入

初回セットアップ時、テストデータを投入することをお勧めします。

### 1. 管理者アカウントの作成

ブラウザで `http://localhost:3002/register` にアクセスし、初回管理者アカウントを作成します。

**デフォルト管理者情報**:
- 従業員ID: `0000`
- パスワード: `toyama2023`
- ニックネーム: `管理者`
- フルネーム: `システム管理者`

### 2. テストデータスクリプトの実行

```bash
# プロジェクトルートディレクトリで実行
cd /path/to/Management
node create-test-data.js
```

このスクリプトは以下のデータを作成します:
- **業態**: 3個（カフェ、ラーメン、焼肉）
- **店舗**: 3店舗（各業態に1店舗）
- **売上データ**: 各店舗3ヶ月分
- **P&Lデータ**: 各店舗3ヶ月分

**実行結果例**:
```
🚀 テストデータ作成開始
✅ ログイン成功
✅ 業態作成: カフェ (ID: 1)
✅ 業態作成: ラーメン (ID: 2)
✅ 業態作成: 焼肉 (ID: 3)
✅ 店舗作成: 珈琲館　渋谷店 (ID: 57)
✅ 店舗作成: 麺屋　一番 (ID: 58)
✅ 店舗作成: 焼肉　大将 (ID: 59)
✅ すべてのテストデータ作成が完了しました！
```

---

## 動作確認

### 1. 包括的テストの実行

```bash
# プロジェクトルートで実行
node comprehensive-debug-test.js
```

このテストは以下を検証します:
- 認証機能
- 全フロントエンドページ（14ページ）
- 全APIエンドポイント（10+）
- データ整合性

**期待される結果**:
```
✅ 成功: 26件
⚠️  警告: 0件
❌ 失敗: 0件
✅ すべてのテストが正常に完了しました！
```

### 2. ブラウザで動作確認

以下のURLにアクセスして動作を確認してください:

**管理者画面**:
- ログイン: `http://localhost:3002/login`
- ダッシュボード: `http://localhost:3002/admin/dashboard`
- 売上管理: `http://localhost:3002/admin/sales-management`
- P&L作成: `http://localhost:3002/admin/pl-create`
- 店舗管理: `http://localhost:3002/admin/stores`
- 従業員管理: `http://localhost:3002/admin/employees`
- シフト管理: `http://localhost:3002/admin/shifts`

**従業員画面**:
- ダッシュボード: `http://localhost:3002/employee/dashboard`
- シフト管理: `http://localhost:3002/employee/shifts`

---

## トラブルシューティング

### ポート競合エラー

**エラー**: `Error: listen EADDRINUSE: address already in use :::3001`

**解決方法**:
```bash
# Windowsの場合
npx kill-port 3001
npx kill-port 3002

# Linux/Macの場合
lsof -ti:3001 | xargs kill -9
lsof -ti:3002 | xargs kill -9
```

### データベース接続エラー

**エラー**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**解決方法**:
1. PostgreSQLサービスが起動しているか確認
```bash
# Windowsの場合
sc query postgresql-x64-15

# Linux/Macの場合
sudo systemctl status postgresql
```

2. データベース接続情報が正しいか確認（`backend/.env`）

3. PostgreSQLを再起動
```bash
# Windowsの場合
net stop postgresql-x64-15
net start postgresql-x64-15
```

### npm install エラー

**エラー**: `npm ERR! code EACCES`

**解決方法**:
```bash
# node_modules と package-lock.json を削除
rm -rf node_modules package-lock.json

# 再インストール
npm install
```

### TypeScript型エラー

**エラー**: `TS2307: Cannot find module`

**解決方法**:
```bash
cd next-app

# TypeScriptキャッシュをクリア
rm -rf .next

# 再ビルド
npm run dev
```

### 認証エラー（403 Forbidden）

**症状**: API呼び出しで403エラーが発生

**解決方法**:
1. JWTトークンが正しく保存されているか確認（ブラウザのLocalStorageを確認）
2. `backend/.env`の`JWT_SECRET`が設定されているか確認
3. ログアウトして再ログイン

### テストデータ作成失敗

**エラー**: `❌ 業態作成失敗: 403 Forbidden`

**解決方法**:
1. 管理者アカウントが存在するか確認
2. 管理者の従業員IDとパスワードが正しいか確認（`create-test-data.js`内）
3. バックエンドサーバーが起動しているか確認

---

## 開発時の便利なコマンド

### バックエンド

```bash
cd backend

# 開発サーバー起動
npm run dev

# TypeScript型チェック
npx tsc --noEmit

# ESLint実行
npm run lint
```

### フロントエンド

```bash
cd next-app

# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動（ビルド後）
npm start

# TypeScript型チェック
npx tsc --noEmit

# ESLint実行
npm run lint
```

---

## 次のステップ

1. **ドキュメントを読む**:
   - `docs/FEATURES.md` - 機能詳細仕様
   - `docs/API_SPECIFICATION.md` - API仕様
   - `docs/DATABASE_TABLES.md` - データベース構造

2. **コードを理解する**:
   - `backend/src/` - バックエンドソースコード
   - `next-app/src/` - フロントエンドソースコード

3. **開発を開始する**:
   - 新しいブランチを作成: `git checkout -b feature/your-feature`
   - コードを変更
   - テストを実行
   - コミット・プッシュ

---

## サポート

問題が解決しない場合:
- GitHub Issues: https://github.com/ktg0215/Management/issues
- ドキュメント: `docs/` フォルダ内の各種ドキュメント

---

**作成日**: 2025年10月30日
**最終更新**: 2025年10月30日
