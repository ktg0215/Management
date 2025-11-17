'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { SalesFieldConfig } from '@/types/sales-field-config';

interface DynamicSalesFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  initialData?: Record<string, any>;
  storeId: string;
  year: number;
  month: number;
  fields: SalesFieldConfig[];
}

export const DynamicSalesForm: React.FC<DynamicSalesFormProps> = ({
  isOpen,
  onClose,
  selectedDate,
  initialData,
  storeId,
  year,
  month,
  fields,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      const newFormData: Record<string, any> = {};
      fields.forEach(field => {
        if (field.isEditable || field.isCalculated) {
          newFormData[field.key] = initialData?.[field.key] || '';
        }
      });
      setFormData(newFormData);
    }
  }, [isOpen, initialData, fields]);

  // Auto-calculate fields
  useEffect(() => {
    const updatedData = { ...formData };
    let hasChanges = false;

    fields.forEach(field => {
      if (field.isCalculated) {
        const calculatedValue = calculateFieldValue(field.key, updatedData);
        if (calculatedValue !== undefined && calculatedValue !== updatedData[field.key]) {
          updatedData[field.key] = calculatedValue;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setFormData(updatedData);
    }
  }, [formData, fields]);

  const calculateFieldValue = (fieldKey: string, data: Record<string, any>): any => {
    // 基本の利益計算
    if (fieldKey === 'profit') {
      const revenue = parseFloat(data.revenue) || 0;
      const cost = parseFloat(data.cost) || 0;
      return revenue - cost;
    }

    // カフェ利益計算
    if (fieldKey === 'cafeProfit') {
      const cafeRevenue = parseFloat(data.cafeRevenue) || 0;
      const cafeCost = parseFloat(data.cafeCost) || 0;
      return cafeRevenue - cafeCost;
    }

    // 総売上計算（EDW業態など）
    if (fieldKey === 'totalSales') {
      const storeNetSales = parseFloat(data.storeNetSales) || 0;
      const edwNetSales = parseFloat(data.edwNetSales) || 0;
      const ohbNetSales = parseFloat(data.ohbNetSales) || 0;
      return storeNetSales + edwNetSales + ohbNetSales;
    }

    // 客単価計算
    if (fieldKey === 'customerUnitPrice') {
      const totalSales = parseFloat(data.totalSales) || parseFloat(data.revenue) || 0;
      const totalCustomers = parseFloat(data.totalCustomers) || 0;
      return totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0;
    }

    // 組単価計算
    if (fieldKey === 'groupUnitPrice') {
      const totalSales = parseFloat(data.totalSales) || parseFloat(data.revenue) || 0;
      const totalGroups = parseFloat(data.totalGroups) || 0;
      return totalGroups > 0 ? Math.round(totalSales / totalGroups) : 0;
    }

    // 人件費率計算
    if (fieldKey === 'laborCostRate') {
      const laborCostAmount = parseFloat(data.laborCostAmount) || 0;
      const totalSales = parseFloat(data.totalSales) || parseFloat(data.revenue) || 0;
      return totalSales > 0 ? ((laborCostAmount / totalSales) * 100).toFixed(2) : 0;
    }

    // 人時売上高計算
    if (fieldKey === 'salesPerLaborHour') {
      const totalSales = parseFloat(data.totalSales) || parseFloat(data.revenue) || 0;
      const employeeHours = parseFloat(data.employeeHours) || 0;
      const asHours = parseFloat(data.asHours) || 0;
      const totalHours = employeeHours + asHours;
      return totalHours > 0 ? Math.round(totalSales / totalHours) : 0;
    }

    // EDW生産性計算
    if (fieldKey === 'edwProductivity') {
      const edwNetSales = parseFloat(data.edwNetSales) || 0;
      const employeeHours = parseFloat(data.employeeHours) || 0;
      const asHours = parseFloat(data.asHours) || 0;
      const totalHours = employeeHours + asHours;
      return totalHours > 0 ? (edwNetSales / totalHours).toFixed(1) : 0;
    }

    // OHB生産性計算
    if (fieldKey === 'ohbProductivity') {
      const ohbNetSales = parseFloat(data.ohbNetSales) || 0;
      const ohbTotalHours = parseFloat(data.ohbTotalHours) || 0;
      return ohbTotalHours > 0 ? (ohbNetSales / ohbTotalHours).toFixed(1) : 0;
    }

    return undefined;
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Convert form data to numbers where appropriate
      const processedData: Record<string, any> = {};
      fields.forEach(field => {
        const value = formData[field.key];
        if (value !== '' && value !== undefined) {
          if (field.type === 'currency' || field.type === 'number' || field.type === 'count') {
            processedData[field.key] = parseFloat(value) || 0;
          } else if (field.type === 'percentage') {
            processedData[field.key] = parseFloat(value) || 0;
          } else {
            processedData[field.key] = value;
          }
        }
      });

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
          data: processedData,
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

  // Get visible and editable fields
  const visibleEditableFields = fields.filter(
    field => (field.isVisible && field.isEditable) || (field.isVisible && field.isCalculated)
  );

  // Group fields by category
  const fieldsByCategory = visibleEditableFields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, SalesFieldConfig[]>);

  const categoryLabels: Record<string, string> = {
    basic: '基本情報',
    sales: '売上',
    cost: '原価',
    profit: '利益',
    customer: '客数・組数',
    unit_price: '単価',
    labor: '人件費',
    productivity: '生産性',
    other: 'その他'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            売上データ入力 - {selectedDate}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-8">
            {Object.entries(fieldsByCategory).map(([category, categoryFields]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                  {categoryLabels[category] || category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryFields.map(field => (
                    <div key={field.id}>
                      <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                        {field.unit && <span className="text-xs text-gray-500 ml-1">({field.unit})</span>}
                        {field.isCalculated && <span className="text-xs text-blue-600 ml-2">(自動計算)</span>}
                      </label>
                      <input
                        type={field.type === 'text' ? 'text' : 'number'}
                        id={field.key}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        readOnly={field.isCalculated}
                        step={field.type === 'percentage' ? '0.01' : field.type === 'number' ? '0.1' : '1'}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          field.isCalculated ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? '保存中...' : '保存'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
