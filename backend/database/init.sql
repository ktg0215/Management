-- 売上データテーブル
CREATE TABLE IF NOT EXISTS sales_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    daily_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    updated_by UUID REFERENCES employees(id),
    UNIQUE(store_id, year, month)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_sales_data_store_year_month ON sales_data(store_id, year, month);
CREATE INDEX IF NOT EXISTS idx_sales_data_created_at ON sales_data(created_at); 