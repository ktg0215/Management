#!/bin/bash

# VPSデプロイスクリプト
# 使用方法: VPSにSSHログイン後、このスクリプトを実行

echo "=== VPSデプロイ開始 ==="

# 1. GitHubから最新コードを取得
echo "1. GitHubから最新コードをpull..."
cd /home/ktg/management
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Git pullに失敗しました"
    exit 1
fi

echo "✅ 最新コードを取得しました"

# 2. フロントエンドのビルド
echo "2. フロントエンドをビルド中..."
cd /home/ktg/management/next-app
npm run build

if [ $? -ne 0 ]; then
    echo "❌ フロントエンドのビルドに失敗しました"
    exit 1
fi

echo "✅ フロントエンドのビルドが完了しました"

# 3. PM2でサービスを再起動
echo "3. PM2でサービスを再起動..."

# バックエンドを再起動
pm2 restart 7
echo "✅ バックエンド再起動完了 (ID: 7)"

# フロントエンドを再起動
pm2 restart 8
echo "✅ フロントエンド再起動完了 (ID: 8)"

# 4. データベースへのインポート（必要な場合）
echo "4. データベースのインポート..."
if [ -f "/home/ktg/management/backend/import_sales.sql" ]; then
    echo "売上データをインポート中..."
    sudo docker exec -i management-db psql -U postgres -d shift_management < /home/ktg/management/backend/import_sales.sql

    if [ $? -eq 0 ]; then
        echo "✅ 売上データのインポートが完了しました"

        # インポート結果を確認
        echo "データ件数確認:"
        sudo docker exec management-db psql -U postgres -d shift_management -c "SELECT 'sales_data' as table_name, COUNT(*) as count FROM sales_data UNION ALL SELECT 'monthly_sales', COUNT(*) FROM monthly_sales;"
    else
        echo "⚠️ データインポートでエラーが発生しました（新規インポートの場合は既存データとの重複の可能性があります）"
    fi
else
    echo "インポートファイルが見つかりません（スキップ）"
fi

# 5. ステータス確認
echo ""
echo "=== デプロイ完了 ==="
echo "PM2プロセス状態:"
pm2 list

echo ""
echo "サービスURL:"
echo "https://edwtoyama.com/bb/"
echo ""
echo "完了しました！"