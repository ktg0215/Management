-- 業態テーブルの作成
CREATE TABLE business_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- storesテーブルに業態IDカラムを追加
ALTER TABLE stores ADD COLUMN business_type_id UUID REFERENCES business_types(id) ON DELETE SET NULL;

-- インデックスの作成
CREATE INDEX idx_stores_business_type_id ON stores(business_type_id);

-- Demo business type data
INSERT INTO business_types (name, description) VALUES 
  ('Manager', 'Management Business Type'),
  ('Yakiniku', 'Yakiniku Restaurant'),
  ('Izakaya', 'Izakaya & Bar'),
  ('Ramen', 'Ramen Shop'),
  ('Cafe', 'Cafe & Coffee Shop'),
  ('Fast Food', 'Fast Food Restaurant');

-- Insert Manager store for administrators
INSERT INTO stores (name, business_type_id) VALUES 
  ('Manager', (SELECT id FROM business_types WHERE name = 'Manager' LIMIT 1));

-- Assign business type to existing stores (using Yakiniku as example)
UPDATE stores SET business_type_id = (
  SELECT id FROM business_types WHERE name = 'Yakiniku' LIMIT 1
) WHERE business_type_id IS NULL AND name != 'Manager';

-- Update super admin to belong to Manager business type and store
UPDATE employees SET 
  store_id = (SELECT id FROM stores WHERE name = 'Manager' LIMIT 1)
WHERE role = 'super_admin'; 