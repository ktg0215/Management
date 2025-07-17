import React, { useState } from 'react';
import { Field, FieldCategory, FieldType, FIELD_CATEGORIES } from '../../types/monthly-sales';
import { Plus, Edit2, Trash2, Save, X, Settings, Sparkles, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FieldConfigurationProps {
  fields: Field[];
  onFieldsChange: (fields: Field[]) => void;
}

interface SortableFieldItemProps {
  field: Field;
  isEditing: boolean;
  onEdit: (field: Field) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (fieldId: string) => void;
  editingField: Field | null;
  setEditingField: (field: Field | null) => void;
}

const SortableFieldItem: React.FC<SortableFieldItemProps> = ({
  field,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  editingField,
  setEditingField,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTypeDisplayName = (type: FieldType) => {
    const typeNames = {
      number: '数値',
      currency: '通貨',
      percentage: '%',
      count: '件数',
      text: 'テキスト'
    };
    return typeNames[type] || type;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-lg ${
        isEditing 
          ? 'border-blue-300 bg-blue-50/50 shadow-lg' 
          : 'border-gray-200 bg-white/80 hover:border-gray-300'
      }`}
    >
      {isEditing ? (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">項目名</label>
              <input
                type="text"
                value={editingField?.name || ''}
                onChange={(e) =>
                  setEditingField(editingField ? { ...editingField, name: e.target.value } : null)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="項目名を入力"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
              <select
                value={editingField?.category || 'other'}
                onChange={(e) =>
                  setEditingField(editingField ? {
                    ...editingField,
                    category: e.target.value as FieldCategory,
                  } : null)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                {Object.entries(FIELD_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">データ型</label>
              <select
                value={editingField?.type || 'number'}
                onChange={(e) =>
                  setEditingField(editingField ? {
                    ...editingField,
                    type: e.target.value as FieldType,
                  } : null)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="number">数値</option>
                <option value="currency">通貨</option>
                <option value="percentage">パーセンテージ</option>
                <option value="count">件数</option>
                <option value="text">テキスト</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">単位</label>
              <input
                type="text"
                value={editingField?.unit || ''}
                onChange={(e) =>
                  setEditingField(editingField ? { ...editingField, unit: e.target.value } : null)
                }
                placeholder="単位（オプション）"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
          <div className="flex items-center space-x-6 mb-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingField?.isRequired || false}
                onChange={(e) =>
                  setEditingField(editingField ? { ...editingField, isRequired: e.target.checked } : null)
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">必須項目</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingField?.isCalculated || false}
                onChange={(e) =>
                  setEditingField(editingField ? { ...editingField, isCalculated: e.target.checked } : null)
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">計算項目</span>
            </label>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onSave}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Save className="w-4 h-4 mr-2" />
              保存
            </button>
            <button
              onClick={onCancel}
              className="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
            >
              <X className="w-4 h-4 mr-2" />
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <GripVertical className="w-5 h-5" />
              </div>

              {/* Field Info - Horizontal Layout */}
              <div className="flex items-center space-x-6 flex-1">
                <div className="font-semibold text-gray-900 min-w-0 flex-1">
                  {field.name}
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                    {getTypeDisplayName(field.type)}
                  </span>
                  
                  {field.unit && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                      {field.unit}
                    </span>
                  )}
                  
                  {field.isRequired && (
                    <span className="px-3 py-1 bg-red-100 text-red-600 text-sm font-medium rounded-full">
                      必須
                    </span>
                  )}
                  
                  {field.isCalculated && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-600 text-sm font-medium rounded-full flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>計算</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={() => onEdit(field)}
                className="p-3 text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200 hover:scale-110"
                title="編集"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`項目「${field.name}」を削除しますか？`)) {
                    onDelete(field.id);
                  }
                }}
                className="p-3 text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200 hover:scale-110"
                title="削除"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const FieldConfiguration: React.FC<FieldConfigurationProps> = ({
  fields,
  onFieldsChange,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [newField, setNewField] = useState<Omit<Field, 'id'>>({
    name: '',
    category: 'other',
    type: 'number',
    isRequired: false,
    isCalculated: false,
    order: fields.length + 1,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over.id);

      const newFields = arrayMove(fields, oldIndex, newIndex).map((field, index) => ({
        ...field,
        order: index + 1,
      }));

      onFieldsChange(newFields);
    }
  };

  const handleSaveNewField = () => {
    if (newField.name.trim()) {
      const field: Field = {
        ...newField,
        id: Date.now().toString(),
        name: newField.name.trim(),
      };
      onFieldsChange([...fields, field]);
      setNewField({
        name: '',
        category: 'other',
        type: 'number',
        isRequired: false,
        isCalculated: false,
        order: fields.length + 2,
      });
      setIsAdding(false);
    }
  };

  const handleSaveEditField = () => {
    if (editingField && editingField.name.trim()) {
      onFieldsChange(
        fields.map((f) => (f.id === editingField.id ? editingField : f))
      );
      setEditingField(null);
    }
  };

  const handleDeleteField = (fieldId: string) => {
    onFieldsChange(fields.filter((f) => f.id !== fieldId));
  };

  const sortedFields = fields.sort((a, b) => a.order - b.order);

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-8 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">項目設定</h3>
              <p className="text-gray-600 font-medium">Field Configuration</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            <span className="font-semibold">項目追加</span>
          </button>
        </div>
      </div>

      {/* Fields List */}
      <div className="p-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sortedFields.map((field) => (
                <SortableFieldItem
                  key={field.id}
                  field={field}
                  isEditing={editingField?.id === field.id}
                  onEdit={setEditingField}
                  onSave={handleSaveEditField}
                  onCancel={() => setEditingField(null)}
                  onDelete={handleDeleteField}
                  editingField={editingField}
                  setEditingField={setEditingField}
                />
              ))}

              {isAdding && (
                <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-6">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">項目名</label>
                      <input
                        type="text"
                        value={newField.name}
                        onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                        placeholder="項目名を入力"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
                      <select
                        value={newField.category}
                        onChange={(e) =>
                          setNewField({ ...newField, category: e.target.value as FieldCategory })
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      >
                        {Object.entries(FIELD_CATEGORIES).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">データ型</label>
                      <select
                        value={newField.type}
                        onChange={(e) =>
                          setNewField({ ...newField, type: e.target.value as FieldType })
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      >
                        <option value="number">数値</option>
                        <option value="currency">通貨</option>
                        <option value="percentage">パーセンテージ</option>
                        <option value="count">件数</option>
                        <option value="text">テキスト</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">単位</label>
                      <input
                        type="text"
                        value={newField.unit || ''}
                        onChange={(e) => setNewField({ ...newField, unit: e.target.value })}
                        placeholder="単位（オプション）"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 mb-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newField.isRequired}
                        onChange={(e) =>
                          setNewField({ ...newField, isRequired: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">必須項目</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newField.isCalculated}
                        onChange={(e) =>
                          setNewField({ ...newField, isCalculated: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">計算項目</span>
                    </label>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleSaveNewField}
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      追加
                    </button>
                    <button
                      onClick={() => setIsAdding(false)}
                      className="inline-flex items-center px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                    >
                      <X className="w-4 h-4 mr-2" />
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>

        {fields.length === 0 && !isAdding && (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-violet-400 rounded-2xl blur opacity-25"></div>
                <div className="relative bg-gradient-to-r from-purple-500 to-violet-600 p-6 rounded-2xl">
                  <Settings className="w-16 h-16 text-white mx-auto" />
                </div>
              </div>
            </div>
            <h4 className="text-2xl font-bold text-gray-900 mb-4">項目がありません</h4>
            <p className="text-gray-500 text-lg mb-8">
              最初の項目を追加して始めましょう。
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl text-lg font-semibold"
            >
              <Plus className="w-5 h-5 mr-3" />
              最初の項目を追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}; 