-- 2025年12月1、2、3日のデータにis_predictedフラグを追加するSQLスクリプト
-- サーバー側で直接実行してください

UPDATE sales_data
SET daily_data = jsonb_set(
  jsonb_set(
    jsonb_set(
      daily_data,
      '{1,is_predicted}',
      'true'::jsonb
    ),
    '{1,predicted_at}',
    to_jsonb(now()::text)
  ),
  '{1,date}',
  '"2025-12-01"'::jsonb
)
WHERE store_id = 1 
  AND year = 2025 
  AND month = 12
  AND daily_data ? '1';

UPDATE sales_data
SET daily_data = jsonb_set(
  jsonb_set(
    jsonb_set(
      daily_data,
      '{2,is_predicted}',
      'true'::jsonb
    ),
    '{2,predicted_at}',
    to_jsonb(now()::text)
  ),
  '{2,date}',
  '"2025-12-02"'::jsonb
)
WHERE store_id = 1 
  AND year = 2025 
  AND month = 12
  AND daily_data ? '2';

UPDATE sales_data
SET daily_data = jsonb_set(
  jsonb_set(
    jsonb_set(
      daily_data,
      '{3,is_predicted}',
      'true'::jsonb
    ),
    '{3,predicted_at}',
    to_jsonb(now()::text)
  ),
  '{3,date}',
  '"2025-12-03"'::jsonb
)
WHERE store_id = 1 
  AND year = 2025 
  AND month = 12
  AND daily_data ? '3';

-- 確認用クエリ
SELECT 
  store_id,
  year,
  month,
  daily_data->'1'->>'is_predicted' as day1_is_predicted,
  daily_data->'2'->>'is_predicted' as day2_is_predicted,
  daily_data->'3'->>'is_predicted' as day3_is_predicted
FROM sales_data
WHERE store_id = 1 
  AND year = 2025 
  AND month = 12;

