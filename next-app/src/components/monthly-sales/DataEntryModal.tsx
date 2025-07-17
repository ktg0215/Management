import React, { useState, useEffect } from 'react';
import { BusinessType, MonthlyData, Field } from '../../types/monthly-sales';
import { X, Save, Calendar, Sparkles, AlertCircle } from 'lucide-react';

interface DataEntryModalProps {
  businessType: BusinessType;
  storeName: string;
  data: MonthlyData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MonthlyData) => void;
}

export const DataEntryModal: React.FC<DataEntryModalProps> = ({
  businessType,
  storeName,
  data,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string>('sales');

  useEffect(() => {
    if (data) {
      const initialData: Record<string, string> = {};
      businessType.fields.forEach(field => {
        const value = data.data[field.id];
        initialData[field.id] = value !== undefined ? String(value) : '';
      });
      setFormData(initialData);
      
      // Set first available category as active
      const categories = [...new Set(businessType.fields.map(f => f.category))];
      if (categories.length > 0) {
        setActiveCategory(categories[0]);
      }
    } else {
      setFormData({});
    }
    setErrors({});
  }, [data, businessType.fields]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    businessType.fields.forEach(field => {
      if (field.isRequired && (!formData[field.id] || formData[field.id].trim() === '')) {
        newErrors[field.id] = '必須項目です';
      } else if (formData[field.id] && field.type !== 'text') {
        const value = parseFloat(formData[field.id]);
        if (isNaN(value)) {
          newErrors[field.id] = '数値を入力してください';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm() || !data) return;

    const processedData: Record<string, number | string> = {};
    businessType.fields.forEach(field => {
      const value = formData[field.id];
      if (value !== undefined && value !== '') {
        if (field.type === 'text') {
          processedData[field.id] = value;
        } else {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            processedData[field.id] = numValue;
          }
        }
      }
    });

    const updatedData: MonthlyData = {
      ...data,
      data: processedData,
      updatedAt: new Date(),
    };

    onSave(updatedData);
    onClose();
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const getMonthName = (month: number): string => {
    const months = [
      '1月', '2月', '3月', '4月', '5月', '6月',
      '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    return months[month - 1] || '';
  };

  const getInputType = (field: Field): string => {
    switch (field.type) {
      case 'text':
        return 'text';
      case 'currency':
      case 'number':
      case 'count':
      case 'percentage':
        return 'number';
      default:
        return 'text';
    }
  };

  const getInputStep = (field: Field): string => {
    switch (field.type) {
      case 'currency':
        return '1';
      case 'percentage':
        return '0.1';
      case 'count':
        return '1';
      default:
        return 'any';
    }
  };

  const fieldsByCategory = businessType.fields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, Field[]>);

  const getCategoryName = (category: string): string => {
    const categoryNames: Record<string, string> = {
      sales: '売上関連',
      customer: '客数・客単価',
      profit: '利益関連',
      operations: '運営関連',
      inventory: '在庫・原価',
      marketing: 'マーケティング',
      staff: '人事・労務',
      other: 'その他'
    };
    return categoryNames[category] || category;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sales': return '💰';
      case 'customer': return '👥';
      case 'profit': return '📈';
      case 'operations': return '⚙️';
      case 'inventory': return '📦';
      case 'marketing': return '📢';
      case 'staff': return '👨‍💼';
      default: return '📊';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      sales: 'from-green-400 to-emerald-500',
      customer: 'from-blue-400 to-cyan-500',
      profit: 'from-purple-400 to-violet-500',
      operations: 'from-orange-400 to-amber-500',
      inventory: 'from-red-400 to-pink-500',
      marketing: 'from-indigo-400 to-blue-500',
      staff: 'from-yellow-400 to-orange-500',
      other: 'from-gray-400 to-slate-500'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  if (!isOpen || !data) return null;

  const categories = Object.keys(fieldsByCategory);
  const activeFields = fieldsByCategory[activeCategory] || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {storeName} - {data.year}年{getMonthName(data.month)}
                </h3>
                <p className="text-gray-600 font-medium">データ入力・編集</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 text-gray-400 hover:text-gray-600 hover:bg-white/60 rounded-xl transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-200px)]">
          {/* Category Sidebar */}
          <div className="w-80 bg-gradient-to-b from-gray-50 to-white border-r border-gray-100 p-6 overflow-y-auto">
            <h4 className="text-lg font-bold text-gray-900 mb-4">カテゴリ</h4>
            <div className="space-y-2">
              {categories.map(category => {
                const fields = fieldsByCategory[category];
                const filledFields = fields.filter(f => formData[f.id] && formData[f.id].trim() !== '').length;
                const requiredFields = fields.filter(f => f.isRequired).length;
                const hasErrors = fields.some(f => errors[f.id]);
                
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
                      activeCategory === category
                        ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-200 shadow-lg'
                        : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${getCategoryColor(category)} flex items-center justify-center text-white text-sm font-bold`}>
                        {getCategoryIcon(category)}
                      </div>
                      <span className="font-semibold text-gray-900">{getCategoryName(category)}</span>
                      {hasErrors && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{fields.length}項目</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-300"
                            style={{ width: `${fields.length > 0 ? (filledFields / fields.length) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">{filledFields}/{fields.length}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${getCategoryColor(activeCategory)} flex items-center justify-center text-white text-lg font-bold shadow-lg`}>
                  {getCategoryIcon(activeCategory)}
                </div>
                <h4 className="text-2xl font-bold text-gray-900">{getCategoryName(activeCategory)}</h4>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeFields
                  .sort((a, b) => a.order - b.order)
                  .map(field => (
                    <div key={field.id} className="space-y-3">
                      <label className="block">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-semibold text-gray-900">{field.name}</span>
                          {field.isRequired && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">必須</span>
                          )}
                          {field.unit && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                              {field.unit}
                            </span>
                          )}
                          {field.isCalculated && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full flex items-center space-x-1">
                              <Sparkles className="w-3 h-3" />
                              <span>計算</span>
                            </span>
                          )}
                        </div>
                      </label>
                      <input
                        type={getInputType(field)}
                        step={getInputStep(field)}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                          errors[field.id]
                            ? 'border-red-300 bg-red-50 focus:ring-red-500'
                            : field.isCalculated
                            ? 'border-orange-200 bg-orange-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        placeholder={field.type === 'text' ? 'テキストを入力' : '数値を入力'}
                        disabled={field.isCalculated}
                      />
                      {errors[field.id] && (
                        <div className="flex items-center space-x-2 text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">{errors[field.id]}</span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-t border-gray-100">
          <div className="flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 font-semibold"
            >
              <Save className="w-5 h-5" />
              <span>保存</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 