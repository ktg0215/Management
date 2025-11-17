'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SalesFieldConfiguration } from '@/components/sales/SalesFieldConfiguration';
import {
  BusinessTypeSalesConfig,
  SalesFieldConfig,
  DEFAULT_SALES_FIELDS,
  getDefaultFieldConfigs
} from '@/types/sales-field-config';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useBusinessTypeStore } from '@/stores/businessTypeStore';
import { useAuthStore } from '@/stores/authStore';
import { Settings, Save, ArrowLeft, AlertCircle, Building2 } from 'lucide-react';

export default function SalesFieldSettingsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuthStore();
  const { businessTypes, fetchBusinessTypes } = useBusinessTypeStore();
  const [salesFieldConfigs, setSalesFieldConfigs] = useLocalStorage<BusinessTypeSalesConfig[]>(
    'sales-field-configs',
    []
  );
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string>('');

  // 権限チェック
  useEffect(() => {
    if (user && !hasPermission('admin')) {
      router.push('/admin/dashboard');
    }
  }, [user, hasPermission, router]);

  // 業態データ取得
  useEffect(() => {
    fetchBusinessTypes();
  }, [fetchBusinessTypes]);

  // 選択業態の初期化
  useEffect(() => {
    if (businessTypes.length > 0 && !selectedBusinessTypeId) {
      setSelectedBusinessTypeId(businessTypes[0].id);
    }
  }, [businessTypes, selectedBusinessTypeId]);

  // 業態に対応する設定を取得または初期化
  const getOrCreateConfig = (businessTypeId: string, businessTypeName: string): BusinessTypeSalesConfig => {
    const existing = salesFieldConfigs.find(c => c.businessTypeId === businessTypeId);
    if (existing) return existing;

    // 新規作成: 業態名に応じてデフォルト設定を使用
    const defaultFields = getDefaultFieldConfigs(businessTypeName);

    return {
      businessTypeId,
      businessTypeName,
      fields: defaultFields.map((field, index) => ({
        ...field,
        id: `${businessTypeId}-field-${index}-${Date.now()}`
      }))
    };
  };

  const selectedBusinessType = businessTypes.find(bt => bt.id === selectedBusinessTypeId);
  const currentConfig = selectedBusinessType
    ? getOrCreateConfig(selectedBusinessType.id, selectedBusinessType.name)
    : null;

  const handleFieldsChange = (updatedFields: SalesFieldConfig[]) => {
    if (!selectedBusinessType) return;

    const updatedConfig: BusinessTypeSalesConfig = {
      businessTypeId: selectedBusinessType.id,
      businessTypeName: selectedBusinessType.name,
      fields: updatedFields
    };

    const updatedConfigs = salesFieldConfigs.filter(c => c.businessTypeId !== selectedBusinessType.id);
    updatedConfigs.push(updatedConfig);

    setSalesFieldConfigs(updatedConfigs);
  };

  const handleSave = () => {
    setSaveMessage('設定を保存しました');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleBack = () => {
    router.push('/admin/sales-management');
  };

  if (!user || !hasPermission('admin')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700">アクセス権限がありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">売上管理 表示項目設定</h1>
                <p className="text-sm text-gray-600 mt-1">
                  業態ごとに売上管理ページに表示する項目をカスタマイズできます
                </p>
              </div>
            </div>
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>売上管理に戻る</span>
            </button>
          </div>
        </div>

        {/* Business Type Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-4">
            <Building2 className="h-5 w-5 text-gray-500" />
            <label className="font-medium text-gray-900">業態を選択:</label>
            <select
              value={selectedBusinessTypeId}
              onChange={(e) => setSelectedBusinessTypeId(e.target.value)}
              className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {businessTypes.map(bt => (
                <option key={bt.id} value={bt.id}>
                  {bt.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Field Configuration */}
        {currentConfig && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <SalesFieldConfiguration
              fields={currentConfig.fields}
              onFieldsChange={handleFieldsChange}
              businessTypeName={currentConfig.businessTypeName}
            />
          </div>
        )}

        {/* Save Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              {saveMessage && (
                <div className="flex items-center space-x-2 text-green-600">
                  <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="font-medium">{saveMessage}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Save className="h-5 w-5" />
              <span>設定を保存</span>
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">使い方</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• 目のアイコンをクリックして項目の表示/非表示を切り替えます</li>
            <li>• 鍵のアイコンをクリックして項目の編集可否を設定します</li>
            <li>• 矢印ボタンで項目の表示順序を変更できます</li>
            <li>• 自動計算項目は編集不可に固定されています</li>
            <li>• 設定は業態ごとに保存され、売上管理ページに即座に反映されます</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
