-- 天気データの統計情報を取得
SELECT 
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM weather_data;

-- 店舗ID 1（緯度36.66995390, 経度137.20684780）の最新20件の天気データ
SELECT 
    date, 
    weather, 
    temperature 
FROM weather_data 
WHERE latitude = 36.66995390 AND longitude = 137.20684780 
ORDER BY date DESC 
LIMIT 20;

-- 2025年7月の天気データ
SELECT 
    date, 
    weather, 
    temperature 
FROM weather_data 
WHERE latitude = 36.66995390 AND longitude = 137.20684780 
    AND date >= '2025-07-01' AND date <= '2025-07-31' 
ORDER BY date;

