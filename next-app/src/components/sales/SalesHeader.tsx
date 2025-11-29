import React, { useMemo, memo } from 'react';
import { RefreshCw, TrendingUp, Settings, FileText, Download } from 'lucide-react';
import { Store } from '@/types/store';
import { formatStoreName } from '@/utils/storeDisplay';
import Link from 'next/link';

interface SalesHeaderProps {
  currentYear: number;
  currentMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onDataReload: () => void;
  onOpenForm?: () => void;
  onCsvExport?: () => void;
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
  onDataReload,
  onOpenForm,
  onCsvExport,
  userRole,
  stores,
  selectedStoreId,
  currentStoreName,
  onStoreChange,
}) => {
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onYearChange(parseInt(e.target.value));
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
              <select
                value={currentYear}
                onChange={handleYearChange}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {getYearOptions.map(year => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onMonthChange(m)}
                    className={`
                      px-2.5 py-1 text-xs font-medium rounded transition-all
                      ${currentMonth === m
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                  >
                    {m}月
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center space-x-3">
            {onOpenForm && (
              <button
                onClick={onOpenForm}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              >
                <FileText className="w-4 h-4 mr-2" />
                データ入力
              </button>
            )}
            {onCsvExport && (
              <button
                onClick={onCsvExport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV出力
              </button>
            )}
            <button
              onClick={onDataReload}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              更新
            </button>

            <Link
              href="/admin/sales-field-settings"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <Settings className="w-4 h-4 mr-2" />
              表示項目設定
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});

export { SalesHeader };