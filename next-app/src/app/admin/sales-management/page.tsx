'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SalesHeader } from '@/components/sales/SalesHeader';
import { SimpleSalesTable } from '@/components/sales/SimpleSalesTable';
import { SimpleSalesForm } from '@/components/sales/SimpleSalesForm';
import { SalesFieldConfiguration } from '@/components/sales/SalesFieldConfiguration';
import { SalesCsvExportModal } from '@/components/sales/SalesCsvExportModal';
import { useSalesData, usePrefetchAdjacentMonths } from '@/hooks/queries/useSalesQueries';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName } from '@/utils/storeDisplay';
import { useBusinessTypeFields } from '@/hooks/useBusinessTypeFields';
import { getDefaultFieldConfigs } from '@/types/sales-field-config';
import apiClient from '@/lib/api';

const SalesManagementPage = () => {
  const { user, hasPermission } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'data' | 'fields'>('data');
  const [isHydrated, setIsHydrated] = useState(false);

  // Get businessTypeId from selected store
  const selectedStore = stores.find(store => String(store.id) === selectedStoreId);
  const businessTypeId = selectedStore?.businessTypeId;

  // Use business type field configuration
  const {
    fields: fieldConfigs,
    saveFields,
    isLoading: isFieldsLoading
  } = useBusinessTypeFields(businessTypeId);

  // Use React Query for data fetching
  const { data: monthlyData, isLoading, error, refetch } = useSalesData(selectedStoreId, currentYear, currentMonth);

  // Debug logging (using JSON.stringify for better visibility)
  const renderState = {
    isLoading,
    error: error ? String(error) : null,
    hasMonthlyData: !!monthlyData,
    dailyDataKeys: monthlyData?.dailyData ? Object.keys(monthlyData.dailyData).length : 0,
    sampleDates: monthlyData?.dailyData ? Object.keys(monthlyData.dailyData).slice(0, 3) : [],
    selectedStoreId,
    currentYear,
    currentMonth
  };
  console.log(`[SalesManagementPage] Render state for ${currentYear}/${currentMonth}:`, JSON.stringify(renderState, null, 2));

  // Prefetch adjacent months for better performance
  const { prefetchMonths } = usePrefetchAdjacentMonths(selectedStoreId, currentYear, currentMonth);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [isCsvExportModalOpen, setIsCsvExportModalOpen] = useState(false);

  // Hydration確認
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // 店舗データを取得
  useEffect(() => {
    if (user && hasPermission('admin')) {
      fetchStores();
    }
  }, [user, hasPermission, fetchStores]);

  // ユーザーの権限に応じて初期店舗を設定
  useEffect(() => {
    console.log('[SalesManagementPage] Store selection effect:', {
      hasUser: !!user,
      userStoreId: user?.storeId,
      storesCount: stores.length,
      currentSelectedStoreId: selectedStoreId,
      stores: stores.map(s => ({ id: s.id, name: s.name }))
    });
    
    if (user && stores.length > 0 && !selectedStoreId) {
      // 管理者・総管理者の場合：所属する店舗を自動選択
      // 総管理者は後で他の店舗に変更可能
      if (user.storeId) {
        console.log('[SalesManagementPage] Setting storeId from user:', String(user.storeId));
        setSelectedStoreId(String(user.storeId));
      } else if (stores.length > 0) {
        // user.storeIdがない場合は、最初の店舗を選択
        console.log('[SalesManagementPage] User has no storeId, selecting first store:', String(stores[0].id));
        setSelectedStoreId(String(stores[0].id));
      }
    }
  }, [user, stores, selectedStoreId, setSelectedStoreId]);

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

  // CSV出力処理
  const handleCsvExport = async (options: {
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
    selectedFields: string[];
  }) => {
    if (!selectedStoreId) {
      alert('店舗を選択してください。');
      return;
    }

    try {
      // 期間内のすべての月のデータを取得
      const months: { year: number; month: number }[] = [];
      let currentYear = options.startYear;
      let currentMonth = options.startMonth;

      while (
        currentYear < options.endYear ||
        (currentYear === options.endYear && currentMonth <= options.endMonth)
      ) {
        months.push({ year: currentYear, month: currentMonth });
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }

      // すべての月のデータを取得
      const allData: Array<{ date: string; [key: string]: any }> = [];
      for (const { year, month } of months) {
        const response = await apiClient.getSales(selectedStoreId, year, month);
        if (response.success && response.data?.dailyData) {
          const dailyData = response.data.dailyData;
          for (const date in dailyData) {
            const dayData = dailyData[date] as any;
            const row: { date: string; [key: string]: any } = { date };
            
            // 選択されたフィールドのみを追加
            options.selectedFields.forEach(fieldKey => {
              const field = fieldConfigs.find(f => f.key === fieldKey);
              if (field) {
                const value = dayData[fieldKey];
                row[field.label] = value !== null && value !== undefined ? value : '';
              }
            });
            
            allData.push(row);
          }
        }
      }

      // CSV生成
      if (allData.length === 0) {
        alert('出力するデータがありません。');
        return;
      }

      // ヘッダー行
      const headers = ['日付', ...options.selectedFields.map(key => {
        const field = fieldConfigs.find(f => f.key === key);
        return field ? field.label : key;
      })];

      // CSV行を生成
      const csvRows = [
        headers.join(','),
        ...allData.map(row => {
          const values = [
            row.date,
            ...options.selectedFields.map(key => {
              const field = fieldConfigs.find(f => f.key === key);
              const value = row[field?.label || key];
              // CSVエスケープ処理
              if (value === null || value === undefined) return '';
              const stringValue = String(value);
              if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
          ];
          return values.join(',');
        })
      ];

      // BOM付きUTF-8でCSVファイルを生成
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `売上データ_${options.startYear}年${options.startMonth}月_${options.endYear}年${options.endMonth}月.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV出力エラー:', error);
      alert('CSV出力に失敗しました。');
      throw error;
    }
  };

  // Helper functions for compatibility with existing components
  const getDailyData = (date: string) => {
    if (!monthlyData?.dailyData) return undefined;
    const data = monthlyData.dailyData[date];
    if (!data) return undefined;
    return data;
  };

  const hasData = (date: string) => {
    if (!monthlyData?.dailyData) return false;
    const data = monthlyData.dailyData[date];
    // netSales（店舗純売上）があればデータありと判定
    return !!(data && (data as any).netSales !== undefined);
  };
  // Transform dailyData to format expected by SimpleSalesTable
  const transformedDailyData = useMemo(() => {
    if (!monthlyData?.dailyData) return {};

    const transformed: { [date: string]: any } = {};

    for (const date in monthlyData.dailyData) {
      const data = monthlyData.dailyData[date] as any;

      transformed[date] = {
        date: data.date || date,
        dayOfWeek: data.dayOfWeek || '',
        // 売上・目標関連
        salesTarget: data.salesTarget,
        targetCumulative: data.targetCumulative,
        targetRatio: data.targetRatio,
        yearOverYear: data.yearOverYear,
        edwYearOverYear: data.edwYearOverYear,
        ohbYearOverYear: data.ohbYearOverYear,
        aggregator: data.aggregator,
        // 店舗純売上
        netSales: data.netSales,
        netSalesCumulative: data.netSalesCumulative,
        // EDW・OHB売上
        edwNetSales: data.edwNetSales,
        edwNetSalesCumulative: data.edwNetSalesCumulative,
        ohbNetSales: data.ohbNetSales,
        ohbNetSalesCumulative: data.ohbNetSalesCumulative,
        // 客数・組数
        totalGroups: data.totalGroups,
        totalCustomers: data.totalCustomers,
        groupUnitPrice: data.groupUnitPrice,
        customerUnitPrice: data.customerUnitPrice,
        // 人件費関連
        katougi: data.katougi,
        ishimori: data.ishimori,
        osawa: data.osawa,
        washizuka: data.washizuka,
        employeeHours: data.employeeHours,
        asHours: data.asHours,
        salesPerHour: data.salesPerHour,
        laborCost: data.laborCost,
        laborCostRate: data.laborCostRate,
        // EDW営業明細
        lunchSales: data.lunchSales,
        dinnerSales: data.dinnerSales,
        lunchCustomers: data.lunchCustomers,
        dinnerCustomers: data.dinnerCustomers,
        lunchGroups: data.lunchGroups,
        dinnerGroups: data.dinnerGroups,
        edwCustomerUnitPrice: data.edwCustomerUnitPrice,
        lunchUnitPrice: data.lunchUnitPrice,
        dinnerUnitPrice: data.dinnerUnitPrice,
        // OHB
        ohbSales: data.ohbSales,
        ohbCustomers: data.ohbCustomers,
        ohbGroups: data.ohbGroups,
        ohbCustomerUnitPrice: data.ohbCustomerUnitPrice,
        // VOID関連
        voidCount: data.voidCount,
        voidAmount: data.voidAmount,
        salesDiscrepancy: data.salesDiscrepancy,
        // 生産性
        totalHours: data.totalHours,
        edwBaitHours: data.edwBaitHours,
        ohbBaitHours: data.ohbBaitHours,
        edwProductivity: data.edwProductivity,
        ohbProductivity: data.ohbProductivity,
        totalProductivity: data.totalProductivity,
        // OHB予約
        reservationCount: data.reservationCount,
        plain: data.plain,
        junsei: data.junsei,
        seasonal: data.seasonal,
        // アンケート
        surveyCount: data.surveyCount,
        surveyRate: data.surveyRate,
        // 旧フィールド（互換性のため）
        revenue: data.netSales,
        cost: data.laborCost,
        profit: (data.netSales || 0) - (data.laborCost || 0),
      };
    }

    return transformed;
  }, [monthlyData?.dailyData]);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
  };

  // 権限チェック（管理者以上のみアクセス可能）
  if (!user || !hasPermission('admin')) {
    return (
      
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
      
    );
  }

  // 現在選択されている店舗名を取得
  const getCurrentStoreName = () => {
    if (!selectedStoreId) return '';
    const selectedStore = stores.find(store => String(store.id) === selectedStoreId);
    return selectedStore ? formatStoreName(selectedStore) : '';
  };

  return (
    
      <div className="min-h-screen bg-gray-50">
        <SalesHeader
          currentYear={currentYear}
          currentMonth={currentMonth}
          onYearChange={handleYearChange}
          onMonthChange={handleMonthChange}
          onDataReload={handleDataReload}
          onOpenForm={() => {
            // 今日の日付でフォームを開く
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            setSelectedDate(todayStr);
            setIsFormOpen(true);
          }}
          onCsvExport={() => setIsCsvExportModalOpen(true)}
          userRole={user.role}
          stores={stores}
          selectedStoreId={selectedStoreId}
          currentStoreName={getCurrentStoreName()}
          onStoreChange={handleStoreChange}
        />

        {/* タブナビゲーション */}
        <div className="w-full px-4 py-4 bg-white border-b">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('data')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'data'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              データ入力
            </button>
            <button
              onClick={() => setActiveTab('fields')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'fields'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              項目設定
            </button>
          </div>
        </div>

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
          ) : selectedStoreId || hasPermission('admin') ? (
            <>
              {activeTab === 'data' ? (
                <>
                  {monthlyData && monthlyData.dailyData && (
                    <SimpleSalesTable
                      dailyData={transformedDailyData}
                      hasData={hasData}
                      onEditClick={handleOpenForm}
                      currentYear={currentYear}
                      currentMonth={currentMonth}
                    />
                  )}
                  {!monthlyData && !isLoading && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center text-gray-600">
                        店舗を選択してください
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // 項目設定タブ
                <div className="max-w-4xl mx-auto">
                  {isHydrated && selectedStoreId && (
                    <SalesFieldConfiguration
                      fields={fieldConfigs}
                      onFieldsChange={async (newFields) => {
                        const success = await saveFields(newFields);
                        if (success) {
                          alert('項目設定を保存しました（同じ業態の全店舗に反映されます）');
                        }
                      }}
                      businessTypeName={selectedStore?.businessTypeName || getCurrentStoreName() || 'デフォルト'}
                    />
                  )}
                  {isFieldsLoading && selectedStoreId && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">項目設定を読み込み中...</p>
                      </div>
                    </div>
                  )}
                  {!selectedStoreId && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center text-gray-600">
                        店舗を選択してください
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
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

        <SimpleSalesForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          selectedDate={selectedDate}
          initialData={getDailyData(selectedDate)}
          storeId={selectedStoreId}
          year={currentYear}
          month={currentMonth}
        />

        {/* CSV出力モーダル */}
        <SalesCsvExportModal
          isOpen={isCsvExportModalOpen}
          onClose={() => setIsCsvExportModalOpen(false)}
          onExport={handleCsvExport}
          availableFields={fieldConfigs.length > 0 ? fieldConfigs : getDefaultFieldConfigs()}
          currentYear={currentYear}
          currentMonth={currentMonth}
          type="daily"
        />
      </div>
    );
  };
  
  export default SalesManagementPage; 