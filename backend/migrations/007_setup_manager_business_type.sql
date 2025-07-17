-- Setup Manager business type and store properly
BEGIN;

-- 1. Add Manager business type if not exists
INSERT INTO business_types (name, description) 
SELECT 'Manager', 'Management Business Type for Administrators'
WHERE NOT EXISTS (SELECT 1 FROM business_types WHERE name = 'Manager');

-- 2. Get the Manager business type ID
-- We'll use this in subsequent operations

-- 3. Create Manager store with proper business type association
INSERT INTO stores (name, business_type_id) 
SELECT 'Manager', bt.id
FROM business_types bt
WHERE bt.name = 'Manager' 
AND NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Manager');

-- 4. Update super admin to belong to Manager store
UPDATE employees SET 
  store_id = (SELECT id FROM stores WHERE name = 'Manager' LIMIT 1)
WHERE role = 'super_admin' 
AND store_id != (SELECT id FROM stores WHERE name = 'Manager' LIMIT 1)
AND EXISTS (SELECT 1 FROM stores WHERE name = 'Manager');

-- 5. Create some activity logs for the Manager setup
INSERT INTO activity_logs (store_id, action_type, target_type, description) 
SELECT 
  s.id,
  'create',
  'business_type',
  'Manager業態とManager店舗が設定されました'
FROM stores s 
WHERE s.name = 'Manager'
AND NOT EXISTS (
  SELECT 1 FROM activity_logs 
  WHERE description = 'Manager業態とManager店舗が設定されました'
);

COMMIT; 