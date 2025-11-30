-- employeesテーブルにemailカラムを追加
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 既存のデータに対して、employee_idをベースにemailを設定（既にemailがある場合はスキップ）
UPDATE employees 
SET email = employee_id || '@example.com' 
WHERE email IS NULL OR email = '';

-- emailカラムにUNIQUE制約を追加（既存のデータが重複しないことを確認）
-- まず重複を確認
-- SELECT email, COUNT(*) FROM employees GROUP BY email HAVING COUNT(*) > 1;

-- 重複がないことを確認したら、UNIQUE制約を追加
-- ALTER TABLE employees ADD CONSTRAINT employees_email_unique UNIQUE (email);

-- インデックスを追加（検索パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

