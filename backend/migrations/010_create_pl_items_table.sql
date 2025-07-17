-- PL項目テーブルの作成
CREATE TABLE IF NOT EXISTS pl_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pl_statement_id UUID REFERENCES pl_statements(id) ON DELETE CASCADE,
  subject_name VARCHAR(255) NOT NULL,
  estimate INTEGER DEFAULT 0,
  actual INTEGER DEFAULT 0,
  is_highlighted BOOLEAN DEFAULT false,
  is_subtotal BOOLEAN DEFAULT false,
  is_indented BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pl_statement_id, subject_name)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_pl_items_pl_statement_id ON pl_items(pl_statement_id);
CREATE INDEX IF NOT EXISTS idx_pl_items_sort_order ON pl_items(sort_order);