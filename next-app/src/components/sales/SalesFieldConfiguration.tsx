import React, { useState } from 'react';
import {
  SalesFieldConfig,
  SALES_FIELD_CATEGORIES,
  SalesFieldCategory,
  SalesFieldType
} from '@/types/sales-field-config';
import {
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
  Save
} from 'lucide-react';

interface SalesFieldConfigurationProps {
  fields: SalesFieldConfig[];
  onFieldsChange: (fields: SalesFieldConfig[]) => void;
  businessTypeName: string;
}

export const SalesFieldConfiguration: React.FC<SalesFieldConfigurationProps> = ({
  fields,
  onFieldsChange,
  businessTypeName,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<SalesFieldCategory>>(
    new Set(Object.keys(SALES_FIELD_CATEGORIES) as SalesFieldCategory[])
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newField, setNewField] = useState<{
    label: string;
    key: string;
    category: SalesFieldCategory;
    type: SalesFieldType;
    unit: string;
    isCalculated: boolean;
  }>({
    label: '',
    key: '',
    category: 'other',
    type: 'number',
    unit: '',
    isCalculated: false,
  });

  const handleAddField = () => {
    if (!newField.label.trim() || !newField.key.trim()) {
      alert('項目名とキーは必須です');
      return;
    }

    // キーの重複チェック
    if (fields.some(f => f.key === newField.key)) {
      alert('このキーは既に使用されています');
      return;
    }

    const field: SalesFieldConfig = {
      id: `custom-${Date.now()}`,
      key: newField.key,
      label: newField.label,
      category: newField.category,
      type: newField.type,
      unit: newField.unit || undefined,
      fieldSource: 'linked',
      isVisible: true,
      isVisibleInDailySales: true,
      isVisibleInMonthlySales: true,
      isEditable: !newField.isCalculated,
      isCalculated: newField.isCalculated,
      aggregationMethod: newField.isCalculated ? 'average' : 'sum',
      order: fields.length + 1,
    };

    onFieldsChange([...fields, field]);
    setShowAddModal(false);
    setNewField({
      label: '',
      key: '',
      category: 'other',
      type: 'number',
      unit: '',
      isCalculated: false,
    });
  };

  const handleDeleteField = (fieldId: string) => {
    if (window.confirm('この項目を削除しますか？')) {
      const updatedFields = fields.filter(f => f.id !== fieldId);
      // Reorder remaining fields
      updatedFields.forEach((field, index) => {
        field.order = index + 1;
      });
      onFieldsChange(updatedFields);
    }
  };

  const toggleCategory = (category: SalesFieldCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleFieldVisibility = (fieldId: string) => {
    const updatedFields = fields.map(field =>
      field.id === fieldId
        ? { ...field, isVisible: !field.isVisible }
        : field
    );
    onFieldsChange(updatedFields);
  };

  const toggleFieldEditable = (fieldId: string) => {
    const updatedFields = fields.map(field =>
      field.id === fieldId && !field.isCalculated
        ? { ...field, isEditable: !field.isEditable }
        : field
    );
    onFieldsChange(updatedFields);
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return;

    const targetIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    const newFields = [...fields];
    [newFields[fieldIndex], newFields[targetIndex]] = [newFields[targetIndex], newFields[fieldIndex]];

    // Update order values
    newFields.forEach((field, index) => {
      field.order = index + 1;
    });

    onFieldsChange(newFields);
  };

  // Group fields by category
  const fieldsByCategory = fields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<SalesFieldCategory, SalesFieldConfig[]>);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-blue-900">
              {businessTypeName} の売上管理表示項目設定
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              各項目の表示/非表示、編集可否、表示順序を設定できます
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            項目を追加
          </button>
        </div>
      </div>

      {Object.entries(SALES_FIELD_CATEGORIES).map(([category, categoryLabel]) => {
        const categoryFields = fieldsByCategory[category as SalesFieldCategory] || [];
        if (categoryFields.length === 0) return null;

        const isExpanded = expandedCategories.has(category as SalesFieldCategory);

        return (
          <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(category as SalesFieldCategory)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{categoryLabel}</span>
                <span className="text-sm text-gray-500">({categoryFields.length}項目)</span>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {isExpanded && (
              <div className="divide-y divide-gray-200">
                {categoryFields
                  .sort((a, b) => a.order - b.order)
                  .map((field, index) => (
                    <div
                      key={field.id}
                      className={`p-3 ${!field.isVisible ? 'bg-gray-50' : 'bg-white'} border-b border-gray-100`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* 左側: ドラッグハンドルと項目情報 */}
                        <div className="flex items-start space-x-2 flex-1 min-w-0">
                          {/* Drag handle */}
                          <div className="flex flex-col space-y-0.5 pt-0.5">
                            <button
                              onClick={() => moveField(field.id, 'up')}
                              disabled={index === 0}
                              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="上に移動"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => moveField(field.id, 'down')}
                              disabled={index === categoryFields.length - 1}
                              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="下に移動"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <GripVertical className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />

                          {/* 項目情報を2行に分割 */}
                          <div className="flex-1 min-w-0">
                            {/* 1行目: 項目名とバッジ */}
                            <div className="flex items-center flex-wrap gap-1.5 mb-1">
                              <span className={`font-medium text-sm ${!field.isVisible ? 'text-gray-400' : 'text-gray-900'}`}>
                                {field.label}
                              </span>
                              {field.unit && (
                                <span className="text-xs text-gray-500">({field.unit})</span>
                              )}
                              {field.isCalculated && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full whitespace-nowrap">
                                  自動計算
                                </span>
                              )}
                            </div>
                            {/* 2行目: キーとタイプ */}
                            <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                              <span>
                                キー: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{field.key}</code>
                              </span>
                              <span className="text-gray-300">|</span>
                              <span>タイプ: {field.type}</span>
                            </div>
                          </div>
                        </div>

                        {/* 右側: アクションボタン */}
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          {/* Visibility toggle */}
                          <button
                            onClick={() => toggleFieldVisibility(field.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              field.isVisible
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={field.isVisible ? '表示中' : '非表示'}
                          >
                            {field.isVisible ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>

                          {/* Editable toggle */}
                          <button
                            onClick={() => toggleFieldEditable(field.id)}
                            disabled={field.isCalculated}
                            className={`p-1.5 rounded-lg transition-colors ${
                              field.isCalculated
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                : field.isEditable
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={
                              field.isCalculated
                                ? '自動計算項目は編集不可'
                                : field.isEditable
                                ? '編集可能'
                                : '編集不可'
                            }
                          >
                            {field.isEditable ? (
                              <Unlock className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </button>

                          {/* Delete button (only for custom fields) */}
                          {field.id.startsWith('custom-') && (
                            <button
                              onClick={() => handleDeleteField(field.id)}
                              className="p-1.5 rounded-lg transition-colors bg-red-100 text-red-600 hover:bg-red-200"
                              title="項目を削除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">凡例</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center space-x-2">
            <Eye className="h-4 w-4 text-green-700" />
            <span>表示中</span>
          </div>
          <div className="flex items-center space-x-2">
            <EyeOff className="h-4 w-4 text-gray-400" />
            <span>非表示</span>
          </div>
          <div className="flex items-center space-x-2">
            <Unlock className="h-4 w-4 text-blue-700" />
            <span>編集可能</span>
          </div>
          <div className="flex items-center space-x-2">
            <Lock className="h-4 w-4 text-gray-400" />
            <span>編集不可</span>
          </div>
        </div>
      </div>

      {/* Add Field Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">新しい項目を追加</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  項目名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 税抜売上"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  キー <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newField.key}
                  onChange={(e) => setNewField({ ...newField, key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: net_sales"
                />
                <p className="text-xs text-gray-500 mt-1">
                  英数字とアンダースコアのみ使用可能
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  カテゴリ
                </label>
                <select
                  value={newField.category}
                  onChange={(e) => setNewField({ ...newField, category: e.target.value as SalesFieldCategory })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(SALES_FIELD_CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイプ
                </label>
                <select
                  value={newField.type}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value as SalesFieldType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">テキスト</option>
                  <option value="number">数値</option>
                  <option value="currency">金額</option>
                  <option value="percentage">パーセント</option>
                  <option value="count">件数</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  単位（任意）
                </label>
                <input
                  type="text"
                  value={newField.unit}
                  onChange={(e) => setNewField({ ...newField, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 円, %, 人"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isCalculated"
                  checked={newField.isCalculated}
                  onChange={(e) => setNewField({ ...newField, isCalculated: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isCalculated" className="ml-2 text-sm text-gray-700">
                  自動計算項目
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddField}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4 mr-2" />
                追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
