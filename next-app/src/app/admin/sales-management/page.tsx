'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/app/appLayout/layout';
import { SalesHeader } from '@/components/sales/SalesHeader';
// Lazy load heavy components for better performance
import { SalesTable } from '@/components/lazy';
import { OptimizedSalesForm } from '@/components/sales/OptimizedSalesForm';
import { useSalesData, usePrefetchAdjacentMonths } from '@/hooks/queries/useSalesQueries';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName } from '@/utils/storeDisplay';

const SalesManagementPage = () => {
  const { user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  
  // Use React Query for data fetching
  const { data: monthlyData, isLoading, error, refetch } = useSalesData(selectedStoreId, currentYear, currentMonth);
  
  // Prefetch adjacent months for better performance
  const { prefetchMonths } = usePrefetchAdjacentMonths(selectedStoreId, currentYear, currentMonth);

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

  // Prefetch adjacent months when store or date changes
  useEffect(() => {
    if (selectedStoreId) {
      prefetchMonths();
    }
  }, [selectedStoreId, currentYear, currentMonth, prefetchMonths]);

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

  const handleYearChange = (year: number) => {
    setCurrentYear(year);
  };

  const handleMonthChange = (month: number) => {
    setCurrentMonth(month);
  };

  const handleDataReload = () => {
    refetch();
  };

  // Helper functions for compatibility with existing components
  const getDailyData = (date: string) => {
    return monthlyData?.dailyData[date];
  };

  const hasData = (date: string) => {
    const data = monthlyData?.dailyData[date];
    return !!(data && (data as any).storeNetSales !== undefined);
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
          onLoadDemoData={() => {
            if (!selectedStoreId) {
              alert('店舗を選択してください。');
              return;
            }
            // Demo data loading would be implemented here
            console.log('Demo data loading not implemented in optimized version');
          }}
          userRole={user.role}
          stores={stores}
          selectedStoreId={selectedStoreId}
          currentStoreName={getCurrentStoreName()}
          onStoreChange={handleStoreChange}
        />
        
        <main className="w-full px-4 py-6">
          {error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.876c1.15 0 2.092-.954 2.092-2.094 0-.54-.223-1.032-.584-1.384L13.5 4.134c-.361-.352-.85-.554-1.36-.554s-.999.202-1.36.554L5.834 15.522c-.361.352-.584.844-.584 1.384 0 1.14.942 2.094 2.092 2.094z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  データの読み込みに失敗しました
                </h3>
                <p className="text-gray-600 mb-4">
                  {typeof error === 'string' ? error : 'ネットワークエラーが発生しました'}
                </p>
                <button
                  onClick={handleDataReload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  再試行
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">データを読み込み中...</p>
              </div>
            </div>
          ) : selectedStoreId || user.role === 'admin' ? (
            monthlyData && (
              {/* @ts-ignore - Dynamic component typing issue */}
              <SalesTable
                dailyData={monthlyData.dailyData}
                hasData={hasData}
                onEditClick={handleOpenForm}
                currentYear={currentYear}
                currentMonth={currentMonth}
              />
            )
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

        <OptimizedSalesForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          selectedDate={selectedDate}
          initialData={getDailyData(selectedDate)}
          storeId={selectedStoreId}
          year={currentYear}
          month={currentMonth}
        />
      </div>
    </AppLayout>
  );
};

export default SalesManagementPage; 