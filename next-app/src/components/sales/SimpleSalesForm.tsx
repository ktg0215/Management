import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SimpleSalesFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  initialData?: {
    revenue?: number;
    cost?: number;
    profit?: number;
  };
  storeId: string;
  year: number;
  month: number;
}

export const SimpleSalesForm: React.FC<SimpleSalesFormProps> = ({
  isOpen,
  onClose,
  selectedDate,
  initialData,
  storeId,
  year,
  month,
}) => {
  const [revenue, setRevenue] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [profit, setProfit] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && initialData) {
      setRevenue(initialData.revenue?.toString() || '');
      setCost(initialData.cost?.toString() || '');
      setProfit(initialData.profit?.toString() || '');
    } else if (isOpen) {
      setRevenue('');
      setCost('');
      setProfit('');
    }
  }, [isOpen, initialData]);

  // Auto-calculate profit when revenue or cost changes
  useEffect(() => {
    const revenueNum = parseFloat(revenue) || 0;
    const costNum = parseFloat(cost) || 0;
    const calculatedProfit = revenueNum - costNum;
    if (!isNaN(calculatedProfit)) {
      setProfit(calculatedProfit.toString());
    }
  }, [revenue, cost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/sales/daily', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year,
          month,
          storeId,
          date: selectedDate,
          data: {
            revenue: parseFloat(revenue) || 0,
            cost: parseFloat(cost) || 0,
            profit: parseFloat(profit) || 0,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('保存しました');
        onClose();
        // Refresh the page to show updated data
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
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
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="revenue" className="block text-sm font-medium text-gray-700 mb-1">
              売上
            </label>
            <input
              type="number"
              id="revenue"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-1">
              原価
            </label>
            <input
              type="number"
              id="cost"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label htmlFor="profit" className="block text-sm font-medium text-gray-700 mb-1">
              利益 <span className="text-xs text-gray-500">(自動計算)</span>
            </label>
            <input
              type="number"
              id="profit"
              value={profit}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              placeholder="0"
            />
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
