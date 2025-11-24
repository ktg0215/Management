#!/bin/bash

echo "=== Nginx設定修正スクリプト ==="
echo "現在のNginx設定をバックアップします..."

# バックアップ作成
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

echo "新しい設定ファイルを適用します..."
# 新しい設定を適用
sudo cp /home/ktg/nginx_default_new.conf /etc/nginx/sites-available/default

echo "Nginx設定をテストします..."
# 設定をテスト
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "設定テストOK。Nginxを再起動します..."
    sudo systemctl reload nginx
    echo "Nginx再起動完了"
else
    echo "設定にエラーがあります。バックアップから復元します..."
    sudo cp /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/default
    echo "復元完了"
    exit 1
fi

echo "=== 完了 ==="