'use client';

import React, { useState, useEffect } from 'react';
import { BusinessTypeFieldConfiguration } from '@/components/monthly-sales/BusinessTypeFieldConfiguration';
import { StoreMonthlyDataTable } from '@/components/monthly-sales/StoreMonthlyDataTable';
import { DataEntryModal } from '@/components/monthly-sales/DataEntryModal';
import AppLayout from '@/app/appLayout/layout';
import { 
  BusinessType, 
  StoreMonthlyData,
  MonthlyData,
  DEFAULT_FIELDS 
} from '@/types/monthly-sales';
import { generateId } from '../../../utils/calculations';
import { useStoreStore } from '../../../stores/storeStore';
import { useAuthStore } from '../../../stores/authStore';
import { BarChart3, Settings, Database, RefreshCw, ShieldCheck, Store } from 'lucide-react';
import { aggregateDailyToMonthly } from '@/utils/monthlySalesAggregator';
import { useSalesData } from '@/hooks/useSalesData';
import { formatStoreName } from '@/utils/storeDisplay';

// API連携用のヘルパー関数
const fetchMonthlyData = async (storeId: string, businessTypeId: string): Promise<MonthlyData[]> => {
  try {
    // TODO: 実際のAPIエンドポイントに置き換える
    const response = await fetch(`/api/monthly-sales?storeId=${storeId}&businessTypeId=${businessTypeId}`);
    if (response.ok) {
      const data = await response.json();
      return data.success ? data.data : [];
    }
    return [];
  } catch (error) {
    console.error('月次データ取得エラー:', error);
    return [];
  }
};

// 日次売上データ取得関数（localStorageから取得）
function getDailySalesDataForMonth(storeId: string, year: number, month: number): any[] {
  try {
    const key = `salesData_${storeId}_${year}_${month}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const monthly = JSON.parse(raw);
    if (!monthly || !monthly.dailyData) return [];
    return Object.values(monthly.dailyData);
  } catch {
    return [];
  }
}

// ローカルストレージのヘルパー関数
const getLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

const setLocalStorage = <T,>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
};

export default function MonthlySalesPage() {
  const { stores } = useStoreStore();
  const { user } = useAuthStore();
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [storeData, setStoreData] = useState<StoreMonthlyData[]>([]);
  const [activeTab, setActiveTab] = useState<'data' | 'fields'>('data');
  const [editingData, setEditingData] = useState<MonthlyData | null>(null);
  const [editingStoreId, setEditingStoreId] = useState<string>('');
  const [editingBusinessTypeId, setEditingBusinessTypeId] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  // クライアントサイドでのみ実行
  useEffect(() => {
    setIsClient(true);
    
    // ローカルストレージからデータを読み込み
    const storedBusinessTypes = getLocalStorage('monthly-sales-business-types', []);
    const storedStoreData = getLocalStorage('monthly-sales-store-data', []);
    
    setBusinessTypes(storedBusinessTypes);
    setStoreData(storedStoreData);
  }, []);

  // 初期デモ業態の作成
  useEffect(() => {
    if (isClient && businessTypes.length === 0 && user?.role === 'super_admin') {
      const defaultBusinessType: BusinessType = {
        id: generateId(),
        name: 'カフェ・レストラン',
        fields: DEFAULT_FIELDS.map((field) => ({
          ...field,
          id: generateId(),
        })),
      };
      const newBusinessTypes = [defaultBusinessType];
      setBusinessTypes(newBusinessTypes);
      setLocalStorage('monthly-sales-business-types', newBusinessTypes);
    }
  }, [isClient, businessTypes.length, user?.role]);

  // 店舗データの初期化
  useEffect(() => {
    if (isClient && stores.length > 0 && businessTypes.length > 0) {
      const existingStoreIds = new Set(storeData.map(sd => sd.storeId));
      const newStoreData: StoreMonthlyData[] = [];

      stores.forEach(store => {
        if (!existingStoreIds.has(store.id)) {
          // 店舗の業態に対応する BusinessType を探す
          const businessType = businessTypes.find(bt => bt.name.includes('カフェ') || bt.name.includes('レストラン'));
          if (businessType) {
            newStoreData.push({
              storeId: store.id,
              storeName: store.name,
              businessTypeId: businessType.id,
              monthlyData: [],
            });
          }
        }
      });

      if (newStoreData.length > 0) {
        const updatedStoreData = [...storeData, ...newStoreData];
        setStoreData(updatedStoreData);
        setLocalStorage('monthly-sales-store-data', updatedStoreData);
      }
    }
  }, [isClient, stores, businessTypes, storeData]);

  // 店舗選択時の自動集計処理
  useEffect(() => {
    if (isClient && selectedStoreId && businessTypes.length > 0) {
      const storeDataItem = storeData.find(sd => sd.storeId === selectedStoreId);
      if (storeDataItem && storeDataItem.monthlyData.length === 0) {
        // 月次データが空の場合、自動的に集計を実行
        handleAutoAggregate(selectedStoreId);
      }
    }
  }, [isClient, selectedStoreId, businessTypes, storeData]);

  // 自動集計処理
  const handleAutoAggregate = (storeId: string) => {
    if (!isClient) return;
    
    try {
      const storeDataItem = storeData.find(sd => sd.storeId === storeId);
      if (!storeDataItem) return;

      const businessType = businessTypes.find(bt => bt.id === storeDataItem.businessTypeId);
      if (!businessType || businessType.fields.length === 0) return;

      // 過去12ヶ月分の日次データを集計
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const aggregatedData: MonthlyData[] = [];

      for (let i = 11; i >= 0; i--) {
        let year = currentYear;
        let month = currentMonth - i;
        
        if (month <= 0) {
          month += 12;
          year -= 1;
        }

        const dailyData = getDailySalesDataForMonth(storeId, year, month);
        if (dailyData.length > 0) {
          const monthlyData = aggregateDailyToMonthly(dailyData, storeId, storeDataItem.businessTypeId, year, month);
          aggregatedData.push({
            id: `${storeId}_${storeDataItem.businessTypeId}_${year}_${month}`,
            storeId: storeId,
            businessTypeId: storeDataItem.businessTypeId,
            year,
            month,
            data: monthlyData.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // 集計データを更新
      const updatedStoreData = storeData.map(sd => 
        sd.storeId === storeId 
          ? { ...sd, monthlyData: aggregatedData }
          : sd
      );
      
      setStoreData(updatedStoreData);
      setLocalStorage('monthly-sales-store-data', updatedStoreData);
    } catch (error) {
      console.error('自動集計エラー:', error);
    }
  };

  const handleBusinessTypesChange = (updatedBusinessTypes: BusinessType[]) => {
    setBusinessTypes(updatedBusinessTypes);
    setLocalStorage('monthly-sales-business-types', updatedBusinessTypes);
  };

  const handleStoreDataChange = (updatedStoreData: StoreMonthlyData[]) => {
    setStoreData(updatedStoreData);
    setLocalStorage('monthly-sales-store-data', updatedStoreData);
  };

  const handleEditData = (data: MonthlyData, storeId: string, businessTypeId: string) => {
    setEditingData(data);
    setEditingStoreId(storeId);
    setEditingBusinessTypeId(businessTypeId);
  };

  const handleDataSave = (updatedData: MonthlyData) => {
    const updatedStoreData = storeData.map(sd => {
      if (sd.storeId === editingStoreId && sd.businessTypeId === editingBusinessTypeId) {
        const updatedMonthlyData = sd.monthlyData.map(md => 
          md.year === updatedData.year && md.month === updatedData.month 
            ? updatedData 
            : md
        );
        return { ...sd, monthlyData: updatedMonthlyData };
      }
      return sd;
    });

    setStoreData(updatedStoreData);
    setLocalStorage('monthly-sales-store-data', updatedStoreData);
    setEditingData(null);
    setEditingStoreId('');
    setEditingBusinessTypeId('');
  };

  const handleLoadData = async () => {
    try {
      const updatedStoreData = await Promise.all(
        storeData.map(async (sd) => {
          const businessType = businessTypes.find(bt => bt.id === sd.businessTypeId);
          if (businessType && businessType.fields.length > 0) {
            const monthlyData = await fetchMonthlyData(sd.storeId, sd.businessTypeId);
            return { ...sd, monthlyData };
          }
          return sd;
        })
      );
      setStoreData(updatedStoreData);
      setLocalStorage('monthly-sales-store-data', updatedStoreData);
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      alert('データの読み込みに失敗しました。');
    }
  };

  const handleResetData = async () => {
    if (!isClient) return;
    
    if (window.confirm('全ての月次データを削除しますか？この操作は取り消せません。')) {
      try {
        const resetStoreData = storeData.map(sd => ({ ...sd, monthlyData: [] }));
        setStoreData(resetStoreData);
        setLocalStorage('monthly-sales-store-data', resetStoreData);
      } catch (error) {
        console.error('データ削除エラー:', error);
        alert('データの削除に失敗しました。');
      }
    }
  };

  const currentStore = stores.find(store => store.id === editingStoreId);
  const currentBusinessType = businessTypes.find(bt => bt.id === editingBusinessTypeId);
  const selectedStoreData = storeData.find(sd => sd.storeId === selectedStoreId);

  // クライアントサイドでない場合はローディング表示
  if (!isClient) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 -m-6 p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 -m-6 p-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">月次売上管理</h1>
              <p className="text-gray-600 font-medium">Monthly Sales Management System</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex bg-white/60 backdrop-blur-sm rounded-xl p-1 shadow-lg border border-white/20">
              <button
                onClick={() => setActiveTab('data')}
                className={`flex items-center px-6 py-3 rounded-lg transition-all duration-200 font-semibold ${
                  activeTab === 'data'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-white/60'
                }`}
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                データ表示・入力
              </button>
              {user?.role === 'super_admin' && (
                <button
                  onClick={() => setActiveTab('fields')}
                  className={`flex items-center px-6 py-3 rounded-lg transition-all duration-200 font-semibold ${
                    activeTab === 'fields'
                      ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-white/60'
                  }`}
                >
                  <Settings className="w-5 h-5 mr-2" />
                  業態別項目設定
                  <ShieldCheck className="w-4 h-4 ml-2 text-purple-300" />
                </button>
              )}
            </div>

            {/* Demo Controls */}
            {activeTab === 'data' && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleLoadData}
                  className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  <Database className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-200" />
                  <span className="font-semibold">データ読み込み</span>
                </button>
                <button
                  onClick={handleResetData}
                  className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  <RefreshCw className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-300" />
                  <span className="font-semibold">データリセット</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'data' ? (
          <div>
            {/* 店舗選択 */}
            <div className="mb-6">
              <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Store className="w-6 h-6 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">店舗選択</h3>
                </div>
                <div className="flex items-center space-x-4">
                  <label htmlFor="store-select" className="text-sm font-medium text-gray-700">
                    店舗:
                  </label>
                  <select
                    id="store-select"
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  >
                    <option value="">店舗を選択してください</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {formatStoreName(store)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 選択された店舗の月次データ表示 */}
            {selectedStoreId && selectedStoreData ? (
              <StoreMonthlyDataTable
                businessTypes={businessTypes}
                storeData={[selectedStoreData]}
                onDataChange={handleStoreDataChange}
                onEditData={handleEditData}
              />
            ) : selectedStoreId ? (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-16 text-center">
                <div className="text-gray-400 mb-8">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl blur opacity-25"></div>
                    <div className="relative bg-gradient-to-r from-blue-500 to-indigo-500 p-6 rounded-2xl">
                      <BarChart3 className="w-16 h-16 text-white mx-auto" />
                    </div>
                  </div>
                </div>
                <h4 className="text-2xl font-bold text-gray-900 mb-4">データが見つかりません</h4>
                <p className="text-gray-500 text-lg">
                  選択された店舗の月次データが存在しません。
                </p>
              </div>
            ) : (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-16 text-center">
                <div className="text-gray-400 mb-8">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-gray-500 rounded-2xl blur opacity-25"></div>
                    <div className="relative bg-gradient-to-r from-gray-500 to-gray-600 p-6 rounded-2xl">
                      <Store className="w-16 h-16 text-white mx-auto" />
                    </div>
                  </div>
                </div>
                <h4 className="text-2xl font-bold text-gray-900 mb-4">店舗を選択してください</h4>
                <p className="text-gray-500 text-lg">
                  上記のドロップダウンから店舗を選択すると、月次売上データが表示されます。
                </p>
              </div>
            )}
          </div>
        ) : user?.role === 'super_admin' ? (
          <BusinessTypeFieldConfiguration
            onBusinessTypesChange={handleBusinessTypesChange}
          />
        ) : (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-16 text-center">
            <div className="text-gray-400 mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-400 rounded-2xl blur opacity-25"></div>
                <div className="relative bg-gradient-to-r from-red-500 to-pink-500 p-6 rounded-2xl">
                  <ShieldCheck className="w-16 h-16 text-white mx-auto" />
                </div>
              </div>
            </div>
            <h4 className="text-2xl font-bold text-gray-900 mb-4">アクセス権限がありません</h4>
            <p className="text-gray-500 text-lg">
              業態別項目設定は総管理者のみがアクセス可能です。
            </p>
          </div>
        )}

        {/* Data Entry Modal */}
        {editingData && currentStore && currentBusinessType && (
          <DataEntryModal
            businessType={currentBusinessType}
            storeName={currentStore.name}
            data={editingData}
            isOpen={!!editingData}
            onClose={() => {
              setEditingData(null);
              setEditingStoreId('');
              setEditingBusinessTypeId('');
            }}
            onSave={handleDataSave}
          />
        )}
      </div>
    </AppLayout>
  );
} 