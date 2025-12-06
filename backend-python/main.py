"""FastAPIアプリケーション"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date
from predictor import run_sales_prediction
import os

app = FastAPI(title="Sales Prediction API", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切に設定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    store_id: int
    predict_days: int = 7
    start_date: Optional[str] = None
    retrain: bool = False  # 再学習フラグ

class PredictionResponse(BaseModel):
    success: bool
    predictions: List[Dict]
    metrics: Dict
    message: Optional[str] = None

@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy"}

@app.post("/predict", response_model=PredictionResponse)
async def predict_sales(request: PredictionRequest):
    """
    売上予測を実行
    
    Args:
        request: 予測リクエスト
            - store_id: 店舗ID
            - predict_days: 予測日数（デフォルト7日）
            - start_date: 予測開始日（YYYY-MM-DD形式、Noneの場合は今日）
    
    Returns:
        PredictionResponse: 予測結果、評価指標、特徴量重要度
    """
    try:
        start_date_obj = None
        if request.start_date:
            start_date_obj = date.fromisoformat(request.start_date)
        
        print(f"[main.py] predict_sales called: store_id={request.store_id}, retrain={request.retrain}")
        
        result = run_sales_prediction(
            store_id=request.store_id,
            predict_days=request.predict_days,
            start_date=start_date_obj,
            retrain=request.retrain  # 再学習フラグを渡す
        )
        
        return PredictionResponse(
            success=True,
            predictions=result['predictions'],
            metrics=result['metrics'],
            message="予測が正常に完了しました"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"予測エラー: {str(e)}")

@app.get("/predict/{store_id}")
async def predict_sales_get(
    store_id: int,
    predict_days: int = Query(7, ge=1, le=30),
    start_date: Optional[str] = Query(None)
):
    """
    GETリクエストで売上予測を実行
    """
    try:
        start_date_obj = None
        if start_date:
            start_date_obj = date.fromisoformat(start_date)
        
        result = run_sales_prediction(
            store_id=store_id,
            predict_days=predict_days,
            start_date=start_date_obj
        )
        
        return PredictionResponse(
            success=True,
            predictions=result['predictions'],
            metrics=result['metrics'],
            message="予測が正常に完了しました"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"予測エラー: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

