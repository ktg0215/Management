# ConoHa VPS デプロイガイド

## 概要
ConoHa VPSでのシフト提出システムのデプロイ手順

## サーバー要件

### 推奨スペック
- **CPU**: 2コア以上
- **メモリ**: 4GB以上
- **ストレージ**: 50GB以上
- **OS**: Ubuntu 22.04 LTS

## 初期セットアップ

### 1. サーバー基本設定
```bash
# システム更新
sudo apt update && sudo apt upgrade -y

# 必要なパッケージインストール
sudo apt install -y curl wget git vim ufw

# ファイアウォール設定
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Node.js インストール
```bash
# Node.js 18.x インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version
npm --version
```

### 3. PostgreSQL インストール
```bash
# PostgreSQL インストール
sudo apt install -y postgresql postgresql-contrib

# PostgreSQL 開始・自動起動設定
sudo systemctl start postgresql
sudo systemctl enable postgresql

# データベース作成
sudo -u postgres createdb shift_system
sudo -u postgres createuser --interactive
```

### 4. Nginx インストール
```bash
# Nginx インストール
sudo apt install -y nginx

# 開始・自動起動設定
sudo systemctl start nginx
sudo systemctl enable nginx
```

## アプリケーションデプロイ

### 1. プロジェクトクローン
```bash
# プロジェクトディレクトリ作成
sudo mkdir -p /var/www/shift-system
sudo chown $USER:$USER /var/www/shift-system

# リポジトリクローン（実際のリポジトリURLに変更）
cd /var/www/shift-system
git clone https://github.com/your-repo/shift-system.git .
```

### 2. バックエンドセットアップ
```bash
# バックエンドディレクトリ
cd /var/www/shift-system/backend

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
vim .env
```

### 3. フロントエンドビルド
```bash
# フロントエンドディレクトリ
cd /var/www/shift-system

# 依存関係インストール
npm install

# 本番ビルド
npm run build
```

### 4. PM2 セットアップ
```bash
# PM2 グローバルインストール
sudo npm install -g pm2

# アプリケーション起動
cd /var/www/shift-system/backend
pm2 start npm --name "shift-system-api" -- start

# PM2 自動起動設定
pm2 startup
pm2 save
```

## Nginx 設定

### 1. サイト設定ファイル作成
```bash
sudo vim /etc/nginx/sites-available/shift-system
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # フロントエンド（React）
    location / {
        root /var/www/shift-system/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # バックエンドAPI
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静的ファイル
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        root /var/www/shift-system/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. サイト有効化
```bash
# シンボリックリンク作成
sudo ln -s /etc/nginx/sites-available/shift-system /etc/nginx/sites-enabled/

# デフォルトサイト無効化
sudo rm /etc/nginx/sites-enabled/default

# 設定テスト
sudo nginx -t

# Nginx 再起動
sudo systemctl restart nginx
```

## SSL証明書設定（Let's Encrypt）

### 1. Certbot インストール
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. SSL証明書取得
```bash
sudo certbot --nginx -d your-domain.com
```

### 3. 自動更新設定
```bash
# 自動更新テスト
sudo certbot renew --dry-run

# crontab設定
sudo crontab -e
# 以下を追加
0 12 * * * /usr/bin/certbot renew --quiet
```

## データベース初期化

### 1. マイグレーション実行
```bash
cd /var/www/shift-system/backend

# データベースマイグレーション
npm run migrate

# 初期データ投入
npm run seed
```

### 2. データベースバックアップ設定
```bash
# バックアップスクリプト作成
sudo vim /usr/local/bin/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
pg_dump -h localhost -U shift_user shift_system > $BACKUP_DIR/shift_system_$DATE.sql

# 7日以上古いバックアップを削除
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
```

```bash
# 実行権限付与
sudo chmod +x /usr/local/bin/backup-db.sh

# crontab設定（毎日午前2時）
sudo crontab -e
# 以下を追加
0 2 * * * /usr/local/bin/backup-db.sh
```

## 監視・ログ設定

### 1. ログローテーション
```bash
sudo vim /etc/logrotate.d/shift-system
```

```
/var/www/shift-system/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload shift-system-api
    endscript
}
```

### 2. PM2 監視
```bash
# PM2 モニタリング
pm2 monit

# ログ確認
pm2 logs shift-system-api
```

## セキュリティ設定

### 1. SSH設定強化
```bash
sudo vim /etc/ssh/sshd_config
```

```
# パスワード認証無効化（公開鍵認証のみ）
PasswordAuthentication no
PubkeyAuthentication yes

# rootログイン無効化
PermitRootLogin no

# ポート変更（オプション）
Port 2222
```

### 2. fail2ban 設定
```bash
# fail2ban インストール
sudo apt install -y fail2ban

# 設定ファイル作成
sudo vim /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
```

## 運用・メンテナンス

### 1. 定期更新
```bash
# システム更新（月1回）
sudo apt update && sudo apt upgrade -y

# Node.js依存関係更新
cd /var/www/shift-system
npm audit fix
```

### 2. 監視項目
- CPU使用率
- メモリ使用率
- ディスク使用量
- アプリケーションログ
- データベース接続状況

### 3. 障害対応
```bash
# アプリケーション再起動
pm2 restart shift-system-api

# Nginx再起動
sudo systemctl restart nginx

# PostgreSQL再起動
sudo systemctl restart postgresql
```

## トラブルシューティング

### よくある問題と解決方法

1. **アプリケーションが起動しない**
   ```bash
   pm2 logs shift-system-api
   ```

2. **データベース接続エラー**
   ```bash
   sudo systemctl status postgresql
   sudo -u postgres psql -c "\l"
   ```

3. **Nginx設定エラー**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

4. **SSL証明書エラー**
   ```bash
   sudo certbot certificates
   sudo certbot renew
   ```

## 連絡先・サポート

デプロイに関する問題や質問がある場合は、開発チームまでお問い合わせください。