import React, { useMemo, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Database, TrendingUp } from 'lucide-react';
import { Store } from '@/stores/storeStore';
import { formatStoreName } from '@/utils/storeDisplay';

interface SalesHeaderProps {
  currentYear: number;
  currentMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onOpenForm: () => void;
  onDataReload: () => void;
  onLoadDemoData: () => void;
  // 店舗関連のprops
  userRole: 'admin' | 'super_admin';
  stores: Store[];
  selectedStoreId?: string;
  currentStoreName?: string;
  onStoreChange?: (storeId: string) => void;
}

const SalesHeader: React.FC<SalesHeaderProps> = memo(({
  currentYear,
  currentMonth,
  onYearChange,
  onMonthChange,
  onOpenForm,
  onDataReload,
  onLoadDemoData,
  userRole,
  stores,
  selectedStoreId,
  currentStoreName,
  onStoreChange,
}) => {
  const handlePrevMonth = useCallback(() => {
    if (currentMonth === 1) {
      onYearChange(currentYear - 1);
      onMonthChange(12);
    } else {
      onMonthChange(currentMonth - 1);
    }
  }, [currentMonth, currentYear, onYearChange, onMonthChange]);

  const handleNextMonth = useCallback(() => {
    if (currentMonth === 12) {
      onYearChange(currentYear + 1);
      onMonthChange(1);
    } else {
      onMonthChange(currentMonth + 1);
    }
  }, [currentMonth, currentYear, onYearChange, onMonthChange]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onYearChange(parseInt(e.target.value));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onMonthChange(parseInt(e.target.value));
  };

  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onStoreChange) {
      onStoreChange(e.target.value);
    }
  };

  const getYearOptions = useMemo(() => {
    const currentYearValue = new Date().getFullYear();
    const years = [];
    for (let year = currentYearValue - 2; year <= currentYearValue + 1; year++) {
      years.push(year);
    }
    return years;
  }, []);

  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* タイトルと店舗情報 */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                売上管理
              </h1>
              
              {/* 店舗選択/表示 */}
              {userRole === 'super_admin' ? (
                // 総管理者：店舗選択ドロップボックス
                <select
                  value={selectedStoreId || ''}
                  onChange={handleStoreChange}
                  className="ml-3 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">店舗を選択してください</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>
                      {formatStoreName(store)}
                    </option>
                  ))}
                </select>
              ) : (
                // 管理者：所属店舗名表示
                currentStoreName && (
                  <span className="ml-3 px-3 py-2 bg-gray-100 text-sm font-medium text-gray-700 rounded-lg">
                    {currentStoreName}
                  </span>
                )
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePrevMonth}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-2">
                <select
                  value={currentYear}
                  onChange={handleYearChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {getYearOptions().map(year => (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  ))}
                </select>
                
                <select
                  value={currentMonth}
                  onChange={handleMonthChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {monthNames.map((name, index) => (
                    <option key={index + 1} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={handleNextMonth}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onLoadDemoData}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <Database className="w-4 h-4 mr-2" />
              デモデータ
            </button>
            
            <button
              onClick={onDataReload}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              更新
            </button>
            
            <button
              onClick={onOpenForm}
              className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              新規入力
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export { SalesHeader };