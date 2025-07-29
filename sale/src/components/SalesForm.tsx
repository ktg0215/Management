import React, { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';
import { SalesFormData, DailySalesData } from '../types/sales';

interface SalesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SalesFormData) => void;
  selectedDate: string;
  initialData?: DailySalesData;
}

const SalesForm: React.FC<SalesFormProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  initialData,
}) => {
  const [formData, setFormData] = useState<SalesFormData>({
    collectionManager: '',
    storeNetSales: 0,
    ohbNetSales: 0,
    totalGroups: 0,
    totalCustomers: 0,
    dinnerSales: 0,
    dinnerCustomers: 0,
    dinnerGroups: 0,
    ohbCustomers: 0,
    employeeHours: 0,
    asHours: 0,
    ohbTotalHours: 0,
    laborCostAmount: 0,
    voidCount: 0,
    voidAmount: 0,
    cashDifference: 0,
  });

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        collectionManager: initialData.collectionManager || '',
        storeNetSales: initialData.storeNetSales || 0,
        ohbNetSales: initialData.ohbNetSales || 0,
        totalGroups: initialData.totalGroups || 0,
        totalCustomers: initialData.totalCustomers || 0,
        dinnerSales: initialData.dinnerSales || 0,
        dinnerCustomers: initialData.dinnerCustomers || 0,
        dinnerGroups: initialData.dinnerGroups || 0,
        ohbCustomers: initialData.ohbCustomers || 0,
        employeeHours: initialData.employeeHours || 0,
        asHours: initialData.asHours || 0,
        ohbTotalHours: initialData.ohbTotalHours || 0,
        laborCostAmount: initialData.laborCostAmount || 0,
        voidCount: initialData.voidCount || 0,
        voidAmount: initialData.voidAmount || 0,
        cashDifference: initialData.cashDifference || 0,
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleInputChange = (field: keyof SalesFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (!isOpen) return null;

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = dayNames[date.getDay()];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日（${dayOfWeek}）`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            売上データ入力 - {formatDateDisplay(selectedDate)}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 売上データ */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-base font-medium text-gray-900 mb-4">売上データ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  店舗純売上
                </label>
                <input
                  ref={firstInputRef}
                  type="number"
                  value={formData.storeNetSales}
                  onChange={(e) => handleInputChange('storeNetSales', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OHB純売上
                </label>
                <input
                  type="number"
                  value={formData.ohbNetSales}
                  onChange={(e) => handleInputChange('ohbNetSales', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  組数（計）
                </label>
                <input
                  type="number"
                  value={formData.totalGroups}
                  onChange={(e) => handleInputChange('totalGroups', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客数（計）
                </label>
                <input
                  type="number"
                  value={formData.totalCustomers}
                  onChange={(e) => handleInputChange('totalCustomers', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ディナー売上
                </label>
                <input
                  type="number"
                  value={formData.dinnerSales}
                  onChange={(e) => handleInputChange('dinnerSales', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ディナー客数
                </label>
                <input
                  type="number"
                  value={formData.dinnerCustomers}
                  onChange={(e) => handleInputChange('dinnerCustomers', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ディナー組数
                </label>
                <input
                  type="number"
                  value={formData.dinnerGroups}
                  onChange={(e) => handleInputChange('dinnerGroups', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OHB客数
                </label>
                <input
                  type="number"
                  value={formData.ohbCustomers}
                  onChange={(e) => handleInputChange('ohbCustomers', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 勤怠データ */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-base font-medium text-gray-900 mb-4">勤怠データ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  社員時間
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.employeeHours}
                  onChange={(e) => handleInputChange('employeeHours', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AS時間
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.asHours}
                  onChange={(e) => handleInputChange('asHours', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OHB総時間
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.ohbTotalHours}
                  onChange={(e) => handleInputChange('ohbTotalHours', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  人件費額
                </label>
                <input
                  type="number"
                  value={formData.laborCostAmount}
                  onChange={(e) => handleInputChange('laborCostAmount', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* その他 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-base font-medium text-gray-900 mb-4">その他</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VOID件数
                </label>
                <input
                  type="number"
                  value={formData.voidCount}
                  onChange={(e) => handleInputChange('voidCount', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VOID金額
                </label>
                <input
                  type="number"
                  value={formData.voidAmount}
                  onChange={(e) => handleInputChange('voidAmount', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  売上金過不足
                </label>
                <input
                  type="number"
                  value={formData.cashDifference}
                  onChange={(e) => handleInputChange('cashDifference', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  集計担当者
                </label>
                <input
                  type="text"
                  value={formData.collectionManager}
                  onChange={(e) => handleInputChange('collectionManager', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-2 transition-colors duration-200"
            >
              <Save className="w-4 h-4" />
              <span>保存</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesForm;