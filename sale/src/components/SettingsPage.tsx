import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Eye, 
  EyeOff, 
  GripVertical, 
  Trash2, 
  RotateCcw,
  Save,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { ColumnConfig } from '../types/settings';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateColumnVisibility,
    addColumn,
    removeColumn,
    reorderColumns,
    resetToDefaults,
    getColumnsByCategory,
  } = useSettings();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['sales', 'customer', 'labor', 'productivity', 'other'])
  );
  const [newColumnForm, setNewColumnForm] = useState({
    id: '',
    label: '',
    category: 'sales' as const,
    type: 'number' as const,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAddColumn = () => {
    if (newColumnForm.id && newColumnForm.label) {
      // Check if ID already exists
      const exists = settings.columns.some(col => col.id === newColumnForm.id);
      if (exists) {
        alert('この項目IDは既に存在します');
        return;
      }

      addColumn({
        ...newColumnForm,
        visible: true,
      });

      setNewColumnForm({
        id: '',
        label: '',
        category: 'sales',
        type: 'number',
      });
      setShowAddForm(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null);
      return;
    }

    const draggedIndex = settings.columns.findIndex(col => col.id === draggedColumn);
    const targetIndex = settings.columns.findIndex(col => col.id === targetColumnId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null);
      return;
    }

    const newColumns = [...settings.columns];
    const [draggedItem] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, draggedItem);

    // Update order numbers
    const reorderedColumns = newColumns.map((col, index) => ({
      ...col,
      order: index + 1,
    }));

    reorderColumns(reorderedColumns);
    setDraggedColumn(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">売上管理設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-2 transition-colors duration-200 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>項目追加</span>
                </button>
                <button
                  onClick={resetToDefaults}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center space-x-2 transition-colors duration-200 text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>デフォルトに戻す</span>
                </button>
              </div>
              <div className="text-sm text-gray-600">
                表示項目: {settings.columns.filter(col => col.visible).length} / {settings.columns.length}
              </div>
            </div>

            {/* Add Column Form */}
            {showAddForm && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-base font-medium text-gray-900 mb-4">新しい項目を追加</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      項目ID
                    </label>
                    <input
                      type="text"
                      value={newColumnForm.id}
                      onChange={(e) => setNewColumnForm(prev => ({ ...prev, id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="例: customField1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      表示名
                    </label>
                    <input
                      type="text"
                      value={newColumnForm.label}
                      onChange={(e) => setNewColumnForm(prev => ({ ...prev, label: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="例: カスタム項目"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      カテゴリ
                    </label>
                    <select
                      value={newColumnForm.category}
                      onChange={(e) => setNewColumnForm(prev => ({ ...prev, category: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      {settings.categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      データ型
                    </label>
                    <select
                      value={newColumnForm.type}
                      onChange={(e) => setNewColumnForm(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="number">数値</option>
                      <option value="text">テキスト</option>
                      <option value="calculated">計算値</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors duration-200 text-sm"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddColumn}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors duration-200 text-sm"
                  >
                    追加
                  </button>
                </div>
              </div>
            )}

            {/* Column List by Category */}
            <div className="space-y-4">
              {settings.categories.map(category => {
                const categoryColumns = getColumnsByCategory(category.id);
                const isExpanded = expandedCategories.has(category.id);

                return (
                  <div key={category.id} className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-medium text-gray-900">{category.label}</span>
                        <span className="text-sm text-gray-500">
                          ({categoryColumns.filter(col => col.visible).length}/{categoryColumns.length})
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 space-y-2">
                        {categoryColumns.map(column => (
                          <div
                            key={column.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, column.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.id)}
                            className={`flex items-center justify-between p-3 border rounded-lg transition-colors duration-200 cursor-move ${
                              draggedColumn === column.id
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => updateColumnVisibility(column.id, !column.visible)}
                                  className={`p-1 rounded transition-colors duration-200 ${
                                    column.visible
                                      ? 'text-green-600 hover:bg-green-50'
                                      : 'text-gray-400 hover:bg-gray-50'
                                  }`}
                                >
                                  {column.visible ? (
                                    <Eye className="w-4 h-4" />
                                  ) : (
                                    <EyeOff className="w-4 h-4" />
                                  )}
                                </button>
                                <div>
                                  <div className="font-medium text-gray-900">{column.label}</div>
                                  <div className="text-xs text-gray-500">
                                    {column.id} • {column.type === 'number' ? '数値' : column.type === 'text' ? 'テキスト' : '計算値'}
                                    {column.required && ' • 必須'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">#{column.order}</span>
                              {!column.required && (
                                <button
                                  onClick={() => removeColumn(column.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded transition-colors duration-200"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors duration-200"
          >
            閉じる
          </button>
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-2 transition-colors duration-200"
          >
            <Save className="w-4 h-4" />
            <span>保存して閉じる</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;