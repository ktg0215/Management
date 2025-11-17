# データベースセットアップガイド

## 概要
このプロジェクトでは、PostgreSQLデータベースをDockerコンテナで実行しています。
システムのPostgreSQLとのポート競合を避けるため、**ポート5433**を使用しています。

## 重要な設定情報

### データベース接続情報
- **ホスト**: localhost
- **ポート**: 5433（デフォルトの5432ではない）
- **データベース名**: shift_management
- **ユーザー**: postgres
- **パスワード**: postgres123

### 環境変数（backend/.env）
```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5433/shift_management
DB_HOST=localhost
DB_NAME=shift_management
DB_USER=postgres
DB_PASSWORD=postgres123
DB_PORT=5433
```

## トラブルシューティング

### よくあるエラーと解決方法

#### 1. PostgreSQL認証エラー
**エラー**: `password authentication failed for user "postgres"`

**原因**:
- システムのPostgreSQLとDockerのPostgreSQLがポート競合している
- .envファイルのポート設定が正しくない

**解決方法**:
```bash
# 1. システムのPostgreSQLが5432を使用しているか確認
sudo netstat -tulpn | grep 5432

# 2. Dockerコンテナを5433ポートで起動
docker run -d --name management-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres123 \
  -e POSTGRES_DB=shift_management \
  -p 5433:5432 \
  postgres:15-alpine

# 3. .envファイルのDB_PORTを5433に変更
sed -i 's/DB_PORT=5432/DB_PORT=5433/' backend/.env

# 4. バックエンドサービスを再起動
pm2 restart management-backend
```

#### 2. ポート競合エラー
**エラー**: `address already in use :::3001`

**原因**: 別のプロセスがポートを使用している

**解決方法**:
```bash
# ポートを使用しているプロセスを確認
lsof -i :3001

# プロセスを終了
kill -9 <PID>

# PM2でサービス再起動
pm2 restart management-backend
```

#### 3. データベーステーブルが存在しない
**エラー**: `relation "users" does not exist`

**原因**: データベースマイグレーションが実行されていない

**解決方法**:
```bash
# 1. 基本テーブルの作成
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f backend/init_db.sql

# 2. 追加テーブルの作成
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f backend/create_missing_tables.sql

# 3. P&Lテーブルの作成
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f backend/migrations/003_create_pl_tables.sql
```

## VPSサーバー（本番環境）での設定

### サーバー情報
- **IP**: 160.251.207.87
- **ユーザー**: ktg
- **アプリケーションパス**: ~/apps/project

### PM2サービス管理
```bash
# サービス状態確認
pm2 status

# ログ確認
pm2 logs management-backend
pm2 logs management-frontend

# サービス再起動
pm2 restart management-backend
pm2 restart management-frontend

# サービス停止
pm2 stop all

# サービス開始
pm2 start ecosystem.config.js
```

### Dockerコンテナ管理
```bash
# PostgreSQLコンテナの状態確認
docker ps -a | grep management-db

# コンテナ起動
docker start management-db

# コンテナ停止
docker stop management-db

# コンテナログ確認
docker logs management-db
```

## 初期セットアップ手順（新規環境用）

### 1. リポジトリクローン
```bash
cd ~/apps
git clone https://github.com/yourusername/project.git
cd project
```

### 2. 依存関係インストール
```bash
# バックエンド
cd backend
npm install

# フロントエンド
cd ../next-app
npm install
```

### 3. 環境変数設定
```bash
# バックエンド用.envファイル作成
cat > backend/.env << EOF
DATABASE_URL=postgresql://postgres:postgres123@localhost:5433/shift_management
DB_HOST=localhost
DB_NAME=shift_management
DB_USER=postgres
DB_PASSWORD=postgres123
DB_PORT=5433
NODE_ENV=production
PORT=3001
JWT_SECRET=your-jwt-secret-key-here
SESSION_SECRET=your-session-secret-key-here
EOF
```

### 4. PostgreSQLセットアップ
```bash
# Dockerコンテナ起動
docker run -d --name management-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres123 \
  -e POSTGRES_DB=shift_management \
  -p 5433:5432 \
  postgres:15-alpine

# 10秒待機（コンテナ起動待ち）
sleep 10

# データベース初期化
cd backend
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f init_db.sql
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f create_missing_tables.sql
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f migrations/003_create_pl_tables.sql
```

### 5. 管理者ユーザー作成
```bash
cd backend
node create_admin.js
```

### 6. PM2でサービス起動
```bash
cd ~/apps/project
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 自動起動設定
```

## ヘルスチェック

### バックエンドAPI
```bash
curl localhost:3001/health
# 期待される応答:
# {"status":"OK","database":"connected","timestamp":"..."}
```

### フロントエンド
```bash
curl -I localhost:3002
# 期待される応答: HTTP/1.1 200 OK
```

## デフォルトログイン情報
- **Email**: admin@example.com
- **Password**: admin123
- **Role**: super_admin

## 注意事項

1. **ポート5433を使用**: システムのPostgreSQLとの競合を避けるため
2. **PM2の設定**: ecosystem.config.jsでexec_modeは'fork'を使用（'cluster'モードではなく）
3. **Docker管理**: management-dbコンテナが常に起動していることを確認
4. **バックアップ**: 定期的にデータベースのバックアップを取ること

## バックアップとリストア

### バックアップ
```bash
PGPASSWORD=postgres123 pg_dump -h localhost -p 5433 -U postgres shift_management > backup_$(date +%Y%m%d).sql
```

### リストア
```bash
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres shift_management < backup_20241118.sql
```

## 更新日
- 2024年11月18日: 初版作成
- PostgreSQLポート競合問題の解決策を文書化
- Dockerコンテナを使用したデータベース管理方法を追加