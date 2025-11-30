-- 天気データテーブルの作成
-- 店舗の緯度経度と日付ごとに天気データを保存

CREATE TABLE IF NOT EXISTS weather_data (
    id SERIAL PRIMARY KEY,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    date DATE NOT NULL,
    weather VARCHAR(50),
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    precipitation DECIMAL(8, 2),
    snow DECIMAL(8, 2),
    windspeed DECIMAL(8, 2),
    gust DECIMAL(8, 2),
    pressure DECIMAL(8, 2),
    feelslike DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(latitude, longitude, date)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_weather_data_location_date ON weather_data(latitude, longitude, date);
CREATE INDEX IF NOT EXISTS idx_weather_data_date ON weather_data(date);

-- コメント
COMMENT ON TABLE weather_data IS '天気データ（店舗の緯度経度と日付ごとに保存）';
COMMENT ON COLUMN weather_data.latitude IS '緯度（店舗の位置）';
COMMENT ON COLUMN weather_data.longitude IS '経度（店舗の位置）';
COMMENT ON COLUMN weather_data.date IS '日付';
COMMENT ON COLUMN weather_data.weather IS '天気（晴れ、雨、雪など）';
COMMENT ON COLUMN weather_data.temperature IS '気温（℃）';

