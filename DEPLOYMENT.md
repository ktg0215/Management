# ConoHa VPS デプロイガイド

このガイドでは、管理システムをConoHa VPSにデプロイする手順を説明します。

## 前提条件

- ConoHa VPSアカウント
- Ubuntu 22.04 LTS以上のVPS
- ドメイン名（オプション：SSL証明書用）
- SSH接続情報

## アーキテクチャ

```
[インターネット]
    ↓
[Nginx (80/443)]
    ├─ Next.js Frontend (3002)
    └─ Express Backend (3001)
         ↓
    [PostgreSQL (5432)]
```

## ステップ1: VPSへの接続

```bash
# ConoHa VPSに接続
ssh root@YOUR_VPS_IP

# 最初に、一般ユーザーを作成（セキュリティのため）
adduser deploy
usermod -aG sudo deploy
su - deploy
```

## ステップ2: 必要なソフトウェアのインストール

```bash
# システムアップデート
sudo apt update && sudo apt upgrade -y

# Node.js 20.x のインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL のインストール
sudo apt install -y postgresql postgresql-contrib

# Nginx のインストール
sudo apt install -y nginx

# PM2 のインストール（プロセス管理）
sudo npm install -g pm2

# Git のインストール
sudo apt install -y git

# 確認
node --version  # v20.x.x
npm --version   # 10.x.x
psql --version  # PostgreSQL 14+
nginx -v        # nginx/1.x.x
```

## ステップ3: PostgreSQLのセットアップ

```bash
# PostgreSQLに切り替え
sudo -u postgres psql

# データベースとユーザーを作成
CREATE DATABASE management_system;
CREATE USER deploy_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE management_system TO deploy_user;
\q

# 接続テスト
psql -h localhost -U deploy_user -d management_system -W
```

## ステップ4: プロジェクトのデプロイ

```bash
# プロジェクトディレクトリの作成
mkdir -p ~/apps
cd ~/apps

# Gitからクローン（または手動アップロード）
# オプション1: Gitリポジトリがある場合
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git project
cd project

# オプション2: ローカルからアップロード
# ローカルマシンで実行:
# scp -r C:\job\project deploy@YOUR_VPS_IP:~/apps/

# 依存関係のインストール
cd ~/apps/project/backend
npm install --production

cd ~/apps/project/next-app
npm install --production
```

## ステップ5: 環境変数の設定

```bash
# バックエンド環境変数
cd ~/apps/project/backend
cp .env.example .env
nano .env
```

`.env` ファイルを以下のように編集:

```env
# Database Configuration
DATABASE_URL=postgresql://deploy_user:your_secure_password@localhost:5432/management_system
DB_HOST=localhost
DB_PORT=5432
DB_NAME=management_system
DB_USER=deploy_user
DB_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET=your-super-secure-random-jwt-secret-key-generate-new-one
JWT_EXPIRES_IN=7d

# Server Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=INFO

# CORS Configuration
CORS_ORIGIN=http://YOUR_DOMAIN.com
CORS_CREDENTIALS=true

# Feature Flags
ENABLE_CACHING=true
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=true
```

```bash
# フロントエンド環境変数
cd ~/apps/project/next-app
nano .env.local
```

`.env.local` ファイル:

```env
NEXT_PUBLIC_API_URL=http://YOUR_DOMAIN.com/api
# または
NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP:3001
```

## ステップ6: データベースマイグレーション

```bash
cd ~/apps/project/backend

# マイグレーションの実行
PGPASSWORD=your_secure_password psql -h localhost -U deploy_user -d management_system -f ./migrations/001_initial_schema.sql
PGPASSWORD=your_secure_password psql -h localhost -U deploy_user -d management_system -f ./migrations/002_add_shifts.sql
PGPASSWORD=your_secure_password psql -h localhost -U deploy_user -d management_system -f ./migrations/003_create_pl_tables.sql

# 初期データの投入（必要に応じて）
node create_initial_data.js
```

## ステップ7: Next.jsのビルド

```bash
cd ~/apps/project/next-app
npm run build

# ビルド成功を確認
ls -la .next
```

## ステップ8: PM2でアプリケーションを起動

```bash
cd ~/apps/project

# PM2設定ファイルを使用して起動
pm2 start ecosystem.config.js

# または個別に起動
pm2 start backend/src/index.ts --name backend --interpreter ts-node
pm2 start next-app --name frontend -- start

# 起動確認
pm2 list
pm2 logs

# システム起動時の自動起動設定
pm2 startup
pm2 save
```

## ステップ9: Nginxの設定

```bash
# Nginx設定ファイルを作成
sudo nano /etc/nginx/sites-available/management-system
```

以下の内容を貼り付け:

```nginx
# アップストリームの定義
upstream backend {
    server localhost:3001;
    keepalive 64;
}

upstream frontend {
    server localhost:3002;
    keepalive 64;
}

# HTTPサーバー（後でHTTPSにリダイレクト）
server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

    # または IPアドレスの場合
    # server_name YOUR_VPS_IP;

    # クライアントボディサイズの制限
    client_max_body_size 10M;

    # ログ設定
    access_log /var/log/nginx/management-system-access.log;
    error_log /var/log/nginx/management-system-error.log;

    # Next.js (フロントエンド)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Express API (バックエンド)
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket接続
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # 静的ファイルのキャッシュ
    location /_next/static {
        proxy_pass http://frontend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# 設定ファイルを有効化
sudo ln -s /etc/nginx/sites-available/management-system /etc/nginx/sites-enabled/

# デフォルト設定を無効化
sudo rm /etc/nginx/sites-enabled/default

# 設定テスト
sudo nginx -t

# Nginxを再起動
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## ステップ10: ファイアウォール設定

```bash
# UFWをインストール（まだの場合）
sudo apt install ufw

# 必要なポートを開放
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# ファイアウォールを有効化
sudo ufw enable

# 状態確認
sudo ufw status
```

## ステップ11: SSL証明書の設定（オプション・推奨）

```bash
# Certbotのインストール
sudo apt install certbot python3-certbot-nginx -y

# SSL証明書の取得と自動設定
sudo certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com

# 証明書の自動更新テスト
sudo certbot renew --dry-run
```

## デプロイ後の確認

```bash
# アプリケーションの状態確認
pm2 list
pm2 logs --lines 50

# Nginxの状態確認
sudo systemctl status nginx

# データベース接続確認
psql -h localhost -U deploy_user -d management_system -c "SELECT COUNT(*) FROM users;"

# ブラウザで確認
# http://YOUR_DOMAIN.com または http://YOUR_VPS_IP
```

## メンテナンスコマンド

```bash
# アプリケーションの再起動
pm2 restart all

# ログの確認
pm2 logs
tail -f /var/log/nginx/management-system-error.log

# アプリケーションの停止
pm2 stop all

# データベースバックアップ
pg_dump -h localhost -U deploy_user management_system > backup_$(date +%Y%m%d).sql

# 更新のデプロイ
cd ~/apps/project
git pull
cd backend && npm install
cd ../next-app && npm install && npm run build
pm2 restart all
```

## トラブルシューティング

### アプリケーションが起動しない

```bash
# ログを確認
pm2 logs --err

# ポート使用状況を確認
sudo netstat -tlnp | grep -E '3001|3002'

# 手動起動でエラー確認
cd ~/apps/project/backend
npm start
```

### データベース接続エラー

```bash
# PostgreSQLの状態確認
sudo systemctl status postgresql

# 接続テスト
psql -h localhost -U deploy_user -d management_system -W

# pg_hba.confの確認
sudo nano /etc/postgresql/14/main/pg_hba.conf
# 以下の行があることを確認:
# local   all             all                                     md5
# host    all             all             127.0.0.1/32            md5
```

### Nginxエラー

```bash
# 設定テスト
sudo nginx -t

# エラーログ確認
sudo tail -f /var/log/nginx/error.log

# Nginxの再起動
sudo systemctl restart nginx
```

## セキュリティ推奨事項

1. **SSH接続**
   - パスワード認証を無効化し、公開鍵認証を使用
   - SSHポートをデフォルトの22から変更

2. **データベース**
   - 強力なパスワードを使用
   - 外部アクセスを制限

3. **アプリケーション**
   - JWT_SECRETは十分に長く複雑なものを使用
   - 環境変数ファイルのパーミッションを制限: `chmod 600 .env`

4. **定期的なアップデート**
   ```bash
   sudo apt update && sudo apt upgrade -y
   pm2 update
   ```

5. **バックアップ**
   - 定期的なデータベースバックアップ
   - cron ジョブで自動化

## サポート情報

- プロジェクトドキュメント: `CLAUDE.md`
- API仕様: `backend/src/index.ts`
- フロントエンド構成: `next-app/src/`
