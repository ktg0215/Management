-- 月次売上データテーブルの作成
-- 45項目のフィールドデータをJSONBで保存

CREATE TABLE IF NOT EXISTS sales_data (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    daily_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(store_id, year, month)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_sales_data_store_year_month ON sales_data(store_id, year, month);
CREATE INDEX IF NOT EXISTS idx_sales_data_created_at ON sales_data(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_data_updated_at ON sales_data(updated_at);

-- daily_data JSONB フィールドのインデックス（検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_sales_data_daily_data_gin ON sales_data USING GIN (daily_data);

-- コメント
COMMENT ON TABLE sales_data IS '月次売上管理データ（45項目フィールド）';
COMMENT ON COLUMN sales_data.daily_data IS '月次売上の45項目データ（JSONB形式）';
