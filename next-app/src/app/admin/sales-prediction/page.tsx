'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Calendar, BarChart3, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import apiClient from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Prediction {
  date: string;
  edw_sales: number;
  ohb_sales: number;
  is_predicted?: boolean;
  predicted_at?: string;
}

interface Metrics {
  edw: {
    mae: number;
    r2: number;
    mape: number;
    feature_importance: Record<string, number>;
  };
  ohb: {
    mae: number;
    r2: number;
    mape: number;
    feature_importance: Record<string, number>;
  };
}

export default function SalesPredictionPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [predictDays, setPredictDays] = useState<number>(7);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load stores on mount
  useEffect(() => {
    if (user && hasPermission('admin')) {
      fetchStores();
    }
  }, [user, hasPermission, fetchStores]);

  // Set initial store
  useEffect(() => {
    if (user && stores.length > 0 && !selectedStoreId) {
      if (user.storeId) {
        setSelectedStoreId(String(user.storeId));
      } else if (stores.length > 0) {
        setSelectedStoreId(String(stores[0].id));
      }
    }
  }, [user, stores, selectedStoreId]);

  // Load existing predictions
  useEffect(() => {
    if (selectedStoreId) {
      loadPredictions();
    }
  }, [selectedStoreId]);

  const loadPredictions = async () => {
    if (!selectedStoreId) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const apiBase = process.env.NODE_ENV === 'production' 
        ? '/bb/api' 
        : process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api`
          : 'http://localhost:3001/api';

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + predictDays - 1);
      const endDateStr = endDate.toISOString().split('T')[0];

      const response = await fetch(
        `${apiBase}/sales/predictions?storeId=${selectedStoreId}&startDate=${startDate}&endDate=${endDateStr}`,
        {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setPredictions(result.predictions || []);
        }
      }
    } catch (err) {
      console.error('予測結果の読み込みエラー:', err);
    }
  };

  const handlePredict = async () => {
    if (!selectedStoreId) {
      alert('店舗を選択してください。');
      return;
    }

    setIsPredicting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const apiBase = process.env.NODE_ENV === 'production' 
        ? '/bb/api' 
        : process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api`
          : 'http://localhost:3001/api';

      const response = await fetch(`${apiBase}/sales/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          storeId: parseInt(selectedStoreId),
          predictDays: predictDays,
          startDate: startDate,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPredictions(result.predictions || []);
        setMetrics(result.metrics || null);
        setSuccess('予測が正常に完了しました');
        // 予測結果を再読み込み
        await loadPredictions();
      } else {
        setError(result.error || '予測に失敗しました');
      }
    } catch (err: any) {
      console.error('予測エラー:', err);
      setError(err.message || '予測に失敗しました');
    } finally {
      setIsPredicting(false);
    }
  };

  // グラフ用データの準備
  const chartData = predictions
    .filter(pred => pred && pred.date) // null/undefinedを除外
    .map(pred => ({
      date: new Date(pred.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      edw_sales: Number(pred.edw_sales ?? 0),
      ohb_sales: Number(pred.ohb_sales ?? 0),
    }));

  // 特徴量重要度の上位5つを取得
  const getTopFeatures = (importance: Record<string, number>, topN: number = 5) => {
    return Object.entries(importance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([name, value]) => ({ name, value }));
  };

  if (!user || !hasPermission('admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            アクセス権限がありません
          </h2>
          <p className="text-gray-600">
            この機能は管理者のみご利用いただけます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                売上予測
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 設定セクション */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">予測設定</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                店舗を選択
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">店舗を選択してください</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                予測開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                予測日数
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={predictDays}
                onChange={(e) => setPredictDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handlePredict}
            disabled={isPredicting || !selectedStoreId}
            className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isPredicting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                予測実行中...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4 mr-2" />
                予測を実行
              </>
            )}
          </button>
        </div>

        {/* エラー・成功メッセージ */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-900">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-green-900">{success}</p>
            </div>
          </div>
        )}

        {/* 予測結果グラフ */}
        {predictions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">予測結果</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis 
                  tickFormatter={(value) => {
                    if (value == null || value === undefined) return '0';
                    return Number(value).toLocaleString();
                  }}
                />
                <Tooltip 
                  formatter={(value: any) => {
                    if (value == null || value === undefined) return '0';
                    return Number(value).toLocaleString();
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="edw_sales" stroke="#3b82f6" name="EDW売上" strokeWidth={2} />
                <Line type="monotone" dataKey="ohb_sales" stroke="#8b5cf6" name="OHB売上" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 予測精度 */}
        {metrics && metrics.edw && metrics.ohb && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">予測精度</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* EDW予測精度 */}
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">EDW売上</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">MAE (平均絶対誤差):</span>
                    <span className="text-sm font-medium">{(metrics.edw?.mae != null && metrics.edw.mae !== undefined) ? Number(metrics.edw.mae).toLocaleString() : 'N/A'}円</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">R² (決定係数):</span>
                    <span className="text-sm font-medium">{metrics.edw?.r2 ? (metrics.edw.r2 * 100).toFixed(2) : 'N/A'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">MAPE (平均絶対パーセント誤差):</span>
                    <span className="text-sm font-medium">{metrics.edw?.mape ? (metrics.edw.mape * 100).toFixed(2) : 'N/A'}%</span>
                  </div>
                </div>
              </div>

              {/* OHB予測精度 */}
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">OHB売上</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">MAE (平均絶対誤差):</span>
                    <span className="text-sm font-medium">{(metrics.ohb?.mae != null && metrics.ohb.mae !== undefined) ? Number(metrics.ohb.mae).toLocaleString() : 'N/A'}円</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">R² (決定係数):</span>
                    <span className="text-sm font-medium">{metrics.ohb?.r2 ? (metrics.ohb.r2 * 100).toFixed(2) : 'N/A'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">MAPE (平均絶対パーセント誤差):</span>
                    <span className="text-sm font-medium">{metrics.ohb?.mape ? (metrics.ohb.mape * 100).toFixed(2) : 'N/A'}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 特徴量重要度 */}
        {metrics && metrics.edw?.feature_importance && metrics.ohb?.feature_importance && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">特徴量重要度（上位5つ）</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* EDW特徴量重要度 */}
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">EDW売上</h3>
                <div className="space-y-2">
                  {getTopFeatures(metrics.edw.feature_importance, 5).map((feature, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{feature.name}</span>
                      <span className="text-sm font-medium text-blue-600">{feature.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* OHB特徴量重要度 */}
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">OHB売上</h3>
                <div className="space-y-2">
                  {getTopFeatures(metrics.ohb.feature_importance, 5).map((feature, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{feature.name}</span>
                      <span className="text-sm font-medium text-purple-600">{feature.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 予測結果テーブル */}
        {predictions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">予測結果詳細</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">日付</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700">EDW売上</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700">OHB売上</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((pred, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-900">
                        {new Date(pred.date).toLocaleDateString('ja-JP', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          weekday: 'short'
                        })}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-900">
                        {(pred.edw_sales != null && pred.edw_sales !== undefined) ? Number(pred.edw_sales).toLocaleString() : '0'}円
                      </td>
                      <td className="py-2 px-3 text-right text-gray-900">
                        {(pred.ohb_sales != null && pred.ohb_sales !== undefined) ? Number(pred.ohb_sales).toLocaleString() : '0'}円
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900">
                        {((pred.edw_sales ?? 0) + (pred.ohb_sales ?? 0)).toLocaleString()}円
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

