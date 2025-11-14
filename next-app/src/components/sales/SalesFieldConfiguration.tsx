import React, { useState } from 'react';
import {
  SalesFieldConfig,
  SALES_FIELD_CATEGORIES,
  SalesFieldCategory
} from '@/types/sales-field-config';
import {
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp
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
        <h3 className="font-medium text-blue-900">
          {businessTypeName} の売上管理表示項目設定
        </h3>
        <p className="text-sm text-blue-700 mt-1">
          各項目の表示/非表示、編集可否、表示順序を設定できます
        </p>
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
                      className={`p-4 ${!field.isVisible ? 'bg-gray-50' : 'bg-white'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          {/* Drag handle */}
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => moveField(field.id, 'up')}
                              disabled={index === 0}
                              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="上に移動"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => moveField(field.id, 'down')}
                              disabled={index === categoryFields.length - 1}
                              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="下に移動"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>

                          <GripVertical className="h-5 w-5 text-gray-400" />

                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={`font-medium ${!field.isVisible ? 'text-gray-400' : 'text-gray-900'}`}>
                                {field.label}
                              </span>
                              {field.unit && (
                                <span className="text-sm text-gray-500">({field.unit})</span>
                              )}
                              {field.isCalculated && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                  自動計算
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              キー: <code className="bg-gray-100 px-1 rounded">{field.key}</code>
                              {' '}| タイプ: {field.type}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Visibility toggle */}
                          <button
                            onClick={() => toggleFieldVisibility(field.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              field.isVisible
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={field.isVisible ? '表示中' : '非表示'}
                          >
                            {field.isVisible ? (
                              <Eye className="h-5 w-5" />
                            ) : (
                              <EyeOff className="h-5 w-5" />
                            )}
                          </button>

                          {/* Editable toggle */}
                          <button
                            onClick={() => toggleFieldEditable(field.id)}
                            disabled={field.isCalculated}
                            className={`p-2 rounded-lg transition-colors ${
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
                              <Unlock className="h-5 w-5" />
                            ) : (
                              <Lock className="h-5 w-5" />
                            )}
                          </button>
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
    </div>
  );
};
