-- 三段階権限システムへの移行
BEGIN;

-- 新しいカラムを追加
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 制約を追加
ALTER TABLE employees ADD CONSTRAINT check_role CHECK (role IN ('user', 'admin', 'super_admin'));

-- 既存のis_adminデータをroleに移行
UPDATE employees SET role = CASE 
  WHEN is_admin = true THEN 'admin' 
  ELSE 'user' 
END WHERE role IS NULL;

-- デフォルト値を設定
UPDATE employees SET role = 'user' WHERE role IS NULL;
UPDATE employees SET is_active = TRUE WHERE is_active IS NULL;

COMMIT; 