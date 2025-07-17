import React, { useState, useEffect } from 'react';
import { BusinessType, Field } from '../../types/monthly-sales';
import { FieldConfiguration } from './FieldConfiguration';
import { Building2, ChevronDown, Plus, Save, AlertCircle } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useBusinessTypeStore } from '../../stores/businessTypeStore';

// 型の競合を回避するため、APIのBusinessTypeを区別
type ApiBusinessType = import('../../lib/api').BusinessType;

interface BusinessTypeFieldConfigurationProps {
  onBusinessTypesChange: (businessTypes: BusinessType[]) => void;
}

export const BusinessTypeFieldConfiguration: React.FC<BusinessTypeFieldConfigurationProps> = ({
  onBusinessTypesChange,
}) => {
  const [localBusinessTypes, setLocalBusinessTypes] = useLocalStorage<BusinessType[]>('monthly-sales-business-types', []);
  const { businessTypes: apiBusinessTypes, fetchBusinessTypes } = useBusinessTypeStore();

  // API業態データを月次売上管理用の型に変換
  const convertApiBusinessType = React.useCallback((apiType: ApiBusinessType): BusinessType => {
    return {
      id: apiType.id,
      name: apiType.name,
      fields: [] // APIの業態データにはfieldsがないので空配列
    };
  }, []);
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState<string>('');
  const [isAddingBusinessType, setIsAddingBusinessType] = useState(false);
  const [newBusinessTypeName, setNewBusinessTypeName] = useState('');
  
  // APIから業態データを取得
  useEffect(() => {
    fetchBusinessTypes();
  }, [fetchBusinessTypes]);
  
  // 全業態リスト（API + ローカル）を結合
  const allBusinessTypes = React.useMemo(() => {
    // APIの業態データを月次売上管理用の型に変換
    const convertedApiTypes = apiBusinessTypes.map(convertApiBusinessType);
    const combined = [...convertedApiTypes, ...localBusinessTypes];
    
    // 重複を除去（ローカルデータを優先）
    const uniqueTypes = combined.reduce((acc, current) => {
      const existing = acc.find(item => item.name === current.name);
      if (!existing) {
        acc.push(current);
      }
      return acc;
    }, [] as BusinessType[]);
    return uniqueTypes;
  }, [apiBusinessTypes, localBusinessTypes, convertApiBusinessType]);

  useEffect(() => {
    if (allBusinessTypes.length > 0 && !selectedBusinessTypeId) {
      setSelectedBusinessTypeId(allBusinessTypes[0].id);
    }
  }, [allBusinessTypes, selectedBusinessTypeId]);

  useEffect(() => {
    onBusinessTypesChange(allBusinessTypes);
  }, [allBusinessTypes, onBusinessTypesChange]);

  const selectedBusinessType = allBusinessTypes.find(bt => bt.id === selectedBusinessTypeId);

  const handleFieldsChange = (fields: Field[]) => {
    if (!selectedBusinessType) return;
    
    // ローカル業態のみ更新（API業態は読み取り専用）
    const updatedLocalBusinessTypes = localBusinessTypes.map(bt =>
      bt.id === selectedBusinessType.id
        ? { ...bt, fields }
        : bt
    );
    setLocalBusinessTypes(updatedLocalBusinessTypes);
  };

  const handleAddBusinessType = () => {
    if (newBusinessTypeName.trim()) {
      const newBusinessType: BusinessType = {
        id: Date.now().toString(),
        name: newBusinessTypeName.trim(),
        fields: [],
      };
      const updatedLocalBusinessTypes = [...localBusinessTypes, newBusinessType];
      setLocalBusinessTypes(updatedLocalBusinessTypes);
      setSelectedBusinessTypeId(newBusinessType.id);
      setNewBusinessTypeName('');
      setIsAddingBusinessType(false);
    }
  };

  const handleDeleteBusinessType = (businessTypeId: string) => {
    if (window.confirm('この業態を削除しますか？関連するデータも削除されます。')) {
      const updatedBusinessTypes = allBusinessTypes.filter(bt => bt.id !== businessTypeId);
      setLocalBusinessTypes(updatedBusinessTypes.filter(bt => !apiBusinessTypes.find(api => api.name === bt.name)));
      if (selectedBusinessTypeId === businessTypeId) {
        setSelectedBusinessTypeId(updatedBusinessTypes.length > 0 ? updatedBusinessTypes[0].id : '');
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Business Type Selection Header */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">業態別項目設定</h3>
              <p className="text-gray-600 font-medium">Business Type Field Configuration</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Business Type Selector */}
              <div className="flex items-center space-x-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200 min-w-64">
                <Building2 className="w-5 h-5 text-indigo-500" />
                <select
                  value={selectedBusinessTypeId}
                  onChange={(e) => setSelectedBusinessTypeId(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-gray-900 font-semibold cursor-pointer flex-1"
                  disabled={allBusinessTypes.length === 0}
                >
                  {allBusinessTypes.length === 0 ? (
                    <option value="">業態を追加してください</option>
                  ) : (
                    allBusinessTypes.map(bt => (
                      <option key={bt.id} value={bt.id}>{bt.name}</option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>

              {/* Add Business Type Button */}
              <button
                onClick={() => setIsAddingBusinessType(true)}
                className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                <span className="font-semibold">業態追加</span>
              </button>
            </div>
          </div>

          {/* Add Business Type Form */}
          {isAddingBusinessType && (
            <div className="mt-6 p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-indigo-200">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newBusinessTypeName}
                    onChange={(e) => setNewBusinessTypeName(e.target.value)}
                    placeholder="業態名を入力（例：レストラン、カフェ、居酒屋）"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddBusinessType();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={handleAddBusinessType}
                  disabled={!newBusinessTypeName.trim()}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4 mr-2" />
                  追加
                </button>
                <button
                  onClick={() => {
                    setIsAddingBusinessType(false);
                    setNewBusinessTypeName('');
                  }}
                  className="inline-flex items-center px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* Business Type Actions */}
          {selectedBusinessType && (
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-indigo-500" />
                  <span className="text-lg font-semibold text-gray-900">{selectedBusinessType.name}</span>
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
                    {selectedBusinessType.fields.length}項目
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteBusinessType(selectedBusinessType.id)}
                className="inline-flex items-center px-4 py-2 text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                業態削除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Field Configuration */}
      {selectedBusinessType ? (
        <FieldConfiguration
          fields={selectedBusinessType.fields}
          onFieldsChange={handleFieldsChange}
        />
      ) : (
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-16 text-center">
          <div className="text-gray-400 mb-8">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-2xl blur opacity-25"></div>
              <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-2xl">
                <Building2 className="w-16 h-16 text-white mx-auto" />
              </div>
            </div>
          </div>
          <h4 className="text-2xl font-bold text-gray-900 mb-4">業態が選択されていません</h4>
          <p className="text-gray-500 text-lg mb-8">
            まず業態を追加してから項目設定を行ってください。
          </p>
          <button
            onClick={() => setIsAddingBusinessType(true)}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl text-lg font-semibold"
          >
            <Plus className="w-5 h-5 mr-3" />
            最初の業態を追加
          </button>
        </div>
      )}
    </div>
  );
}; 