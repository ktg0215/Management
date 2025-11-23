import React, { useState, useEffect, useCallback } from 'react';
import { Field, StoreFieldVisibility, DEFAULT_FIELDS, FieldCategory, FieldType, FIELD_CATEGORIES } from '../../types/monthly-sales';
import { Building, ChevronDown, Plus, Save, Eye, EyeOff, Settings, X, Check } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useStoreStore } from '../../stores/storeStore';
import { formatStoreName, sortStoresByBusinessType } from '../../utils/storeDisplay';
import { Store } from '../../types/store';

// API Base URLを取得
const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001/api';
  }
  // 本番環境かどうかを判定
  const hostname = window.location.hostname;
  const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';
  if (isProduction) {
    return '/bb/api';
  }
  // ローカル開発環境
  return 'http://localhost:3001/api';
};

interface SharedFieldConfigurationProps {
  onFieldsChange: (fields: Field[]) => void;
}

export const BusinessTypeFieldConfiguration: React.FC<SharedFieldConfigurationProps> = ({
  onFieldsChange,
}) => {
  // Master list of all available fields (shared across all stores)
  // Initialize with DEFAULT_FIELDS, adding IDs based on order field
  const defaultFields: Field[] = DEFAULT_FIELDS.map((field) => ({
    ...field,
    id: `default-${field.order}`,
  }));

  const [masterFields, setMasterFields] = useLocalStorage<Field[]>('monthly-sales-master-fields', defaultFields);

  // Per-store visibility settings
  const [storeVisibilitySettings, setStoreVisibilitySettings] = useLocalStorage<StoreFieldVisibility[]>(
    'store-field-visibility',
    []
  );

  const { stores } = useStoreStore();
  const sortedStores = sortStoresByBusinessType(stores);

  // Group stores by business type
  const businessTypes = sortedStores.reduce((acc, store) => {
    const btId = store.businessTypeId || 'default';
    const btName = store.businessTypeName || '未分類';
    if (!acc[btId]) {
      acc[btId] = { name: btName, stores: [] };
    }
    acc[btId].stores.push(store);
    return acc;
  }, {} as Record<string, { name: string; stores: Store[] }>);

  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isAddingField, setIsAddingField] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newField, setNewField] = useState<Omit<Field, 'id'>>({
    name: '',
    category: 'other',
    type: 'number',
    isRequired: false,
    isCalculated: false,
    order: masterFields.length + 1,
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['sales', 'customer', 'profit']));

  // Load fields from API for selected business type
  const loadFieldsFromAPI = useCallback(async (businessTypeId: string) => {
    if (!businessTypeId) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/business-type-fields?businessTypeId=${businessTypeId}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        // Convert API fields to local Field format
        const apiFields: Field[] = result.data.map((f: any, index: number) => ({
          id: f.id || `api-${index}`,
          name: f.label || f.name || '',
          category: f.category || 'other',
          type: f.type || 'number',
          unit: f.unit,
          isRequired: f.isRequired || false,
          isCalculated: f.isAutoCalculated || false,
          order: f.order || index + 1,
        }));
        setMasterFields(apiFields);
      }
    } catch (error) {
      console.error('業態フィールド読み込みエラー:', error);
    }
  }, [setMasterFields]);

  // Save fields to API for business type
  const saveFieldsToAPI = useCallback(async (businessTypeId: string, fields: Field[]) => {
    if (!businessTypeId) return false;

    setIsSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      // Convert local Field format to API format
      const apiFields = fields.map((f, index) => ({
        id: f.id,
        key: f.name.toLowerCase().replace(/\s+/g, '_'),
        label: f.name,
        category: f.category,
        type: f.type,
        unit: f.unit,
        isRequired: f.isRequired,
        isAutoCalculated: f.isCalculated,
        order: f.order || index + 1,
      }));

      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/business-type-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessTypeId,
          fields: apiFields,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert('項目設定を保存しました（同じ業態の全店舗に反映されます）');
        return true;
      } else {
        alert('保存に失敗しました: ' + (result.error || '不明なエラー'));
        return false;
      }
    } catch (error) {
      console.error('業態フィールド保存エラー:', error);
      alert('保存中にエラーが発生しました');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Set default business type when stores load
  useEffect(() => {
    if (Object.keys(businessTypes).length > 0 && !selectedBusinessTypeId) {
      const firstBtId = Object.keys(businessTypes)[0];
      setSelectedBusinessTypeId(firstBtId);
      // Also set first store in that business type
      if (businessTypes[firstBtId]?.stores.length > 0) {
        setSelectedStoreId(businessTypes[firstBtId].stores[0].id);
      }
    }
  }, [businessTypes, selectedBusinessTypeId]);

  // Load fields when business type changes
  useEffect(() => {
    if (selectedBusinessTypeId) {
      loadFieldsFromAPI(selectedBusinessTypeId);
    }
  }, [selectedBusinessTypeId, loadFieldsFromAPI]);

  // Handle business type selection change
  const handleBusinessTypeChange = (btId: string) => {
    setSelectedBusinessTypeId(btId);
    // Set first store in that business type
    if (businessTypes[btId]?.stores.length > 0) {
      setSelectedStoreId(businessTypes[btId].stores[0].id);
    }
  };

  // Save current fields to API
  const handleSaveFields = async () => {
    if (selectedBusinessTypeId) {
      await saveFieldsToAPI(selectedBusinessTypeId, masterFields);
    }
  };

  // Notify parent of field changes
  useEffect(() => {
    onFieldsChange(masterFields);
  }, [masterFields, onFieldsChange]);

  const selectedStore = sortedStores.find(store => store.id === selectedStoreId);

  // Get visibility settings for current store
  const getCurrentStoreVisibility = (): string[] => {
    const settings = storeVisibilitySettings.find(s => s.storeId === selectedStoreId);
    if (settings) {
      return settings.visibleFieldIds;
    }
    // Default: all fields are visible
    return masterFields.map(f => f.id);
  };

  const isFieldVisible = (fieldId: string): boolean => {
    const visibleIds = getCurrentStoreVisibility();
    return visibleIds.includes(fieldId);
  };

  const toggleFieldVisibility = (fieldId: string) => {
    const currentVisibility = getCurrentStoreVisibility();
    let newVisibility: string[];

    if (currentVisibility.includes(fieldId)) {
      newVisibility = currentVisibility.filter(id => id !== fieldId);
    } else {
      newVisibility = [...currentVisibility, fieldId];
    }

    // Update store visibility settings
    const existingIndex = storeVisibilitySettings.findIndex(s => s.storeId === selectedStoreId);
    if (existingIndex >= 0) {
      const updated = [...storeVisibilitySettings];
      updated[existingIndex] = { storeId: selectedStoreId, visibleFieldIds: newVisibility };
      setStoreVisibilitySettings(updated);
    } else {
      setStoreVisibilitySettings([
        ...storeVisibilitySettings,
        { storeId: selectedStoreId, visibleFieldIds: newVisibility }
      ]);
    }
  };

  const toggleAllFieldsInCategory = (category: string, visible: boolean) => {
    const categoryFieldIds = masterFields
      .filter(f => f.category === category)
      .map(f => f.id);

    let currentVisibility = getCurrentStoreVisibility();

    if (visible) {
      // Add all category fields
      currentVisibility = [...new Set([...currentVisibility, ...categoryFieldIds])];
    } else {
      // Remove all category fields
      currentVisibility = currentVisibility.filter(id => !categoryFieldIds.includes(id));
    }

    // Update store visibility settings
    const existingIndex = storeVisibilitySettings.findIndex(s => s.storeId === selectedStoreId);
    if (existingIndex >= 0) {
      const updated = [...storeVisibilitySettings];
      updated[existingIndex] = { storeId: selectedStoreId, visibleFieldIds: currentVisibility };
      setStoreVisibilitySettings(updated);
    } else {
      setStoreVisibilitySettings([
        ...storeVisibilitySettings,
        { storeId: selectedStoreId, visibleFieldIds: currentVisibility }
      ]);
    }
  };

  const selectAllFields = () => {
    const allFieldIds = masterFields.map(f => f.id);
    const existingIndex = storeVisibilitySettings.findIndex(s => s.storeId === selectedStoreId);
    if (existingIndex >= 0) {
      const updated = [...storeVisibilitySettings];
      updated[existingIndex] = { storeId: selectedStoreId, visibleFieldIds: allFieldIds };
      setStoreVisibilitySettings(updated);
    } else {
      setStoreVisibilitySettings([
        ...storeVisibilitySettings,
        { storeId: selectedStoreId, visibleFieldIds: allFieldIds }
      ]);
    }
  };

  const deselectAllFields = () => {
    const existingIndex = storeVisibilitySettings.findIndex(s => s.storeId === selectedStoreId);
    if (existingIndex >= 0) {
      const updated = [...storeVisibilitySettings];
      updated[existingIndex] = { storeId: selectedStoreId, visibleFieldIds: [] };
      setStoreVisibilitySettings(updated);
    } else {
      setStoreVisibilitySettings([
        ...storeVisibilitySettings,
        { storeId: selectedStoreId, visibleFieldIds: [] }
      ]);
    }
  };

  const handleAddField = () => {
    if (newField.name.trim()) {
      const field: Field = {
        ...newField,
        id: `custom-${Date.now()}`,
        name: newField.name.trim(),
        order: masterFields.length + 1,
      };
      const updatedFields = [...masterFields, field];
      setMasterFields(updatedFields);

      // Also make it visible for the current store by default
      const currentVisibility = getCurrentStoreVisibility();
      const existingIndex = storeVisibilitySettings.findIndex(s => s.storeId === selectedStoreId);
      if (existingIndex >= 0) {
        const updated = [...storeVisibilitySettings];
        updated[existingIndex] = { storeId: selectedStoreId, visibleFieldIds: [...currentVisibility, field.id] };
        setStoreVisibilitySettings(updated);
      } else {
        setStoreVisibilitySettings([
          ...storeVisibilitySettings,
          { storeId: selectedStoreId, visibleFieldIds: [...currentVisibility, field.id] }
        ]);
      }

      setNewField({
        name: '',
        category: 'other',
        type: 'number',
        isRequired: false,
        isCalculated: false,
        order: updatedFields.length + 1,
      });
      setIsAddingField(false);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryFields = (category: string) => {
    return masterFields.filter(field => field.category === category).sort((a, b) => a.order - b.order);
  };

  const getCategoryVisibleCount = (category: string): number => {
    const categoryFields = getCategoryFields(category);
    return categoryFields.filter(f => isFieldVisible(f.id)).length;
  };

  const fieldCategories = [...new Set(masterFields.map(field => field.category))];

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

  const visibleCount = getCurrentStoreVisibility().length;
  const totalCount = masterFields.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">項目表示設定</h3>
              <p className="text-gray-600 font-medium">Field Visibility Configuration</p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Business Type Selector */}
              <div className="flex items-center space-x-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200 min-w-64">
                <Building className="w-5 h-5 text-indigo-500" />
                <select
                  value={selectedBusinessTypeId}
                  onChange={(e) => handleBusinessTypeChange(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-gray-900 font-semibold cursor-pointer flex-1"
                  disabled={Object.keys(businessTypes).length === 0}
                >
                  {Object.keys(businessTypes).length === 0 ? (
                    <option value="">業態がありません</option>
                  ) : (
                    Object.entries(businessTypes).map(([btId, bt]) => (
                      <option key={btId} value={btId}>
                        {bt.name} ({bt.stores.length}店舗)
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>

              {/* Add Field Button */}
              <button
                onClick={() => setIsAddingField(true)}
                className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                <span className="font-semibold">項目追加</span>
              </button>

              {/* Save Button */}
              <button
                onClick={handleSaveFields}
                disabled={isSaving || !selectedBusinessTypeId}
                className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5 mr-2" />
                <span className="font-semibold">{isSaving ? '保存中...' : '保存'}</span>
              </button>
            </div>
          </div>

          {/* Add Field Form */}
          {isAddingField && (
            <div className="mt-6 p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-indigo-200">
              <h4 className="font-semibold text-gray-900 mb-4">新しい項目を追加</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">項目名</label>
                  <input
                    type="text"
                    value={newField.name}
                    onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                    placeholder="項目名を入力"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
                  <select
                    value={newField.category}
                    onChange={(e) => setNewField({ ...newField, category: e.target.value as FieldCategory })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  >
                    {Object.entries(FIELD_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">データ型</label>
                  <select
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-6 mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newField.isRequired}
                    onChange={(e) => setNewField({ ...newField, isRequired: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">必須項目</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newField.isCalculated}
                    onChange={(e) => setNewField({ ...newField, isCalculated: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">計算項目</span>
                </label>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleAddField}
                  disabled={!newField.name.trim()}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4 mr-2" />
                  追加
                </button>
                <button
                  onClick={() => {
                    setIsAddingField(false);
                    setNewField({
                      name: '',
                      category: 'other',
                      type: 'number',
                      isRequired: false,
                      isCalculated: false,
                      order: masterFields.length + 1,
                    });
                  }}
                  className="inline-flex items-center px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* Business Type Info & Bulk Actions */}
          {selectedBusinessTypeId && businessTypes[selectedBusinessTypeId] && (
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Building className="w-5 h-5 text-indigo-500" />
                  <span className="text-lg font-semibold text-gray-900">
                    {businessTypes[selectedBusinessTypeId].name}
                  </span>
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
                    {visibleCount}/{totalCount}項目表示中
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                    {businessTypes[selectedBusinessTypeId].stores.length}店舗に適用
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={selectAllFields}
                  className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors duration-200"
                >
                  <Check className="w-4 h-4 mr-1" />
                  すべて選択
                </button>
                <button
                  onClick={deselectAllFields}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  <X className="w-4 h-4 mr-1" />
                  すべて解除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Field List by Category */}
      {selectedBusinessTypeId && businessTypes[selectedBusinessTypeId] ? (
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-8 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl shadow-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">項目一覧</h3>
                <p className="text-gray-600 font-medium">
                  Fields for {businessTypes[selectedBusinessTypeId].name}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {fieldCategories.map(category => {
              const fields = getCategoryFields(category);
              if (fields.length === 0) return null;
              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category} className="border-b border-gray-100 last:border-b-0">
                  {/* Category Header */}
                  <div className="flex items-center justify-between py-4">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="flex items-center space-x-3 hover:bg-gray-50 px-4 py-2 rounded-lg transition-all duration-200 flex-1"
                    >
                      <span className="text-xl">{getCategoryIcon(category)}</span>
                      <h4 className="font-bold text-gray-800 text-lg">{FIELD_CATEGORIES[category as FieldCategory]}</h4>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        {fields.length}項目
                      </span>
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Category Fields */}
                  {isExpanded && (
                    <div className="pb-4 pl-4">
                      {/* Bulk Actions for Category */}
                      <div className="flex items-center space-x-2 mb-3">
                        <button
                          onClick={() => toggleAllFieldsInCategory(category, true)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 transition-colors duration-200"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          すべて表示
                        </button>
                        <button
                          onClick={() => toggleAllFieldsInCategory(category, false)}
                          className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
                        >
                          <EyeOff className="w-3 h-3 mr-1" />
                          すべて非表示
                        </button>
                        <span className="text-xs text-gray-500">
                          {getCategoryVisibleCount(category)}/{fields.length} 表示中
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {fields.map(field => {
                          const visible = isFieldVisible(field.id);
                          return (
                            <div
                              key={field.id}
                              className={`flex items-center space-x-3 p-3 rounded-lg border ${
                                visible
                                  ? 'border-gray-200 bg-white'
                                  : 'border-gray-100 bg-gray-50 opacity-60'
                              }`}
                            >
                              {/* Visibility Toggle */}
                              <button
                                onClick={() => toggleFieldVisibility(field.id)}
                                className={`p-1.5 rounded-lg transition-all duration-200 ${
                                  visible
                                    ? 'text-blue-600 hover:bg-blue-100'
                                    : 'text-gray-400 hover:bg-gray-200'
                                }`}
                                title={visible ? '非表示にする' : '表示する'}
                              >
                                {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm font-medium truncate block ${
                                  visible ? 'text-gray-900' : 'text-gray-500'
                                }`}>
                                  {field.name}
                                </span>
                                {field.unit && (
                                  <span className="text-xs text-gray-500">
                                    {field.unit}
                                  </span>
                                )}
                              </div>
                              {field.isCalculated && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                  自動計算
                                </span>
                              )}
                              {field.isRequired && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                                  必須
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-16 text-center">
          <div className="text-gray-400 mb-8">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-2xl blur opacity-25"></div>
              <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-2xl">
                <Building className="w-16 h-16 text-white mx-auto" />
              </div>
            </div>
          </div>
          <h4 className="text-2xl font-bold text-gray-900 mb-4">業態が選択されていません</h4>
          <p className="text-gray-500 text-lg">
            業態を選択して項目を設定してください。
          </p>
        </div>
      )}
    </div>
  );
};