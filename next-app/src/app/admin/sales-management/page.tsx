'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/app/appLayout/layout';
import { SalesTable } from '@/components/sales/SalesTable';
import { SalesForm } from '@/components/sales/SalesForm';
import { SalesHeader } from '@/components/sales/SalesHeader';
import { useSalesData } from '@/hooks/useSalesData';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName } from '@/utils/storeDisplay';

const SalesManagementPage = () => {
  const { user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  
  const {
    currentYear,
    currentMonth,
    monthlyData,
    updateSalesData,
    getDailyData,
    hasData,
    changeMonth,
    forceReloadData,
    loadDemoData,
    isLoading,
  } = useSalesData(selectedStoreId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  // 店舗データを取得
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      fetchStores();
    }
  }, [user, fetchStores]);

  // ユーザーの権限に応じて初期店舗を設定
  useEffect(() => {
    if (user && stores.length > 0) {
      if (user.role === 'admin') {
        // 管理者の場合：所属する店舗を自動選択
        setSelectedStoreId(user.storeId);
      } else if (user.role === 'super_admin') {
        // 総管理者の場合：初期状態では店舗は未選択
        // ユーザーが手動で選択するまで空のまま
      }
    }
  }, [user, stores]);

  const handleOpenForm = (date?: string) => {
    if (!selectedStoreId) {
      alert('店舗を選択してください。');
      return;
    }
    
    if (date) {
      setSelectedDate(date);
    } else {
      // 新規登録の場合、今日の日付を設定
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
      setSelectedDate(todayStr);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedDate('');
  };

  const handleSaveData = (formData: any) => {
    updateSalesData(selectedDate, formData);
  };

  const handleYearChange = (year: number) => {
    changeMonth(year, currentMonth);
  };

  const handleMonthChange = (month: number) => {
    changeMonth(currentYear, month);
  };

  const handleDataReload = () => {
    forceReloadData();
  };

  const handleLoadDemoData = () => {
    if (!selectedStoreId) {
      alert('店舗を選択してください。');
      return;
    }
    loadDemoData();
  };

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
  };

  // 権限チェック（管理者以上のみアクセス可能）
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              アクセス権限がありません
            </h2>
            <p className="text-gray-600">
              この機能は管理者のみご利用いただけます。
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // 現在選択されている店舗名を取得
  const getCurrentStoreName = () => {
    if (!selectedStoreId) return '';
    const selectedStore = stores.find(store => store.id === selectedStoreId);
    return selectedStore ? formatStoreName(selectedStore) : '';
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        <SalesHeader
          currentYear={currentYear}
          currentMonth={currentMonth}
          onYearChange={handleYearChange}
          onMonthChange={handleMonthChange}
          onOpenForm={() => handleOpenForm()}
          onDataReload={handleDataReload}
          onLoadDemoData={handleLoadDemoData}
          userRole={user.role}
          stores={stores}
          selectedStoreId={selectedStoreId}
          currentStoreName={getCurrentStoreName()}
          onStoreChange={handleStoreChange}
        />
        
        <main className="w-full px-4 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">データを読み込み中...</p>
              </div>
            </div>
          ) : selectedStoreId || user.role === 'admin' ? (
            <SalesTable
              dailyData={monthlyData.dailyData}
              hasData={hasData}
              onEditClick={handleOpenForm}
              currentYear={currentYear}
              currentMonth={currentMonth}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  店舗を選択してください
                </h3>
                <p className="text-gray-600">
                  売上データを表示するには、上記から店舗を選択してください。
                </p>
              </div>
            </div>
          )}
        </main>

        <SalesForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveData}
          selectedDate={selectedDate}
          initialData={getDailyData(selectedDate)}
        />
      </div>
    </AppLayout>
  );
};

export default SalesManagementPage; 