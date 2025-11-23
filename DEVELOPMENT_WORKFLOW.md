# 開発ワークフローガイド

このドキュメントは、Management System の開発からVPSへのデプロイまでの流れをまとめたものです。

## 目次

1. [環境構成](#環境構成)
2. [開発フロー](#開発フロー)
3. [VPSデプロイ手順](#vpsデプロイ手順)
4. [テストデータの管理](#テストデータの管理)
5. [トラブルシューティング](#トラブルシューティング)

---

## 環境構成

### ローカル環境

| コンポーネント | ポート | 詳細 |
|---------------|--------|------|
| Frontend (Next.js) | 3002 | `cd next-app && npm run dev` |
| Backend (Express) | 3001 | `cd backend && npm run dev` |
| PostgreSQL (Docker) | 5433 | `docker start management-db` |

### VPS環境

| 項目 | 値 |
|------|-----|
| IP アドレス | 160.251.207.87 |
| ドメイン | https://edwtoyama.com |
| アプリURL | https://edwtoyama.com/bb |
| プロジェクトパス | ~/Management |
| プロセス管理 | pm2 |

### VPS認証情報

- **管理者勤怠番号**: `0000`
- **パスワード**: `admin123`

---

## 開発フロー

### 1. ローカルでの開発

```bash
# 1. PostgreSQLコンテナを起動
docker start management-db

# 2. バックエンドを起動（Terminal 1）
cd backend
npm run dev

# 3. フロントエンドを起動（Terminal 2）
cd next-app
npm run dev

# 4. ブラウザで確認
# http://localhost:3002
```

### 2. コードの変更とテスト

```bash
# 型チェック
cd next-app && npm run type-check

# リント
npm run lint

# ブラウザでの動作確認
# http://localhost:3002 でテスト
```

### 3. GitHubへのプッシュ

```bash
# 変更をステージング
git add .

# コミット
git commit -m "変更内容の説明"

# プッシュ
git push origin main
```

### 4. VPSでのプル・デプロイ

```bash
# VPSに接続
ssh ktg@160.251.207.87

# プロジェクトディレクトリに移動
cd ~/Management

# 最新コードを取得
git pull origin main

# バックエンドの依存関係を更新（必要な場合）
cd backend
npm install

# バックエンドを再起動
pm2 restart management-backend

# フロントエンドの依存関係を更新（必要な場合）
cd ../next-app
npm install

# フロントエンドを再ビルド・再起動
npm run build
pm2 restart management-frontend

# ログを確認
pm2 logs management-backend --lines 50
```

---

## VPSデプロイ手順

### 初回セットアップ（参考）

```bash
# VPSに接続
ssh ktg@160.251.207.87

# プロジェクトをクローン
cd ~
git clone https://github.com/ktg0215/Management.git

# バックエンドのセットアップ
cd ~/Management/backend
npm install

# .envファイルを設定（既存の設定からコピー）
cp ~/apps/project/backend/.env .env

# pm2でバックエンドを起動
pm2 start npm --name "management-backend" -- run dev

# フロントエンドのセットアップ
cd ~/Management/next-app
npm install
npm run build

# pm2でフロントエンドを起動
pm2 start npm --name "management-frontend" -- start
```

### pm2コマンド一覧

```bash
# プロセス一覧を表示
pm2 list

# 特定のプロセスを再起動
pm2 restart management-backend
pm2 restart management-frontend

# ログを表示
pm2 logs management-backend
pm2 logs management-frontend

# 全プロセスを停止
pm2 stop all

# 全プロセスを再起動
pm2 restart all
```

---

## テストデータの管理

### 方法1: Excelからのインポート（推奨）

売上データはExcelファイルからインポートできます。

```bash
# VPSに接続
ssh ktg@160.251.207.87

# Excelファイルをアップロード（ローカルから）
scp "計数管理表2024【EDW富山】.xlsx" ktg@160.251.207.87:~/Management/backend/

# VPSでインポートスクリプトを実行
cd ~/Management/backend
node import_excel_sales.js
```

**Excelファイルの形式**:
- シート名: `2024年6月`, `2024年7月` など（年月形式）
- 各シートに日別の売上データを含む
- 主要カラム: 店舗純売上、EDW純売上、OHB純売上、人件費など

### 方法2: SQLでの直接投入

```bash
# VPSのPostgreSQLに接続
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management

# データ確認
SELECT * FROM monthly_sales WHERE year = 2024 LIMIT 5;
SELECT * FROM sales_data WHERE year = 2024 LIMIT 5;

# データ投入例
INSERT INTO monthly_sales (store_id, year, month, daily_data)
VALUES (1, 2024, 12, '{"1": {"netSales": 100000}, "2": {"netSales": 120000}}');
```

### 方法3: APIを使用したデータ投入

```bash
# 認証トークンを取得
TOKEN=$(curl -s -X POST https://edwtoyama.com/bb/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employeeNumber": "0000", "password": "admin123"}' | jq -r '.token')

# 月次売上データを投入
curl -X POST https://edwtoyama.com/bb/api/monthly-sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "storeId": 1,
    "year": 2024,
    "month": 12,
    "dailyData": {
      "1": {"netSales": 100000, "customerCount": 50},
      "2": {"netSales": 120000, "customerCount": 60}
    }
  }'
```

### データベーステーブル構造

**monthly_sales テーブル**:
```sql
CREATE TABLE monthly_sales (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  daily_data JSONB,  -- 日別データをJSON形式で保存
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**pl_data テーブル**:
```sql
CREATE TABLE pl_data (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  data JSONB,  -- P&LデータをJSON形式で保存
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER,
  updated_by INTEGER
);
```

---

## トラブルシューティング

### よくある問題と解決策

#### 1. データベース接続エラー

**エラー**: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**原因**: .envファイルが存在しないか、設定が不正

**解決策**:
```bash
# .envファイルを確認
cat ~/Management/backend/.env

# 必要な設定
DATABASE_URL=postgresql://postgres:postgres123@localhost:5433/shift_management
DB_PORT=5433
JWT_SECRET=your-jwt-secret-key
```

#### 2. APIが404を返す

**原因**: バックエンドが再起動されていない

**解決策**:
```bash
pm2 restart management-backend
pm2 logs management-backend --lines 20
```

#### 3. フロントエンドの変更が反映されない

**原因**: ビルドが実行されていない

**解決策**:
```bash
cd ~/Management/next-app
npm run build
pm2 restart management-frontend
```

#### 4. 月次売上データが空で返ってくる

**原因**: `monthly_sales`テーブルにデータがない

**解決策**:
```bash
# sales_dataからmonthly_salesにデータをコピー
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -c "
INSERT INTO monthly_sales (store_id, year, month, daily_data, created_at, updated_at)
SELECT store_id, year, month, daily_data, created_at, updated_at
FROM sales_data
WHERE NOT EXISTS (
  SELECT 1 FROM monthly_sales ms
  WHERE ms.store_id = sales_data.store_id
  AND ms.year = sales_data.year
  AND ms.month = sales_data.month
);
"
```

### ログの確認方法

```bash
# バックエンドのログ
pm2 logs management-backend --lines 100

# フロントエンドのログ
pm2 logs management-frontend --lines 100

# 全てのログ
pm2 logs --lines 100
```

---

## クイックリファレンス

### 日常的な開発サイクル

```bash
# 1. ローカルで開発・テスト
# 2. コミット＆プッシュ
git add . && git commit -m "説明" && git push

# 3. VPSでプル＆再起動
ssh ktg@160.251.207.87 "cd ~/Management && git pull && cd backend && pm2 restart management-backend"
```

### よく使うコマンド

| 操作 | コマンド |
|------|---------|
| VPS接続 | `ssh ktg@160.251.207.87` |
| コードプル | `cd ~/Management && git pull` |
| バックエンド再起動 | `pm2 restart management-backend` |
| フロントエンド再起動 | `pm2 restart management-frontend` |
| ログ確認 | `pm2 logs --lines 50` |
| DB接続 | `PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management` |

### 重要なファイルパス

| ファイル | 場所 |
|---------|------|
| バックエンドソース | `~/Management/backend/src/index.ts` |
| フロントエンドページ | `~/Management/next-app/src/app/` |
| 環境設定 | `~/Management/backend/.env` |
| Excelインポート | `~/Management/backend/import_excel_sales.js` |

---

## 更新履歴

- **2024-11-24**: 初版作成
  - 基本的な開発フローを文書化
  - VPSデプロイ手順を追加
  - テストデータ管理方法を追加
  - トラブルシューティングセクションを追加
