-- シフト期間テーブルの作成
CREATE TABLE IF NOT EXISTS shift_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  is_first_half BOOLEAN NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  submission_deadline DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, year, month, is_first_half)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shift_periods_store_id ON shift_periods(store_id);
CREATE INDEX IF NOT EXISTS idx_shift_periods_year_month ON shift_periods(year, month);