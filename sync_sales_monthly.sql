-- 売上管理データを月次売上管理テーブルに同期するSQL
-- sales_dataテーブルのデータをmonthly_salesテーブルにコピー

-- 既存データの更新
UPDATE monthly_sales ms
SET
    daily_data = sd.daily_data,
    updated_at = NOW()
FROM sales_data sd
WHERE ms.store_id = sd.store_id
    AND ms.year = sd.year
    AND ms.month = sd.month;

-- 新規データの挿入
INSERT INTO monthly_sales (store_id, year, month, daily_data, created_at, updated_at)
SELECT
    sd.store_id,
    sd.year,
    sd.month,
    sd.daily_data,
    NOW(),
    NOW()
FROM sales_data sd
WHERE NOT EXISTS (
    SELECT 1 FROM monthly_sales ms
    WHERE ms.store_id = sd.store_id
        AND ms.year = sd.year
        AND ms.month = sd.month
);

-- 結果の確認
SELECT
    'sales_data' as table_name,
    COUNT(*) as count
FROM sales_data
UNION ALL
SELECT
    'monthly_sales' as table_name,
    COUNT(*) as count
FROM monthly_sales
ORDER BY table_name;