"""データ取得・変換モジュール"""
import pandas as pd
from datetime import date, timedelta
from typing import List, Dict, Optional
from utils.database import execute_query
import json

# 祝日判定用（簡易版、jpholidayライブラリの代わり）
def is_holiday_jp(d: date) -> bool:
    """日本の祝日を判定（簡易版）"""
    # 固定祝日
    fixed_holidays = [
        (1, 1),   # 元日
        (2, 11),  # 建国記念の日
        (4, 29),  # 昭和の日
        (5, 3),   # 憲法記念日
        (5, 4),   # みどりの日
        (5, 5),   # こどもの日
        (8, 11),  # 山の日
        (11, 3),  # 文化の日
        (11, 23), # 勤労感謝の日
        (12, 23), # 天皇誕生日（2024年まで）
    ]
    
    if (d.month, d.day) in fixed_holidays:
        return True
    
    # 春分の日・秋分の日（簡易計算、正確ではない）
    # 実際のプロジェクトではjpholidayライブラリを使用推奨
    
    return False

def load_sales_data(store_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None) -> pd.DataFrame:
    """
    売上データと天気データを取得して、参考サイトのSalesDate形式に変換
    
    Args:
        store_id: 店舗ID
        start_date: 開始日（Noneの場合は全期間）
        end_date: 終了日（Noneの場合は全期間）
    
    Returns:
        DataFrame: 参考サイトのSalesDate形式のデータ
    """
    # 店舗情報を取得（緯度・経度を取得）
    store_query = """
        SELECT id, latitude, longitude, address
        FROM stores
        WHERE id = %s
    """
    store_result = execute_query(store_query, (store_id,))
    if not store_result:
        raise ValueError(f"Store {store_id} not found")
    
    store = store_result[0]
    latitude = store['latitude']
    longitude = store['longitude']
    
    if not latitude or not longitude:
        raise ValueError(f"Store {store_id} does not have latitude/longitude")
    
    # 期間を決定
    if not start_date:
        # 最も古いデータから開始
        oldest_query = """
            SELECT MIN(year || '-' || LPAD(month::text, 2, '0') || '-01')::date as oldest_date
            FROM sales_data
            WHERE store_id = %s
        """
        oldest_result = execute_query(oldest_query, (store_id,))
        if oldest_result and oldest_result[0]['oldest_date']:
            start_date = oldest_result[0]['oldest_date']
        else:
            start_date = date.today() - timedelta(days=365)
    
    if not end_date:
        end_date = date.today()
    
    # sales_dataテーブルから期間内のデータを取得
    start_year = start_date.year
    start_month = start_date.month
    end_year = end_date.year
    end_month = end_date.month
    
    sales_query = """
        SELECT year, month, daily_data
        FROM sales_data
        WHERE store_id = %s
        AND (
            (year = %s AND month >= %s) OR
            (year > %s AND year < %s) OR
            (year = %s AND month <= %s)
        )
        ORDER BY year, month
    """
    sales_results = execute_query(
        sales_query,
        (store_id, start_year, start_month, start_year, end_year, end_year, end_month)
    )
    
    # daily_dataを展開して1日1レコード形式に変換
    sales_records = []
    for row in sales_results:
        year = row['year']
        month = row['month']
        daily_data = row['daily_data']
        
        if not daily_data or not isinstance(daily_data, dict):
            continue
        
        for day_of_month_str, day_data in daily_data.items():
            try:
                day_of_month = int(day_of_month_str)
                record_date = date(year, month, day_of_month)
                
                # 日付範囲チェック
                if record_date < start_date or record_date > end_date:
                    continue
                
                # 祝日判定
                is_holiday = day_data.get('isHoliday', False) or False
                if not is_holiday:
                    is_holiday = is_holiday_jp(record_date)
                
                # データを変換（すべてのフィールドを含める）
                record = {
                    'date': record_date,
                    'temperature': day_data.get('temperature'),
                    'humidity': day_data.get('humidity'),
                    'precipitation': day_data.get('precipitation'),
                    'snow': day_data.get('snow'),
                    'windspeed': day_data.get('windspeed'),
                    'gust': day_data.get('gust'),
                    'pressure': day_data.get('pressure'),
                    'feelslike': day_data.get('feelslike'),
                    'weather': day_data.get('weather', ''),
                    'is_holiday': is_holiday,
                }
                
                # すべての数値フィールドを追加（売上項目を含む）
                for key, value in day_data.items():
                    if isinstance(value, (int, float)) and key not in record:
                        record[key] = value or 0
                
                # 後方互換性のため、既存のキーも保持
                record['edw_sales'] = day_data.get('edwNetSales', 0) or 0
                record['ohb_sales'] = day_data.get('ohbNetSales', 0) or 0
                record['edw_customers'] = day_data.get('edwCustomers', 0) or 0
                record['ohb_customers'] = day_data.get('ohbCustomers', 0) or 0
                
                sales_records.append(record)
            except (ValueError, TypeError) as e:
                # 無効な日付やデータはスキップ
                continue
    
    # weather_dataテーブルから天気データを取得して統合
    if sales_records:
        date_list = [r['date'] for r in sales_records]
        date_str_list = [d.isoformat() for d in date_list]
        
        weather_query = """
            SELECT date, weather, temperature, humidity, precipitation, snow,
                   windspeed, gust, pressure, feelslike
            FROM weather_data
            WHERE latitude = %s AND longitude = %s
            AND date = ANY(%s::date[])
        """
        weather_results = execute_query(
            weather_query,
            (float(latitude), float(longitude), date_str_list)
        )
        
        # 天気データを辞書に変換（日付をキーに）
        weather_dict = {w['date']: w for w in weather_results}
        
        # 天気データで上書き（weather_dataの方が正確な場合）
        for record in sales_records:
            record_date = record['date']
            if record_date in weather_dict:
                weather_data = weather_dict[record_date]
                if weather_data.get('temperature') is not None:
                    record['temperature'] = float(weather_data['temperature'])
                if weather_data.get('humidity') is not None:
                    record['humidity'] = float(weather_data['humidity'])
                if weather_data.get('precipitation') is not None:
                    record['precipitation'] = float(weather_data['precipitation'])
                if weather_data.get('snow') is not None:
                    record['snow'] = float(weather_data['snow'])
                if weather_data.get('windspeed') is not None:
                    record['windspeed'] = float(weather_data['windspeed'])
                if weather_data.get('gust') is not None:
                    record['gust'] = float(weather_data['gust'])
                if weather_data.get('pressure') is not None:
                    record['pressure'] = float(weather_data['pressure'])
                if weather_data.get('feelslike') is not None:
                    record['feelslike'] = float(weather_data['feelslike'])
                if weather_data.get('weather'):
                    record['weather'] = weather_data['weather']
    
    # DataFrameに変換
    if not sales_records:
        return pd.DataFrame()
    
    df = pd.DataFrame(sales_records)
    
    # 日付でソート
    df = df.sort_values('date').reset_index(drop=True)
    
    return df

