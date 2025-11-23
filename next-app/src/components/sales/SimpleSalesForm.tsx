import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SimpleSalesFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  initialData?: Record<string, any>;
  storeId: string;
  year: number;
  month: number;
}

// 入力可能なフィールド定義
const EDITABLE_FIELDS = [
  // 目標・売上
  { key: 'salesTarget', label: '売上目標', unit: '円', group: '目標・売上' },
  { key: 'netSales', label: '店舗純売上', unit: '円', group: '目標・売上' },
  { key: 'edwNetSales', label: 'EDW純売上', unit: '円', group: '目標・売上' },
  { key: 'ohbNetSales', label: 'OHB純売上', unit: '円', group: '目標・売上' },

  // 客数・組数
  { key: 'totalGroups', label: '組数（計）', unit: '組', group: '客数・組数' },
  { key: 'totalCustomers', label: '客数（計）', unit: '人', group: '客数・組数' },

  // 人件費関連
  { key: 'katougi', label: '加藤木', unit: '時間', group: '人件費', isDecimal: true },
  { key: 'ishimori', label: '石森', unit: '時間', group: '人件費', isDecimal: true },
  { key: 'osawa', label: '大澤', unit: '時間', group: '人件費', isDecimal: true },
  { key: 'washizuka', label: '鷲塚', unit: '時間', group: '人件費', isDecimal: true },
  { key: 'employeeHours', label: '社員時間', unit: '時間', group: '人件費', isDecimal: true },
  { key: 'asHours', label: 'AS時間', unit: '時間', group: '人件費', isDecimal: true },
  { key: 'laborCost', label: '人件費額', unit: '円', group: '人件費' },

  // EDW営業明細
  { key: 'lunchSales', label: 'L：売上', unit: '円', group: 'EDW営業明細' },
  { key: 'dinnerSales', label: 'D：売上', unit: '円', group: 'EDW営業明細' },
  { key: 'lunchCustomers', label: 'L：客数', unit: '人', group: 'EDW営業明細' },
  { key: 'dinnerCustomers', label: 'D：客数', unit: '人', group: 'EDW営業明細' },
  { key: 'lunchGroups', label: 'L：組数', unit: '組', group: 'EDW営業明細' },
  { key: 'dinnerGroups', label: 'D：組数', unit: '組', group: 'EDW営業明細' },

  // OHB
  { key: 'ohbSales', label: 'OHB売上', unit: '円', group: 'OHB' },
  { key: 'ohbCustomers', label: 'OHB客数', unit: '人', group: 'OHB' },
  { key: 'ohbGroups', label: 'OHB組数', unit: '組', group: 'OHB' },

  // VOID関連
  { key: 'voidCount', label: 'VOID件数', unit: '件', group: 'VOID' },
  { key: 'voidAmount', label: 'VOID金額', unit: '円', group: 'VOID' },
  { key: 'salesDiscrepancy', label: '売上金過不足', unit: '円', group: 'VOID' },

  // 生産性
  { key: 'totalHours', label: '総時間', unit: '時間', group: '生産性', isDecimal: true },
  { key: 'edwBaitHours', label: 'EDWバイト時間', unit: '時間', group: '生産性', isDecimal: true },
  { key: 'ohbBaitHours', label: 'OHBバイト時間', unit: '時間', group: '生産性', isDecimal: true },

  // OHB予約
  { key: 'reservationCount', label: '予約件数', unit: '件', group: 'OHB予約' },
  { key: 'plain', label: 'プレーン', unit: '個', group: 'OHB予約' },
  { key: 'junsei', label: '純生', unit: '個', group: 'OHB予約' },
  { key: 'seasonal', label: '季節', unit: '個', group: 'OHB予約' },

  // アンケート
  { key: 'surveyCount', label: '取得枚数', unit: '枚', group: 'アンケート' },
];

export const SimpleSalesForm: React.FC<SimpleSalesFormProps> = ({
  isOpen,
  onClose,
  selectedDate,
  initialData,
  storeId,
  year,
  month,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const newFormData: Record<string, string> = {};
      EDITABLE_FIELDS.forEach(field => {
        const value = initialData?.[field.key];
        newFormData[field.key] = value !== undefined && value !== null ? String(value) : '';
      });
      setFormData(newFormData);
    }
  }, [isOpen, initialData]);

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // フォームデータを数値に変換
      const data: Record<string, any> = {};
      EDITABLE_FIELDS.forEach(field => {
        const value = formData[field.key];
        if (value !== '' && value !== undefined) {
          data[field.key] = field.isDecimal ? parseFloat(value) : parseInt(value, 10);
        }
      });

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/bb/api/sales/daily', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          year,
          month,
          storeId,
          date: selectedDate,
          data,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('保存しました');
        onClose();
        window.location.reload();
      } else {
        alert('保存に失敗しました: ' + (result.error || '不明なエラー'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // グループ別にフィールドを整理
  const fieldsByGroup: Record<string, typeof EDITABLE_FIELDS> = {};
  EDITABLE_FIELDS.forEach(field => {
    if (!fieldsByGroup[field.group]) {
      fieldsByGroup[field.group] = [];
    }
    fieldsByGroup[field.group].push(field);
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            売上データ入力 - {selectedDate}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          {Object.entries(fieldsByGroup).map(([groupName, fields]) => (
            <div key={groupName} className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                {groupName}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {fields.map(field => (
                  <div key={field.key}>
                    <label htmlFor={field.key} className="block text-xs font-medium text-gray-600 mb-1">
                      {field.label}
                      <span className="text-gray-400 ml-1">({field.unit})</span>
                    </label>
                    <input
                      type="number"
                      id={field.key}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      step={field.isDecimal ? '0.1' : '1'}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 自動計算項目の説明 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
            <p className="font-medium mb-1">自動計算項目（入力不要）：</p>
            <p>目標累計、対目標比、前年比、客単価、組単価、人件費率、生産性、取得率など</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
