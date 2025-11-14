'use client';

import React, { useState, useEffect } from 'react';
import { BusinessTypeFieldConfiguration } from '@/components/monthly-sales/BusinessTypeFieldConfiguration';
import { StoreMonthlyDataTable } from '@/components/monthly-sales/StoreMonthlyDataTable';
import { DataEntryModal } from '@/components/monthly-sales/DataEntryModal';
import {
  BusinessType,
  StoreMonthlyData,
  MonthlyData,
  DEFAULT_FIELDS
} from '@/types/monthly-sales';
import { generateId } from '../../../utils/calculations';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { useStoreStore } from '../../../stores/storeStore';
import { useAuthStore } from '../../../stores/authStore';
import { BarChart3, Settings, Database, RefreshCw, ShieldCheck } from 'lucide-react';

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

// const saveMonthlyDataAPI = async (data: MonthlyData): Promise<boolean> => {
//   try {
//     // TODO: 実際のAPIエンドポイントに置き換える
//     const response = await fetch('/api/monthly-sales', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(data),
//     });
//     return response.ok;
//   } catch (error) {
//     console.error('月次データ保存エラー:', error);
//     return false;
//   }
// };

export default function MonthlySalesPage() {
  const { stores, fetchStores } = useStoreStore();
  const { isSuperAdmin, user } = useAuthStore();
  const [businessTypes, setBusinessTypes] = useLocalStorage<BusinessType[]>('monthly-sales-business-types', []);
  const [storeData, setStoreData] = useLocalStorage<StoreMonthlyData[]>('monthly-sales-store-data', []);
  const [activeTab, setActiveTab] = useState<'data' | 'fields'>('data');
  const [editingData, setEditingData] = useState<MonthlyData | null>(null);
  const [editingStoreId, setEditingStoreId] = useState<string>('');
  const [editingBusinessTypeId, setEditingBusinessTypeId] = useState<string>('');

  // 店舗データを取得
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      fetchStores();
    }
  }, [user, fetchStores]);

  // 初期デモ業態の作成
  useEffect(() => {
    if (businessTypes.length === 0 && isSuperAdmin()) {
      const defaultBusinessType: BusinessType = {
        id: generateId(),
        name: 'カフェ・レストラン',
        fields: DEFAULT_FIELDS.map((field) => ({
          ...field,
          id: generateId(),
        })),
      };
      setBusinessTypes([defaultBusinessType]);
    }
  }, [businessTypes, setBusinessTypes, isSuperAdmin]);

  // 店舗データの初期化
  useEffect(() => {
    if (stores.length > 0 && businessTypes.length > 0) {
      const existingStoreIds = new Set(storeData.map(sd => sd.storeId));
      const newStoreData: StoreMonthlyData[] = [];

            stores.forEach(store => {
        if (!existingStoreIds.has(store.id)) {
          // 店舗の業態に対応する BusinessType を探す
          const businessType = businessTypes.find(bt => bt.id === store.businessTypeId) || businessTypes[0];

          newStoreData.push({
            storeId: store.id,
            storeName: store.name,
            businessTypeId: businessType.id,
            monthlyData: [],
          });
        }
      });

      if (newStoreData.length > 0) {
        setStoreData([...storeData, ...newStoreData]);
      }
    }
  }, [stores, businessTypes, storeData, setStoreData]);

  const handleBusinessTypesChange = (updatedBusinessTypes: BusinessType[]) => {
    setBusinessTypes(updatedBusinessTypes);
  };

  const handleStoreDataChange = (updatedStoreData: StoreMonthlyData[]) => {
    setStoreData(updatedStoreData);
  };

  const handleEditData = (data: MonthlyData, storeId: string, businessTypeId: string) => {
    setEditingData(data);
    setEditingStoreId(storeId);
    setEditingBusinessTypeId(businessTypeId);
  };

  const handleDataSave = (updatedData: MonthlyData) => {
    if (!editingStoreId) return;

    const updatedStoreData = storeData.map(sd => {
      if (sd.storeId === editingStoreId) {
        const existingDataIndex = sd.monthlyData.findIndex(md => md.id === updatedData.id);
        if (existingDataIndex >= 0) {
          // 既存データの更新
          const newMonthlyData = [...sd.monthlyData];
          newMonthlyData[existingDataIndex] = updatedData;
          return { ...sd, monthlyData: newMonthlyData };
        } else {
          // 新規データの追加
          return { ...sd, monthlyData: [...sd.monthlyData, updatedData] };
        }
      }
      return sd;
    });

    setStoreData(updatedStoreData);
    setEditingData(null);
    setEditingStoreId('');
    setEditingBusinessTypeId('');
  };

  const handleLoadData = async () => {
    if (businessTypes.length === 0) {
      alert('まず業態を設定してください。');
      return;
    }

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
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      alert('データの読み込みに失敗しました。');
    }
  };

  const handleResetData = async () => {
    if (window.confirm('全ての月次データを削除しますか？この操作は取り消せません。')) {
      try {
        // TODO: API呼び出しでデータベースからも削除
        const resetStoreData = storeData.map(sd => ({ ...sd, monthlyData: [] }));
        setStoreData(resetStoreData);
      } catch (error) {
        console.error('データ削除エラー:', error);
        alert('データの削除に失敗しました。');
      }
    }
  };

  const currentStore = stores.find(store => store.id === editingStoreId);
  const currentBusinessType = businessTypes.find(bt => bt.id === editingBusinessTypeId);

  return (
    
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
            {isSuperAdmin() && (
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
        <StoreMonthlyDataTable
          businessTypes={businessTypes}
          storeData={storeData}
          onDataChange={handleStoreDataChange}
          onEditData={handleEditData}
        />
      ) : isSuperAdmin() ? (
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
    
  );
}
