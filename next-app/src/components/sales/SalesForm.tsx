import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Calendar, TrendingUp } from 'lucide-react';
import { EDW_SALES_FIELDS, EDWDailySalesData } from '../../types/sales';

interface SalesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EDWDailySalesData) => void;
  selectedDate: string;
  initialData?: EDWDailySalesData;
}

export const SalesForm: React.FC<SalesFormProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  initialData,
}) => {
  const [formData, setFormData] = useState<EDWDailySalesData>({});

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // 初期データがない場合は空のオブジェクトで初期化
      setFormData({});
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

  const handleInputChange = (field: string, value: string | number) => {
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

  // フィールドをカテゴリ別にグループ化
  const groupedFields = EDW_SALES_FIELDS.reduce((groups, field) => {
    const category = field.category || 'その他';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(field);
    return groups;
  }, {} as Record<string, typeof EDW_SALES_FIELDS>);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white/20 rounded-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  売上データ入力
                </h2>
                <div className="flex items-center space-x-2 text-blue-100">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">{formatDateDisplay(selectedDate)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-8">
            {Object.entries(groupedFields).map(([category, fields]) => (
              <div key={category} className="mb-8 last:mb-0">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {category}
                  </h3>
                  <div className="h-px bg-gradient-to-r from-blue-200 to-transparent"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {fields.map((field, index) => {
                    const isFirstField = index === 0 && category === Object.keys(groupedFields)[0];
                    const isAutoField = field.type === 'auto';
                    const value = formData[field.key as keyof EDWDailySalesData];
                    
                    // 自動計算項目は入力フォームでは非表示
                    if (isAutoField) {
                      return null;
                    }
                    
                    return (
                      <div key={field.key} className="group">
                        <label className="block text-sm font-medium text-gray-700 mb-3 group-hover:text-blue-600 transition-colors">
                          {field.label}
                        </label>
                        
                        <div className="relative">
                          <input
                            ref={isFirstField ? firstInputRef : undefined}
                            type={typeof value === 'number' ? 'number' : 'text'}
                            step={typeof value === 'number' ? '0.01' : undefined}
                            value={value || ''}
                            onChange={(e) => {
                              const inputValue = e.target.type === 'number' ? 
                                (e.target.value === '' ? undefined : parseFloat(e.target.value)) : 
                                e.target.value;
                              handleInputChange(field.key, inputValue);
                            }}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400 placeholder-gray-400 text-gray-900 font-medium"
                            placeholder={`${field.label}を入力`}
                            style={{
                              minWidth: '120px',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-6 rounded-b-2xl border-t border-gray-200">
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
            >
              キャンセル
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Save className="h-4 w-4" />
              <span>保存</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 