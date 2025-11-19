# VPSでのテストデータ投入ガイド

## 📋 概要
月次売上管理システムのテストデータを投入する手順です。

---

## 🚀 VPSでの実行手順

### 1. 最新のコードを取得

```bash
cd /var/www/bb
git pull origin main
```

### 2. データベースに接続して確認

```bash
# PostgreSQLに接続
sudo -u postgres psql -d shift_management

# 店舗一覧を確認（テストデータで使用する店舗IDを確認）
SELECT id, name, business_type_id FROM stores ORDER BY created_at;

# ユーザー一覧を確認
SELECT id, name, role FROM employees WHERE role = 'super_admin';

# 接続を終了
\q
```

### 3. テストデータSQLを実行

```bash
# SQLファイルを実行
sudo -u postgres psql -d shift_management -f /var/www/bb/backend/test_data/monthly_sales_test_data.sql
```

**期待される出力:**
```
NOTICE:  テストデータを正常に挿入しました (店舗ID: <UUID>, 2025年1月)

 id | store_id | year | month | field_name | created_at
----+----------+------+-------+------------+------------
...
```

### 4. データが正しく投入されたか確認

```bash
# PostgreSQLに再接続
sudo -u postgres psql -d shift_management

# 挿入されたデータを確認
SELECT
    sd.id,
    s.name as store_name,
    sd.year,
    sd.month,
    jsonb_object_keys(sd.daily_data) as field_count,
    sd.created_at
FROM sales_data sd
JOIN stores s ON s.id = sd.store_id
WHERE sd.year = 2025 AND sd.month = 1;

# 特定のフィールド値を確認
SELECT
    s.name as store_name,
    sd.daily_data->>'店舗純売上' as 店舗純売上,
    sd.daily_data->>'客数（計）' as 客数,
    sd.daily_data->>'組数（計）' as 組数
FROM sales_data sd
JOIN stores s ON s.id = sd.store_id
WHERE sd.year = 2025 AND sd.month = 1;

# 接続を終了
\q
```

### 5. アプリケーションを再起動

```bash
cd /var/www/bb
pm2 restart all
```

### 6. ブラウザで動作確認

```
https://edwtoyama.com/bb/admin/monthly-sales
```

1. ログイン (勤怠番号: 0000, パスワード: admin123)
2. 月次売上管理ページにアクセス
3. テストデータが投入された店舗を選択
4. 2025年1月のデータが表示されることを確認

---

## 🔍 トラブルシューティング

### データが表示されない場合

#### 1. データベースを確認
```bash
sudo -u postgres psql -d shift_management -c "SELECT COUNT(*) FROM sales_data WHERE year = 2025 AND month = 1;"
```

#### 2. バックエンドログを確認
```bash
pm2 logs backend
```

#### 3. フロントエンドログを確認
```bash
pm2 logs next-app
```

#### 4. ブラウザの開発者ツールで確認
- F12を押してConsoleタブを開く
- Network タブで `/api/monthly-sales` のリクエストを確認
- エラーメッセージがないか確認

---

## 📊 テストデータの内容

### 基本情報
- 年月: 2025年1月
- 日付: 2025-01-01
- 曜日: 水曜日
- 集計担当者: 山田太郎

### 売上関連
- 店舗純売上: 492,500円
- EDW純売上: 350,000円
- OHB純売上: 142,500円
- Uber: 28,000円

### 客数・組数
- 組数: 125組
- 客数: 280人
- 組単価: 3,940円
- 客単価: 1,759円

### 人時・人件費
- 社員時間: 48時間
- AS時間: 72時間
- 人件費額: 145,000円
- 人件費率: 29.4%

### 生産性
- EDW生産性: 4,667
- OHB生産性: 3,167
- 総生産性: 4,104

---

## ⚙️ オプション: 複数月のテストデータ作成

2月、3月のデータも追加したい場合は、SQLファイルを編集して実行してください：

```sql
-- 2025年2月のデータ（例）
INSERT INTO sales_data (
    store_id,
    year,
    month,
    daily_data,
    created_by,
    updated_by
) VALUES (
    '<店舗ID>',
    2025,
    2,
    jsonb_build_object(
        '店舗純売上', 520000,
        '客数（計）', 295,
        -- ... 他のフィールド
    ),
    '<ユーザーID>',
    '<ユーザーID>'
);
```

---

## 🗑️ テストデータの削除

テストデータを削除する場合：

```bash
sudo -u postgres psql -d shift_management -c "DELETE FROM sales_data WHERE year = 2025 AND month = 1;"
```

---

## ✅ 完了チェックリスト

- [ ] GitHubから最新のコードを取得
- [ ] テストデータSQLを実行
- [ ] データベースにデータが挿入されたことを確認
- [ ] PM2でアプリケーションを再起動
- [ ] ブラウザで月次売上管理ページにアクセス
- [ ] 2025年1月のデータが正しく表示される
- [ ] 全45項目のフィールドが表示される
- [ ] 自動計算項目（組単価、客単価など）が正しく計算されている

---

## 📞 サポート

問題が発生した場合は、以下の情報を共有してください：

1. エラーメッセージ（ターミナル）
2. ブラウザのコンソールエラー
3. PM2のログ (`pm2 logs`)
4. データベースのデータ確認結果
