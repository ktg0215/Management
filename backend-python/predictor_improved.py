"""売上予測モジュール - 精度向上版"""
from sklearn.metrics import mean_absolute_error, r2_score, mean_absolute_percentage_error
import pandas as pd
import numpy as np
import sys
from datetime import date, timedelta
from typing import Dict, List, Tuple, Optional
from lightgbm import LGBMRegressor
from data_loader import load_sales_data, is_holiday_jp
from utils.sales_fields import get_sales_fields
from utils.model_storage import save_model, load_model, model_exists, delete_model

# イベント定義（売上に影響を与える特別な日）
EVENTS = {
    "valentine": lambda dt: dt.month == 2 and dt.day == 14,
    "white_day": lambda dt: dt.month == 3 and dt.day == 14,
    "mother_day": lambda dt: dt.month == 5 and dt.weekday() == 6 and 7 < dt.day <= 14,
    "father_day": lambda dt: dt.month == 6 and dt.weekday() == 6 and 14 < dt.day <= 21,
    "obon": lambda dt: dt.month == 8 and 13 <= dt.day <= 16,
    "christmas_eve": lambda dt: dt.month == 12 and dt.day == 24,
    "christmas": lambda dt: dt.month == 12 and dt.day == 25,
    "new_year": lambda dt: dt.month == 1 and 1 <= dt.day <= 3,
    "year_end": lambda dt: dt.month == 12 and 28 <= dt.day <= 31,
    "golden_week": lambda dt: dt.month == 5 and 3 <= dt.day <= 5,
    "school_graduation": lambda dt: dt.month == 3 and 1 <= dt.day <= 25,
    "school_admission": lambda dt: dt.month == 4 and dt.day <= 10,
}

def get_event_features(dt) -> Dict[str, int]:
    """指定した日付のイベントフラグを取得"""
    return {f"is_{k}": int(cond(dt)) for k, cond in EVENTS.items()}

def make_features(df: pd.DataFrame, include_target: bool = False, sales_fields: List[str] = None) -> pd.DataFrame:
    """
    特徴量を作成（精度向上版）

    Args:
        df: 日付、売上、天気データを含むDataFrame
        include_target: ターゲット変数を含めるか
        sales_fields: 予測対象の売上項目のキーリスト

    Returns:
        DataFrame: 特徴量を含むDataFrame
    """
    if df.empty:
        return pd.DataFrame()

    if sales_fields is None:
        sales_fields = ['edw_sales', 'ohb_sales']

    # 基本特徴量
    features_df = pd.DataFrame({
        'temperature': df['temperature'].fillna(0),
        'humidity': df['humidity'].fillna(0),
        'precipitation': df['precipitation'].fillna(0),
        'snow': df['snow'].fillna(0),
        'gust': df['gust'].fillna(0),
        'windspeed': df['windspeed'].fillna(0),
        'pressure': df['pressure'].fillna(0),
        'feelslike': df['feelslike'].fillna(0),
        'weekday': df['date'].apply(lambda d: d.weekday()),
        'is_holiday': df['is_holiday'].astype(int),
        'month': df['date'].apply(lambda d: d.month),
        'day': df['date'].apply(lambda d: d.day),
        'is_month_start': df['date'].apply(lambda d: 1 if d.day == 1 else 0),
        'is_month_end': df['date'].apply(lambda d: 1 if d.day == pd.Timestamp(d).days_in_month else 0),
        'dayofyear': df['date'].apply(lambda d: d.timetuple().tm_yday),
        # 追加特徴量
        'week_of_month': df['date'].apply(lambda d: (d.day - 1) // 7 + 1),
        'is_payday': df['date'].apply(lambda d: 1 if d.day == 25 or d.day == pd.Timestamp(d).days_in_month else 0),
        'is_weekend': df['date'].apply(lambda d: 1 if d.weekday() >= 5 else 0),
        'date': df['date'],
    })

    # イベント特徴量を追加
    for event_name, event_func in EVENTS.items():
        features_df[f'is_{event_name}'] = df['date'].apply(lambda d: int(event_func(d)))

    if include_target:
        for sales_key in sales_fields:
            df_key = sales_key.replace('NetSales', '_sales').replace('Sales', '_sales').lower()
            if df_key not in df.columns:
                df_key = sales_key

            if df_key in df.columns:
                features_df[sales_key] = df[df_key].fillna(0)
            else:
                features_df[sales_key] = 0

        for sales_key in sales_fields:
            if sales_key in features_df.columns:
                features_df[f'{sales_key}_ma7'] = features_df[sales_key].rolling(7).mean().shift(1)
                features_df[f'{sales_key}_ma90'] = features_df[sales_key].rolling(90).mean().shift(1)
                features_df[f'{sales_key}_lag7'] = features_df[sales_key].shift(7)
                features_df[f'{sales_key}_lag14'] = features_df[sales_key].shift(14)

        features_df.dropna(inplace=True)

    return features_df

def align_features(train_X: pd.DataFrame, future_X: pd.DataFrame) -> pd.DataFrame:
    """学習時と予測時で列を揃える"""
    for col in train_X.columns:
        if col not in future_X.columns:
            future_X[col] = 0

    cols_to_keep = [col for col in train_X.columns if col in future_X.columns]
    future_X_aligned = future_X[cols_to_keep].copy()
    future_X_aligned = future_X_aligned.reindex(columns=train_X.columns, fill_value=0)

    return future_X_aligned

def run_sales_prediction(
    store_id: int,
    predict_days: int = 7,
    start_date: Optional[date] = None,
    retrain: bool = False
) -> Dict:
    """
    売上予測を実行（精度向上版）

    Args:
        store_id: 店舗ID
        predict_days: 予測日数（デフォルト7日）
        start_date: 予測開始日（Noneの場合は今日）
        retrain: モデルを再学習するか

    Returns:
        Dict: 予測結果、評価指標、特徴量重要度
    """
    if start_date is None:
        start_date = date.today()

    end_date = start_date + timedelta(days=predict_days - 1)
    predict_dates = pd.date_range(start=start_date, end=end_date)

    sales_fields_list = get_sales_fields(store_id)
    sales_field_keys = [sf['key'] for sf in sales_fields_list]
    sales_field_keys = [key for key in sales_field_keys if key.lower() not in ['netsales', 'net_sales', 'net sales']]

    if not sales_field_keys:
        raise ValueError(f"No sales fields found for store {store_id}")

    print(f"[予測] 店舗ID {store_id} の売上項目: {sales_field_keys} (店舗純売上は除外)")

    all_data = load_sales_data(store_id)

    if all_data.empty:
        raise ValueError(f"No sales data found for store {store_id}")

    train_condition = ~all_data['date'].isin(predict_dates)
    for sales_key in sales_field_keys:
        if sales_key in all_data.columns:
            train_condition = train_condition & (all_data[sales_key].fillna(0) > 0)
            break

    train_data = all_data[train_condition].copy()
    future_data = all_data[all_data['date'].isin(predict_dates)].copy()

    if future_data.empty:
        from utils.database import execute_query
        store_query = "SELECT latitude, longitude FROM stores WHERE id = %s"
        store_result = execute_query(store_query, (store_id,))
        if not store_result:
            raise ValueError(f"Store {store_id} not found")

        latitude = store_result[0]['latitude']
        longitude = store_result[0]['longitude']

        weather_query = """
            SELECT date, weather, temperature, humidity, precipitation, snow,
                   windspeed, gust, pressure, feelslike
            FROM weather_data
            WHERE latitude = %s AND longitude = %s
            AND date = ANY(%s::date[])
        """
        date_str_list = [d.isoformat() for d in predict_dates]
        weather_results = execute_query(
            weather_query,
            (float(latitude), float(longitude), date_str_list)
        )

        future_records = []
        for w in weather_results:
            w_date = w['date'] if isinstance(w['date'], date) else pd.Timestamp(w['date']).date()
            record = {
                'date': w_date,
                'temperature': float(w['temperature']) if w['temperature'] else None,
                'humidity': float(w['humidity']) if w['humidity'] else None,
                'precipitation': float(w['precipitation']) if w['precipitation'] else None,
                'snow': float(w['snow']) if w['snow'] else None,
                'windspeed': float(w['windspeed']) if w['windspeed'] else None,
                'gust': float(w['gust']) if w['gust'] else None,
                'pressure': float(w['pressure']) if w['pressure'] else None,
                'feelslike': float(w['feelslike']) if w['feelslike'] else None,
                'weather': w['weather'] or '',
                'is_holiday': is_holiday_jp(w_date),
            }
            for sales_key in sales_field_keys:
                record[sales_key] = 0
            future_records.append(record)

        future_data = pd.DataFrame(future_records)

    if train_data.empty:
        raise ValueError(f"Insufficient training data for store {store_id}. Need at least some historical sales data.")

    train_data['year_month'] = train_data['date'].apply(lambda d: f"{d.year}-{d.month:02d}")
    unique_months = train_data['year_month'].nunique()
    train_data = train_data.drop(columns=['year_month'])

    use_fallback = unique_months < 2
    if use_fallback:
        print(f"[予測] 店舗ID {store_id} のデータが2か月未満（{unique_months}か月）のため、移動平均線のみで予測します")

    train_df = make_features(train_data, include_target=True, sales_fields=sales_field_keys)
    future_df = make_features(future_data, include_target=False, sales_fields=sales_field_keys)

    if train_df.empty or future_df.empty:
        raise ValueError("Failed to create features")

    target_columns = [col for col in sales_field_keys if col in train_df.columns]
    if not target_columns:
        raise ValueError(f"No valid sales columns found in training data: {sales_field_keys}")

    predictions_list = []
    metrics_dict = {}

    for sales_key in target_columns:
        if sales_key not in train_df.columns:
            continue

        y_target = train_df[sales_key].fillna(0)

        if len(y_target[y_target > 0]) < 10:
            print(f"[予測] 売上項目 {sales_key} のデータが不足しているためスキップ")
            continue

        if use_fallback:
            ma7 = y_target.rolling(7).mean().iloc[-1] if len(y_target) >= 7 else y_target.mean()
            if pd.isna(ma7) or ma7 <= 0:
                ma7 = y_target.mean() if len(y_target) > 0 else 0

            print(f"[予測] 売上項目 {sales_key} の移動平均（7日）: {ma7:.0f}")

            for i, pred_date in enumerate(future_df['date']):
                if i < len(predictions_list):
                    predictions_list[i][sales_key] = int(max(0, ma7))
                else:
                    predictions_list.append({
                        'date': pred_date.isoformat(),
                        sales_key: int(max(0, ma7)),
                    })

            metrics_dict[sales_key] = {
                "mae": float(abs(y_target.mean() - ma7)) if len(y_target) > 0 else 0.0,
                "r2": 0.0,
                "mape": 0.0,
                "feature_importance": {},
                "method": "moving_average"
            }
        else:
            drop_columns = target_columns + ['date']

            train_df_features = train_df.drop(columns=drop_columns)
            future_df_features = future_df.drop(columns=['date'])

            combined_df = pd.concat([train_df_features, future_df_features], ignore_index=True)
            combined_X = pd.get_dummies(combined_df, drop_first=True)

            train_X = combined_X.iloc[:len(train_df_features)].copy()
            future_X = combined_X.iloc[len(train_df_features):].copy()

            if 'weekday' in train_df.columns and 'weekday' not in train_X.columns:
                train_X['weekday'] = train_df['weekday'].astype(int)
            if 'weekday' in future_df.columns and 'weekday' not in future_X.columns:
                future_X['weekday'] = future_df['weekday'].astype(int)

            future_X = align_features(train_X, future_X)

            model = None

            if retrain:
                delete_model(store_id, sales_key)
                print(f"[予測] 店舗ID {store_id}, 売上項目 {sales_key} のモデルを再学習します")
            else:
                model = load_model(store_id, sales_key)
                if model is not None:
                    if model.n_features_ != future_X.shape[1]:
                        print(f"[予測] 特徴量数不一致（モデル={model.n_features_}, データ={future_X.shape[1]}）。再学習します。")
                        delete_model(store_id, sales_key)
                        model = None

            if retrain or model is None:
                print(f"[予測] 店舗ID {store_id}, 売上項目 {sales_key} のモデルを学習中...")
                # ハイパーパラメータを調整
                model = LGBMRegressor(
                    n_estimators=300,
                    learning_rate=0.05,
                    max_depth=7,
                    num_leaves=31,
                    min_child_samples=10,
                    random_state=42,
                    verbose=-1
                )
                model.fit(train_X, y_target)
                save_model(store_id, sales_key, model)
            else:
                print(f"[予測] 店舗ID {store_id}, 売上項目 {sales_key} の既存モデルを使用")

            if model.n_features_ != future_X.shape[1]:
                print(f"[予測] 特徴量数不一致のため再学習: モデル={model.n_features_}, データ={future_X.shape[1]}")
                delete_model(store_id, sales_key)
                model = LGBMRegressor(
                    n_estimators=300,
                    learning_rate=0.05,
                    max_depth=7,
                    num_leaves=31,
                    min_child_samples=10,
                    random_state=42,
                    verbose=-1
                )
                model.fit(train_X, y_target)
                save_model(store_id, sales_key, model)
                future_X = align_features(train_X, future_X)

            if model.n_features_ != future_X.shape[1]:
                raise ValueError(f"特徴量数が一致しません: モデル={model.n_features_}, データ={future_X.shape[1]}")

            predictions = model.predict(future_X)

            for i, pred_date in enumerate(future_df['date']):
                if i < len(predictions_list):
                    predictions_list[i][sales_key] = int(max(0, predictions[i]))
                else:
                    predictions_list.append({
                        'date': pred_date.isoformat(),
                        sales_key: int(max(0, predictions[i])),
                    })

            y_pred_train = model.predict(train_X)

            metrics_dict[sales_key] = {
                "mae": float(mean_absolute_error(y_target, y_pred_train)),
                "r2": float(r2_score(y_target, y_pred_train)),
                "mape": float(mean_absolute_percentage_error(y_target, y_pred_train)),
                "feature_importance": {
                    col: float(importance)
                    for col, importance in zip(train_X.columns, model.feature_importances_)
                },
                "method": "lightgbm"
            }

    if not predictions_list:
        raise ValueError("No predictions generated")

    return {
        'predictions': predictions_list,
        'metrics': metrics_dict,
        'sales_fields': sales_fields_list,
    }
