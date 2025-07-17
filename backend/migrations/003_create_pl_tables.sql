-- PL（損益）管理用テーブル
BEGIN;

-- 損益表ヘッダ
CREATE TABLE IF NOT EXISTS pl_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, year, month)
);

-- 損益表の各科目
CREATE TABLE IF NOT EXISTS pl_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pl_statement_id UUID REFERENCES pl_statements(id) ON DELETE CASCADE,
  subject_name VARCHAR(255) NOT NULL,
  estimate INTEGER NOT NULL DEFAULT 0,
  actual INTEGER NOT NULL DEFAULT 0,
  is_highlighted BOOLEAN DEFAULT FALSE,
  is_subtotal BOOLEAN DEFAULT FALSE,
  is_indented BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_pl_statements_store_year_month ON pl_statements(store_id, year, month);
CREATE INDEX IF NOT EXISTS idx_pl_items_pl_statement_id ON pl_items(pl_statement_id);

COMMIT; 