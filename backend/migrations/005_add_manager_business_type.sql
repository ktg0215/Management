-- Add Manager business type if not exists
INSERT INTO business_types (name, description) 
SELECT 'Manager', 'Management Business Type'
WHERE NOT EXISTS (SELECT 1 FROM business_types WHERE name = 'Manager');

-- Insert Manager store for administrators if not exists
INSERT INTO stores (name, business_type_id) 
SELECT 'Manager', bt.id
FROM business_types bt
WHERE bt.name = 'Manager' 
AND NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Manager');

-- Update super admin to belong to Manager business type and store
UPDATE employees SET 
  store_id = (SELECT id FROM stores WHERE name = 'Manager' LIMIT 1)
WHERE role = 'super_admin' AND store_id != (SELECT id FROM stores WHERE name = 'Manager' LIMIT 1); 