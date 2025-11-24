# VPS環境 デプロイメント設定ガイド

## 目次
1. [バックエンド設定](#バックエンド設定)
2. [フロントエンド設定](#フロントエンド設定)
3. [Nginx設定](#nginx設定)
4. [データベース設定](#データベース設定)
5. [トラブルシューティング](#トラブルシューティング)

---

## バックエンド設定

### backend/.env (本番環境)

```env
# ===========================================
# Database Configuration
# ===========================================
DATABASE_URL=postgresql://deploy_user:PASSWORD@localhost:5432/management_system
DB_HOST=localhost
DB_PORT=5432
DB_NAME=management_system
DB_USER=deploy_user
DB_PASSWORD=PASSWORD_HERE

# ===========================================
# Server Configuration
# ===========================================
NODE_ENV=production
PORT=3001
LOG_LEVEL=INFO

# ===========================================
# JWT Configuration
# ===========================================
JWT_SECRET=GENERATE_RANDOM_64_CHAR_STRING_HERE
JWT_EXPIRES_IN=7d
SESSION_SECRET=GENERATE_ANOTHER_RANDOM_STRING

# ===========================================
# CORS Configuration
# ===========================================
CORS_ORIGIN=https://edwtoyama.com
CORS_CREDENTIALS=true

# ===========================================
# Feature Flags
# ===========================================
ENABLE_CACHING=true
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=true
```

**重要な注意点**:
- NODE_ENV は必ず「production」を設定
- JWT_SECRET は十分に複雑なランダム文字列を使用
- 本番では DB_PORT=5432（標準ポート）を推奨

### バックエンド起動確認

```bash
# 環境確認
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: $DATABASE_URL"

# 起動
npm run start  # または npm run build && npm run start
```

---

## フロントエンド設定

### next-app/.env.local (本番環境)

```env
# ===========================================
# API Configuration for VPS
# ===========================================
# VPS環境ではサブドメイン経由でアクセス
NEXT_PUBLIC_API_URL=https://edwtoyama.com/bb
NEXT_PUBLIC_WS_URL=wss://edwtoyama.com/bb

# ビルド環境
NODE_ENV=production
```

**重要な注意点**:
- `NEXT_PUBLIC_API_URL` は VPS のフルドメインを指定
- `basePath: '/bb'` は next.config.js で既に設定済

### ビルド確認

```bash
# 環境変数確認
echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"

# ビルド
npm run build

# 起動
npm run start
```

### next-app/.env.local (ローカル開発環境)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## Nginx設定

### /etc/nginx/sites-available/edwtoyama.com

```nginx
upstream backend_api {
    server localhost:3001;
}

upstream frontend_app {
    server localhost:3002;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name edwtoyama.com;

    # SSL証明書設定
    ssl_certificate /etc/letsencrypt/live/edwtoyama.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/edwtoyama.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # ロギング
    access_log /var/log/nginx/edwtoyama.access.log;
    error_log /var/log/nginx/edwtoyama.error.log;

    # ========== BB アプリケーション（サブディレクトリ） ==========

    # フロントエンド: /bb/
    location /bb {
        proxy_pass http://frontend_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # バックエンド API: /bb/api → http://localhost:3001/api
    location /bb/api {
        rewrite ^/bb/api(.*)$ /api$1 break;
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # ========== 重要: Authorizationヘッダーの通過 ==========
        proxy_set_header Authorization $http_authorization;
        proxy_pass_header Authorization;
        # ログレベル
        access_log /var/log/nginx/edwtoyama.api.log;
        error_log /var/log/nginx/edwtoyama.api.error.log debug;
    }

    # Next.js static assets: /bb/_next
    location /bb/_next {
        proxy_pass http://frontend_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        # 長期キャッシング
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ブラウザアイコン
    location ~ ^/favicon.ico$ {
        access_log off;
        log_not_found off;
    }

    # その他のリクエスト
    location / {
        return 404;
    }
}

# HTTPからHTTPSへリダイレクト
server {
    listen 80;
    listen [::]:80;
    server_name edwtoyama.com;
    return 301 https://$server_name$request_uri;
}
```

### Nginx設定確認

```bash
# 設定ファイルの構文チェック
sudo nginx -t

# リロード（無停止で適用）
sudo systemctl reload nginx

# ステータス確認
sudo systemctl status nginx

# ログ確認
tail -f /var/log/nginx/edwtoyama.access.log
tail -f /var/log/nginx/edwtoyama.api.error.log
```

---

## データベース設定

### PostgreSQL初期化（VPS環境）

```bash
# ユーザー作成
sudo -u postgres createuser -P deploy_user

# データベース作成
sudo -u postgres createdb -O deploy_user management_system

# 初期化スクリプト実行
PGPASSWORD=YOUR_PASSWORD psql -U deploy_user -d management_system -f init_db.sql
PGPASSWORD=YOUR_PASSWORD psql -U deploy_user -d management_system -f migrations/003_create_pl_tables.sql

# 管理者ユーザー作成
cd backend
NODE_ENV=production node create_admin.js
```

### テストデータ作成

```bash
# P&L テストデータ
cd backend
node create_pl_test_data.js

# 月次売上 テストデータ
node create_monthly_sales_test_data.js

# 店舗データ確認
PGPASSWORD=YOUR_PASSWORD psql -U deploy_user -d management_system -c "SELECT id, name FROM stores LIMIT 5;"
```

---

## PM2でのプロセス管理

### ecosystem.config.js

```javascript
module.exports = {
  apps: [
    {
      name: 'backend-api',
      script: './backend/dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'postgresql://deploy_user:PASSWORD@localhost:5432/management_system'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'frontend-app',
      script: 'npm',
      args: 'start -- -p 3002',
      cwd: './next-app',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://edwtoyama.com/bb'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
```

### PM2 起動・管理

```bash
# 起動
pm2 start ecosystem.config.js

# ステータス確認
pm2 status

# ログ確認
pm2 logs backend-api --lines 50
pm2 logs frontend-app --lines 50

# 再起動
pm2 restart all

# 停止
pm2 stop all

# 削除
pm2 delete all
```

---

## トラブルシューティング

### 問題1: ログインが失敗する

```bash
# ① バックエンド ログ確認
pm2 logs backend-api | grep -i "login\|auth\|error"

# ② 認証エンドポイントテスト
curl -X POST https://edwtoyama.com/bb/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"0000","password":"admin123"}'

# ③ 通信確認
curl -v https://edwtoyama.com/bb/api/health

# ④ JWT設定確認
grep JWT_SECRET backend/.env
```

### 問題2: 店舗セレクターが空

```bash
# ① データベース確認
PGPASSWORD=PASSWORD psql -U deploy_user -d management_system \
  -c "SELECT COUNT(*) FROM stores;"

# ② 店舗データ確認
PGPASSWORD=PASSWORD psql -U deploy_user -d management_system \
  -c "SELECT id, name FROM stores;"

# ③ API テスト
curl https://edwtoyama.com/bb/api/stores \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 問題3: P&Lデータが表示されない

```bash
# ① P&L テーブル確認
PGPASSWORD=PASSWORD psql -U deploy_user -d management_system \
  -c "SELECT COUNT(*) FROM pl_data;"

# ② テストデータ作成
cd backend
NODE_ENV=production node create_pl_test_data.js

# ③ API テスト
curl "https://edwtoyama.com/bb/api/pl?year=2025&month=1&storeId=YOUR_STORE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 問題4: Nginxプロキシエラー

```bash
# ① Nginx ステータス
sudo systemctl status nginx
sudo nginx -t

# ② Nginxエラーログ
tail -f /var/log/nginx/edwtoyama.error.log

# ③ バックエンド接続確認
curl http://localhost:3001/health

# ④ フロントエンド接続確認
curl http://localhost:3002/bb/
```

### 問題5: ブラウザキャッシュ問題

```
Chrome DevTools:
1. F12キーを開く
2. Network タブ
3. "Disable cache" をチェック
4. Ctrl+Shift+Delete でキャッシュ削除
5. ページをリロード（Ctrl+F5）
```

---

## パフォーマンス最適化

### キャッシング設定（Nginx）

```nginx
# Next.js static assets のキャッシング
location ~ ^/bb/_next/static/ {
    proxy_pass http://frontend_app;
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# API レスポンス のキャッシング（GETのみ）
location /bb/api {
    # （前述のプロキシ設定に以下を追加）
    proxy_cache_methods GET HEAD;
    proxy_cache_valid 200 10m;
    add_header X-Cache-Status $upstream_cache_status;
}
```

### ログローテーション

```bash
# /etc/logrotate.d/edwtoyama
/var/log/nginx/edwtoyama*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
```

---

## 監視とアラート

### PM2 Plus（オプション）

```bash
# 無料クラウド監視に登録
pm2 plus

# アプリケーション登録
pm2 monitor

# モニタリング開始
pm2 web  # http://localhost:9615
```

---

## チェックリスト

デプロイ前に確認すべき項目：

- [ ] NODE_ENV=production
- [ ] JWT_SECRET が複雑なランダム文字列
- [ ] DATABASE_URL が本番 PostgreSQL を指定
- [ ] CORS_ORIGIN が https://edwtoyama.com
- [ ] Nginx basePath='/bb' が設定済
- [ ] SSL証明書がインストール済
- [ ] Authorizationヘッダーがproxy_passされている
- [ ] PM2 でアプリが起動している
- [ ] ログファイル保存ディレクトリが作成済
- [ ] ファイアウォール ポート3001, 3002 が開放されていない（Nginxのみ公開）
- [ ] データベース初期化スクリプト実行済
- [ ] 管理者ユーザー作成済

