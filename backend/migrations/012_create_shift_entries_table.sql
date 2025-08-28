-- シフトエントリテーブルの作成
CREATE TABLE IF NOT EXISTS shift_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES shift_submissions(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  is_holiday BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(submission_id, work_date)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shift_entries_submission_id ON shift_entries(submission_id);
CREATE INDEX IF NOT EXISTS idx_shift_entries_work_date ON shift_entries(work_date);

-- 更新時刻を自動で更新するトリガー
DROP TRIGGER IF EXISTS update_shift_entries_updated_at ON shift_entries;
CREATE TRIGGER update_shift_entries_updated_at
  BEFORE UPDATE ON shift_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();