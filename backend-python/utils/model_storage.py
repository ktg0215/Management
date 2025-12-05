"""モデル保存・読み込みユーティリティ"""
import os
import pickle
from pathlib import Path
from typing import Optional
from lightgbm import LGBMRegressor

# モデル保存ディレクトリ（Dockerコンテナ内とホストの両方に対応）
# 環境変数で指定されていない場合は、実行環境に応じて自動選択
import os
if os.path.exists('/app/models'):
    MODELS_DIR = Path('/app/models')  # Dockerコンテナ内
else:
    MODELS_DIR = Path(__file__).parent.parent / 'models'  # ホスト環境

def ensure_models_dir():
    """モデル保存ディレクトリが存在することを確認"""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

def get_model_path(store_id: int, sales_key: str) -> Path:
    """モデルファイルのパスを取得"""
    ensure_models_dir()
    # ファイル名に使用できない文字を置換
    safe_key = sales_key.replace('/', '_').replace('\\', '_')
    return MODELS_DIR / f"store_{store_id}_{safe_key}.pkl"

def save_model(store_id: int, sales_key: str, model: LGBMRegressor) -> bool:
    """
    モデルを保存
    
    Args:
        store_id: 店舗ID
        sales_key: 売上項目のキー
        model: LightGBMモデル
    
    Returns:
        bool: 保存成功かどうか
    """
    try:
        ensure_models_dir()
        model_path = get_model_path(store_id, sales_key)
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        print(f"[モデル保存] 店舗ID {store_id}, 売上項目 {sales_key} のモデルを保存: {model_path}")
        return True
    except Exception as e:
        print(f"[モデル保存エラー] 店舗ID {store_id}, 売上項目 {sales_key}: {e}")
        return False

def load_model(store_id: int, sales_key: str) -> Optional[LGBMRegressor]:
    """
    モデルを読み込み
    
    Args:
        store_id: 店舗ID
        sales_key: 売上項目のキー
    
    Returns:
        LGBMRegressor: モデル（存在しない場合はNone）
    """
    try:
        model_path = get_model_path(store_id, sales_key)
        if not model_path.exists():
            return None
        
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        print(f"[モデル読み込み] 店舗ID {store_id}, 売上項目 {sales_key} のモデルを読み込み: {model_path}")
        return model
    except Exception as e:
        print(f"[モデル読み込みエラー] 店舗ID {store_id}, 売上項目 {sales_key}: {e}")
        return None

def model_exists(store_id: int, sales_key: str) -> bool:
    """モデルが存在するか確認"""
    model_path = get_model_path(store_id, sales_key)
    return model_path.exists()

def delete_model(store_id: int, sales_key: str) -> bool:
    """モデルを削除"""
    try:
        model_path = get_model_path(store_id, sales_key)
        if model_path.exists():
            model_path.unlink()
            print(f"[モデル削除] 店舗ID {store_id}, 売上項目 {sales_key} のモデルを削除")
            return True
        return False
    except Exception as e:
        print(f"[モデル削除エラー] 店舗ID {store_id}, 売上項目 {sales_key}: {e}")
        return False

