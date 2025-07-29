-- シフト提出テーブルの作成
CREATE TABLE IF NOT EXISTS shift_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  period_id UUID REFERENCES shift_periods(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, period_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shift_submissions_employee_id ON shift_submissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_period_id ON shift_submissions(period_id);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_status ON shift_submissions(status);

-- 更新時刻を自動で更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_shift_submissions_updated_at ON shift_submissions;
CREATE TRIGGER update_shift_submissions_updated_at
  BEFORE UPDATE ON shift_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();