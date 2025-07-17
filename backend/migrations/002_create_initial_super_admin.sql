-- Create super admin account
BEGIN;

-- Add super admin account (password: superadmin2024)
INSERT INTO employees (
  employee_id, 
  email, 
  password_hash, 
  full_name, 
  nickname, 
  store_id, 
  role, 
  is_active,
  is_admin
) VALUES (
  '0000', 
  'superadmin@company.com', 
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: superadmin2024
  'Super Admin', 
  'Super Admin', 
  (SELECT id FROM stores WHERE name = '本店' LIMIT 1), 
  'super_admin', 
  true,
  true
) ON CONFLICT (employee_id) DO UPDATE SET
  role = 'super_admin',
  is_active = true,
  is_admin = true;

COMMIT; 