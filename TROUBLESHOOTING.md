# トラブルシューティングガイド

## 2024年11月18日のインシデント記録と解決策

### 問題の概要
本番環境（VPS）でPostgreSQL認証エラーが発生し、アプリケーションがデータベースに接続できない状態でした。

### 発生したエラー
```
❌ データベース接続失敗: password authentication failed for user "postgres"
⚠️ APIサーバーはデータベースなしで起動します
```

### 根本原因
1. システムのPostgreSQLがポート5432を使用していた
2. Dockerコンテナも同じポート5432を使おうとして競合
3. .envファイルのパスワードと実際のPostgreSQLパスワードが不一致

### 実施した解決策

#### ステップ1: PostgreSQLをDockerコンテナで別ポートに移行
```bash
# 新しいPostgreSQLコンテナをポート5433で起動
docker run -d --name management-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres123 \
  -e POSTGRES_DB=shift_management \
  -p 5433:5432 \
  postgres:15-alpine
```

#### ステップ2: 環境変数の更新
```bash
# backend/.envファイルのポート設定を変更
sed -i 's/DB_PORT=5432/DB_PORT=5433/' backend/.env
sed -i 's/:5432/:5433/' backend/.env
```

#### ステップ3: データベーステーブルの作成
```bash
# 基本テーブル作成
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f init_db.sql

# 追加テーブル作成
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f create_missing_tables.sql

# P&Lテーブル作成（UUID型をINTEGER型に修正後）
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f migrations/003_create_pl_tables.sql
```

#### ステップ4: 管理者ユーザーの作成
```bash
cd backend
node create_admin.js
```

#### ステップ5: サービスの再起動
```bash
pm2 restart management-backend
pm2 restart management-frontend
```

## よくある問題と解決方法

### 1. ローカル環境でのPostgreSQL接続エラー

**症状**:
- `ユーザ"postgres"のパスワード認証に失敗しました`
- `FATAL: password authentication failed for user "postgres"`

**解決方法**:
1. Docker Desktopを再起動
2. PostgreSQLコンテナが起動していることを確認
3. .envファイルのポート設定を確認（5432または5433）

### 2. PM2でのTypeScriptエラー

**症状**:
- `Cannot find module 'ts-node/register'`

**解決方法**:
ecosystem.config.jsを修正してnpm startを使用:
```javascript
{
  name: 'management-backend',
  script: 'npm',
  args: 'start',
  cwd: './backend',
  exec_mode: 'fork'
}
```

### 3. ポート競合

**症状**:
- `address already in use :::3001`
- `address already in use :::3002`

**解決方法**:
```bash
# 競合しているプロセスを確認
lsof -i :3001
lsof -i :3002

# Dockerコンテナが原因の場合
docker stop bb-backend bb-frontend
docker rm bb-backend bb-frontend

# PM2サービスを再起動
pm2 restart all
```

### 4. フロントエンドビルドエラー

**症状**:
- TypeScript型エラー
- ESLintエラーでビルド失敗

**解決方法**:
1. 型エラーの修正（fieldSourceプロパティ追加など）
2. ESLintを一時的に無効化（next.config.js）:
```javascript
module.exports = {
  eslint: {
    ignoreDuringBuilds: true
  }
}
```

## 予防策

### 1. 定期的なヘルスチェック
```bash
# 毎日実行するスクリプト
#!/bin/bash
curl -s localhost:3001/health | python3 -m json.tool
pm2 status
docker ps | grep management-db
```

### 2. バックアップの自動化
```bash
# cronに追加（毎日午前3時に実行）
0 3 * * * PGPASSWORD=postgres123 pg_dump -h localhost -p 5433 -U postgres shift_management > /backup/db_$(date +\%Y\%m\%d).sql
```

### 3. ログ監視
```bash
# PM2ログの定期確認
pm2 logs --err --lines 50
```

### 4. リソース監視
```bash
# システムリソースの確認
pm2 monit
docker stats management-db
```

## 緊急時の連絡先とリソース

### リポジトリ
- GitHub: https://github.com/[your-username]/project

### サーバー情報
- VPS IP: 160.251.207.87
- SSH: `ssh ktg@160.251.207.87`

### 重要なファイルパス
- アプリケーション: `~/apps/project/`
- PM2設定: `~/apps/project/ecosystem.config.js`
- バックエンド環境変数: `~/apps/project/backend/.env`
- ログファイル: `~/.pm2/logs/`

### デバッグコマンド集
```bash
# サービス状態確認
pm2 status

# データベース接続テスト
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -c '\l'

# APIヘルスチェック
curl localhost:3001/health

# フロントエンド確認
curl -I localhost:3002

# Dockerコンテナ確認
docker ps -a

# ポート使用状況
netstat -tulpn | grep -E '3001|3002|5432|5433'

# PM2ログ確認（リアルタイム）
pm2 logs --lines 100

# エラーログのみ
pm2 logs --err
```

## 今後の改善提案

1. **環境変数の管理**
   - .env.exampleファイルを作成してテンプレート化
   - 環境ごとの設定ファイル分離（.env.local, .env.production）

2. **自動化**
   - デプロイメントスクリプトの作成
   - データベースマイグレーションの自動実行

3. **監視強化**
   - Grafanaやプロメテウスでのメトリクス監視
   - アラート設定（サービスダウン時の通知）

4. **ドキュメント**
   - API仕様書の作成
   - アーキテクチャ図の追加

## 更新履歴
- 2024年11月18日: PostgreSQL認証エラーの解決方法を記録
- Docker/PM2の運用方法を文書化
- トラブルシューティング手順を体系化