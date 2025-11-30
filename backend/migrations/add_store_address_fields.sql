-- storesテーブルに緯度・経度フィールドを追加（addressは既に存在する可能性がある）
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- addressカラムが存在しない場合は追加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stores' AND column_name = 'address') THEN
        ALTER TABLE stores ADD COLUMN address VARCHAR(255);
    END IF;
END $$;

-- コメントを追加
COMMENT ON COLUMN stores.address IS '店舗の住所';
COMMENT ON COLUMN stores.latitude IS '店舗の緯度（天気データ取得用）';
COMMENT ON COLUMN stores.longitude IS '店舗の経度（天気データ取得用）';

