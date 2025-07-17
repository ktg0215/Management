-- Create activity_logs table for system notifications
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  target_type VARCHAR(100) NOT NULL, -- 'payment', 'shift', 'employee', etc.
  target_id VARCHAR(100), -- ID of the affected record
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Add indexes for better performance
  INDEX idx_activity_logs_store_id (store_id),
  INDEX idx_activity_logs_created_at (created_at DESC),
  INDEX idx_activity_logs_action_type (action_type)
);

-- Create function to automatically delete old logs (keep only latest 100 per store)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs() RETURNS TRIGGER AS $$
BEGIN
  -- Delete logs older than the 100 most recent for this store
  DELETE FROM activity_logs 
  WHERE store_id = NEW.store_id 
  AND id NOT IN (
    SELECT id FROM activity_logs 
    WHERE store_id = NEW.store_id 
    ORDER BY created_at DESC 
    LIMIT 100
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically cleanup old logs
DROP TRIGGER IF EXISTS trigger_cleanup_activity_logs ON activity_logs;
CREATE TRIGGER trigger_cleanup_activity_logs
  AFTER INSERT ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_activity_logs();

-- Add some sample activity logs for testing
INSERT INTO activity_logs (store_id, action_type, target_type, description) VALUES
((SELECT id FROM stores WHERE name = '東京本店' LIMIT 1), 'create', 'payment', '東京本店で新しい支払いが作成されました'),
((SELECT id FROM stores WHERE name = '大阪支店' LIMIT 1), 'update', 'shift', '大阪支店でシフトが更新されました'),
((SELECT id FROM stores WHERE name = '東京本店' LIMIT 1), 'update', 'employee', '東京本店で従業員情報が更新されました')
WHERE EXISTS (SELECT 1 FROM stores WHERE name = '東京本店'); 