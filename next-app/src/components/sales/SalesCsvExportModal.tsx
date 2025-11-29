'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Calendar, CheckSquare, Square } from 'lucide-react';
import { SalesFieldConfig } from '@/types/sales-field-config';

interface SalesCsvExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: {
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
    selectedFields: string[];
  }) => Promise<void>;
  availableFields: SalesFieldConfig[];
  currentYear: number;
  currentMonth: number;
  type: 'daily' | 'monthly'; // 日次売上管理 or 月次売上管理
}

export const SalesCsvExportModal: React.FC<SalesCsvExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  availableFields,
  currentYear,
  currentMonth,
  type,
}) => {
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // 利用可能なフィールドをフィルタリング（表示されているフィールドのみ）
  const visibleFields = availableFields.filter(field => {
    if (type === 'daily') {
      return field.isVisibleInDailySales;
    } else {
      return field.isVisibleInMonthlySales;
    }
  }).sort((a, b) => a.order - b.order);

  // 初期選択：すべての表示フィールドを選択
  useEffect(() => {
    if (isOpen && visibleFields.length > 0) {
      setSelectedFields(visibleFields.map(f => f.key));
    }
  }, [isOpen, visibleFields]);

  // 年選択肢を生成
  const getYearOptions = () => {
    const currentYearValue = new Date().getFullYear();
    const years = [];
    for (let year = currentYearValue - 2; year <= currentYearValue + 1; year++) {
      years.push(year);
    }
    return years;
  };

  // フィールド選択のトグル
  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldKey)) {
        return prev.filter(key => key !== fieldKey);
      } else {
        return [...prev, fieldKey];
      }
    });
  };

  // すべて選択/すべて解除
  const toggleAllFields = () => {
    if (selectedFields.length === visibleFields.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(visibleFields.map(f => f.key));
    }
  };

  // エクスポート実行
  const handleExport = async () => {
    if (selectedFields.length === 0) {
      alert('出力する項目を1つ以上選択してください。');
      return;
    }

    // 期間の妥当性チェック
    const startDate = new Date(startYear, startMonth - 1, 1);
    const endDate = new Date(endYear, endMonth, 0);
    if (startDate > endDate) {
      alert('開始期間が終了期間より後になっています。');
      return;
    }

    setIsExporting(true);
    try {
      await onExport({
        startYear,
        startMonth,
        endYear,
        endMonth,
        selectedFields,
      });
      onClose();
    } catch (error) {
      console.error('CSV出力エラー:', error);
      alert('CSV出力に失敗しました。');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Download className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {type === 'daily' ? '日次売上データ' : '月次売上データ'} CSV出力
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 期間選択 */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">出力期間</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  開始期間
                </label>
                <div className="flex space-x-2">
                  <select
                    value={startYear}
                    onChange={(e) => setStartYear(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getYearOptions().map(year => (
                      <option key={year} value={year}>{year}年</option>
                    ))}
                  </select>
                  <select
                    value={startMonth}
                    onChange={(e) => setStartMonth(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                      <option key={month} value={month}>{month}月</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  終了期間
                </label>
                <div className="flex space-x-2">
                  <select
                    value={endYear}
                    onChange={(e) => setEndYear(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getYearOptions().map(year => (
                      <option key={year} value={year}>{year}年</option>
                    ))}
                  </select>
                  <select
                    value={endMonth}
                    onChange={(e) => setEndMonth(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                      <option key={month} value={month}>{month}月</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 項目選択 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900">出力項目</h3>
              </div>
              <button
                onClick={toggleAllFields}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedFields.length === visibleFields.length ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {visibleFields.map(field => {
                  const isSelected = selectedFields.includes(field.key);
                  return (
                    <label
                      key={field.id}
                      className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleField(field.key)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{field.label}</span>
                      {field.unit && (
                        <span className="text-xs text-gray-500">({field.unit})</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              選択中: {selectedFields.length}項目
            </p>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            disabled={isExporting}
          >
            キャンセル
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedFields.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>出力中...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>CSV出力</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

