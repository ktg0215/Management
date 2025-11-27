# VPSデプロイ手順

## 1. VPSにSSHでログイン
```bash
ssh ktg@edwtoyama.com
```

## 2. GitHubから最新コードを取得
```bash
cd /home/ktg/management
git pull origin main
```

## 3. フロントエンドをビルド
```bash
cd /home/ktg/management/next-app
npm run build
```

## 4. PM2でサービスを再起動
```bash
# バックエンド再起動
pm2 restart 7

# フロントエンド再起動
pm2 restart 8

# ステータス確認
pm2 list
```

## 5. 売上データをインポート（初回のみ）
```bash
# データベースに売上データをインポート
cd /home/ktg/management
sudo docker exec -i management-db psql -U postgres -d shift_management < backend/import_sales.sql

# インポート結果を確認
sudo docker exec management-db psql -U postgres -d shift_management -c "SELECT COUNT(*) FROM sales_data; SELECT COUNT(*) FROM monthly_sales;"
```

## 6. 動作確認
- ブラウザで https://edwtoyama.com/bb/ にアクセス
- ログインして売上管理ページを確認
- 月次売上管理ページでデータ読み込みボタンをクリック

## 実行コマンド一覧（コピー用）
```bash
# 一連のコマンドをまとめて実行
cd /home/ktg/management && \
git pull origin main && \
cd next-app && \
npm run build && \
pm2 restart 7 && \
pm2 restart 8 && \
pm2 list
```

## データインポート（別途実行）
```bash
cd /home/ktg/management && \
sudo docker exec -i management-db psql -U postgres -d shift_management < backend/import_sales.sql && \
sudo docker exec management-db psql -U postgres -d shift_management -c "SELECT 'Total records:' as info, COUNT(*) as sales_data_count FROM sales_data;"
```