import React, { useMemo, memo } from 'react';
import { RefreshCw, TrendingUp, Settings, FileText, Download, Upload, BarChart3 } from 'lucide-react';
import { Store } from '@/types/store';
import { formatStoreName } from '@/utils/storeDisplay';
import { PageHelpButton } from '@/components/common/PageHelpButton';
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
          <div className="flex flex-col space-y-2">
            {/* タイトル行 */}
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900">
                売上管理
              </h1>
              <PageHelpButton
                title="売上管理の使い方"
                content={
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">日次売上データの入力</h3>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>店舗を選択します（総管理者の場合）</li>
                        <li>年月を選択します</li>
                        <li>「データ入力」ボタンをクリックします</li>
                        <li>日付を選択して、売上データを入力します</li>
                      </ol>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">入力項目</h3>
                      <p className="text-sm mb-2">売上管理では、以下のような項目を入力できます：</p>
                      <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                        <li><strong>基本情報</strong>: 日付、曜日</li>
                        <li><strong>売上関連</strong>: 店舗純売上、EDW純売上、OHB純売上、売上目標など</li>
                        <li><strong>客数・組数</strong>: 組数（計）、客数（計）、組単価、客単価など</li>
                        <li><strong>人件費関連</strong>: 社員時間、AS時間、人時売上高、人件費額、人件費率など</li>
                        <li><strong>その他</strong>: VOID件数、VOID金額、売上金過不足など</li>
                      </ul>
                      <p className="text-sm mt-2 text-gray-600">※ 表示される項目は、業態によって異なります。</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">データの更新</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>「更新」ボタンをクリックすると、最新のデータを取得します</li>
                        <li>データは自動的に保存されます</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">CSV出力</h3>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>「CSV出力」ボタンをクリックします</li>
                        <li>出力期間と出力項目を選択します</li>
                        <li>「CSV出力」ボタンをクリックしてダウンロードします</li>
                      </ol>
                    </div>
                  </div>
                }
              />
            </div>
            
            {/* 店舗選択/表示と年月選択 */}
            <div className="flex items-center space-x-3">
              {/* 店舗選択/表示 */}
              {userRole === 'super_admin' ? (
                // 総管理者：店舗選択ドロップボックス
                <select
                  value={selectedStoreId || ''}
                  onChange={handleStoreChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <span className="px-3 py-2 bg-gray-100 text-sm font-medium text-gray-700 rounded-lg">
                    {currentStoreName}
                  </span>
                )
              )}
              
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

              <div className="grid grid-cols-6 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onMonthChange(m)}
                    className={`
                      w-10 h-10 text-xs font-medium rounded transition-all aspect-square flex items-center justify-center
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
          <div className="flex items-center space-x-2">
            {onOpenForm && (
              <button
                onClick={onOpenForm}
                className="inline-flex items-center px-3 py-2 h-9 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                データ入力
              </button>
            )}
            {onCsvExport && (
              <button
                onClick={onCsvExport}
                className="inline-flex items-center px-3 py-2 h-9 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              >
                <Download className="w-4 h-4 mr-1.5" />
                CSV出力
              </button>
            )}
            <Link
              href="/admin/sales-management/csv-import"
              className="inline-flex items-center px-3 py-2 h-9 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              CSV読み込み
            </Link>
            <button
              onClick={onDataReload}
              className="inline-flex items-center px-3 py-2 h-9 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              更新
            </button>

            <Link
              href="/admin/sales-field-settings"
              className="inline-flex items-center px-3 py-2 h-9 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <Settings className="w-4 h-4 mr-1.5" />
              設定
            </Link>
            <Link
              href="/admin/sales-prediction"
              className="inline-flex items-center px-3 py-2 h-9 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <BarChart3 className="w-4 h-4 mr-1.5" />
              予測
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});

export { SalesHeader };