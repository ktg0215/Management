-- VPS互換性のためのマイグレーション
-- employeesテーブルをusersテーブルとしてエミュレートするビューを作成

-- 既存のusersビューがあれば削除
DROP VIEW IF EXISTS users CASCADE;

-- employeesテーブルをベースにusersビューを作成
CREATE VIEW users AS
SELECT
    id,
    employee_id as email,  -- employee_idをemailとして扱う
    full_name as name,
    password_hash,
    store_id,
    role,
    is_active,
    created_at,
    updated_at
FROM employees;

-- 月次売上APIで必要なカラムがあるか確認し、なければ追加
-- monthly_sales テーブルは既に存在

-- pl_data テーブルは既に存在

-- 確認用クエリ
-- SELECT * FROM users LIMIT 1;