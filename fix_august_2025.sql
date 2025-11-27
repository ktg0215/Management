-- 2025年8月のデータ構造を修正
-- netSalesフィールドが欠落しているため、他のフィールドから計算して追加

BEGIN;

-- 現在の2025年8月のデータを確認
SELECT 'Before fix:' as status,
       (daily_data->'1'->>'netSales') as day1_netSales,
       (daily_data->'1'->>'edwNetSales') as day1_edwNetSales,
       (daily_data->'1'->>'ohbNetSales') as day1_ohbNetSales
FROM sales_data
WHERE store_id = 1 AND year = 2025 AND month = 8;

-- 2025年8月のデータを修正
-- edwNetSales + ohbNetSales = netSalesとして計算
UPDATE sales_data
SET daily_data = (
    SELECT jsonb_object_agg(
        day_key,
        CASE
            WHEN day_value->>'netSales' IS NULL THEN
                jsonb_set(
                    day_value,
                    '{netSales}',
                    to_jsonb(
                        COALESCE((day_value->>'edwNetSales')::numeric, 0) +
                        COALESCE((day_value->>'ohbNetSales')::numeric, 0) +
                        COALESCE((day_value->>'ohbSales')::numeric, 0)
                    )
                )
            ELSE
                day_value
        END
    )
    FROM jsonb_each(daily_data) AS t(day_key, day_value)
)
WHERE store_id = 1 AND year = 2025 AND month = 8;

-- monthly_salesテーブルも同様に修正
UPDATE monthly_sales
SET daily_data = (
    SELECT jsonb_object_agg(
        day_key,
        CASE
            WHEN day_value->>'netSales' IS NULL THEN
                jsonb_set(
                    day_value,
                    '{netSales}',
                    to_jsonb(
                        COALESCE((day_value->>'edwNetSales')::numeric, 0) +
                        COALESCE((day_value->>'ohbNetSales')::numeric, 0) +
                        COALESCE((day_value->>'ohbSales')::numeric, 0)
                    )
                )
            ELSE
                day_value
        END
    )
    FROM jsonb_each(daily_data) AS t(day_key, day_value)
)
WHERE store_id = 1 AND year = 2025 AND month = 8;

-- 修正後の確認
SELECT 'After fix:' as status,
       (daily_data->'1'->>'netSales') as day1_netSales,
       (daily_data->'1'->>'edwNetSales') as day1_edwNetSales,
       (daily_data->'1'->>'ohbNetSales') as day1_ohbNetSales
FROM sales_data
WHERE store_id = 1 AND year = 2025 AND month = 8;

-- 全月の売上合計を確認
SELECT year, month,
       COUNT(*) as day_count,
       SUM((value->>'netSales')::numeric) as total_sales
FROM sales_data, jsonb_each(daily_data)
WHERE store_id = 1
  AND (value->>'netSales')::numeric IS NOT NULL
GROUP BY year, month
ORDER BY year, month;

COMMIT;