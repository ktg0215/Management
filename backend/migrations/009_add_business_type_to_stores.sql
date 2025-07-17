-- stores テーブルに business_type_id カラムを追加
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS business_type_id UUID REFERENCES business_types(id);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_stores_business_type_id ON stores(business_type_id);