'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { useBusinessTypeFields } from '@/hooks/useBusinessTypeFields';
import { SalesFieldConfig } from '@/types/sales-field-config';
import { downloadCsv, parseCsvDate, formatDateForCsv } from '@/utils/csvUtils';
import apiClient from '@/lib/api';

interface CsvRow {
  [key: string]: string | number;
}

interface CsvValidationError {
  row: number;
  column: string;
  message: string;
}

interface FieldMapping {
  csvColumn: string;
  fieldKey: string;
  fieldLabel: string;
}

export default function CsvImportPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [newFields, setNewFields] = useState<Array<{csvColumn: string, fieldKey: string, fieldLabel: string, fieldType: string}>>([]);
  const [validationErrors, setValidationErrors] = useState<CsvValidationError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{success: boolean, message: string} | null>(null);
  const [previewRows, setPreviewRows] = useState(10);

  // Get businessTypeId from selected store
  const selectedStore = stores.find(store => String(store.id) === selectedStoreId);
  const businessTypeId = selectedStore?.businessTypeId;

  // Use business type field configuration
  const {
    fields: fieldConfigs,
    isLoading: isFieldsLoading
  } = useBusinessTypeFields(businessTypeId);

  // Load stores on mount
  React.useEffect(() => {
    if (user && hasPermission('admin')) {
      fetchStores();
    }
  }, [user, hasPermission, fetchStores]);

  // Set initial store
  React.useEffect(() => {
    if (user && stores.length > 0 && !selectedStoreId) {
      if (user.storeId) {
        setSelectedStoreId(String(user.storeId));
      } else if (stores.length > 0) {
        setSelectedStoreId(String(stores[0].id));
      }
    }
  }, [user, stores, selectedStoreId]);

  // Handle CSV file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('CSVファイルを選択してください。');
      return;
    }

    setCsvFile(file);
    setCsvData([]);
    setCsvHeaders([]);
    setFieldMappings([]);
    setNewFields([]);
    setValidationErrors([]);
    setUploadResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error('CSVパースエラー:', results.errors);
          alert('CSVファイルの読み込みに失敗しました。');
          return;
        }

        const headers = results.meta.fields || [];
        const data = results.data as CsvRow[];

        setCsvHeaders(headers);
        setCsvData(data);

        // 自動マッピング
        autoMapFields(headers, data);
      },
      error: (error) => {
        console.error('CSV読み込みエラー:', error);
        alert('CSVファイルの読み込みに失敗しました。');
      }
    });
  }, []);

  // Auto-map CSV columns to field keys
  const autoMapFields = useCallback((headers: string[], data: CsvRow[]) => {
    if (!fieldConfigs || fieldConfigs.length === 0) return;

    const mappings: FieldMapping[] = [];
    const detectedNewFields: Array<{csvColumn: string, fieldKey: string, fieldLabel: string, fieldType: string}> = [];

    headers.forEach(header => {
      if (!header || header.trim() === '') return;

      // 日付列は特別処理
      if (header.toLowerCase().includes('日付') || header.toLowerCase().includes('date')) {
        return; // 日付列はマッピングしない
      }

      // 既存のフィールドとマッチング
      const matchedField = fieldConfigs.find(field => 
        field.label === header || 
        field.key === header.toLowerCase().replace(/\s+/g, '') ||
        header.includes(field.label) ||
        field.label.includes(header)
      );

      if (matchedField) {
        mappings.push({
          csvColumn: header,
          fieldKey: matchedField.key,
          fieldLabel: matchedField.label
        });
      } else {
        // 新しい項目として検出
        const fieldKey = header.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '_');
        detectedNewFields.push({
          csvColumn: header,
          fieldKey: fieldKey,
          fieldLabel: header,
          fieldType: 'number' // デフォルトは数値
        });
      }
    });

    setFieldMappings(mappings);
    setNewFields(detectedNewFields);
  }, [fieldConfigs]);

  // Validate CSV data
  const validateCsvData = useCallback((): CsvValidationError[] => {
    const errors: CsvValidationError[] = [];
    const dateColumnIndex = csvHeaders.findIndex(h => 
      h.toLowerCase().includes('日付') || h.toLowerCase().includes('date')
    );

    if (dateColumnIndex === -1) {
      errors.push({
        row: 0,
        column: '',
        message: '日付列が見つかりません。CSVファイルに「日付」または「date」という列を含めてください。'
      });
      return errors;
    }

    csvData.forEach((row, index) => {
      const dateValue = row[csvHeaders[dateColumnIndex]];
      if (!dateValue) {
        errors.push({
          row: index + 2, // +2 because CSV has header row and 0-indexed
          column: csvHeaders[dateColumnIndex],
          message: '日付が空です。'
        });
        return;
      }

      const date = parseCsvDate(String(dateValue));
      if (!date) {
        errors.push({
          row: index + 2,
          column: csvHeaders[dateColumnIndex],
          message: `日付形式が正しくありません: ${dateValue}`
        });
      }

      // 数値項目の検証
      fieldMappings.forEach(mapping => {
        const value = row[mapping.csvColumn];
        if (value !== undefined && value !== null && value !== '') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors.push({
              row: index + 2,
              column: mapping.csvColumn,
              message: `数値形式が正しくありません: ${value}`
            });
          }
        }
      });
    });

    return errors;
  }, [csvData, csvHeaders, fieldMappings]);

  // Download template CSV
  const handleDownloadTemplate = useCallback(async () => {
    if (!selectedStoreId || !businessTypeId) {
      alert('店舗を選択してください。');
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const apiBase = process.env.NODE_ENV === 'production' 
        ? '/bb/api' 
        : process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api`
          : 'http://localhost:3001/api';

      const response = await fetch(`${apiBase}/sales/csv-template?storeId=${selectedStoreId}&businessTypeId=${businessTypeId}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('テンプレートのダウンロードに失敗しました。');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      link.download = `売上データテンプレート_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('テンプレートダウンロードエラー:', error);
      alert(error.message || 'テンプレートのダウンロードに失敗しました。');
    }
  }, [selectedStoreId, businessTypeId]);

  // Handle CSV upload
  const handleUpload = useCallback(async () => {
    if (!selectedStoreId) {
      alert('店舗を選択してください。');
      return;
    }

    if (csvData.length === 0) {
      alert('CSVデータがありません。');
      return;
    }

    // Validate
    const errors = validateCsvData();
    if (errors.length > 0) {
      setValidationErrors(errors);
      alert(`CSVデータにエラーがあります（${errors.length}件）。詳細を確認してください。`);
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      // Convert CSV data to the format expected by the API
      const dateColumnIndex = csvHeaders.findIndex(h => 
        h.toLowerCase().includes('日付') || h.toLowerCase().includes('date')
      );

      const processedData: Record<string, Record<string, any>> = {};

      csvData.forEach(row => {
        const dateValue = row[csvHeaders[dateColumnIndex]];
        const date = parseCsvDate(String(dateValue));
        if (!date) return;

        const dayOfMonth = date.getDate();
        const dayData: Record<string, any> = {
          date: formatDateForCsv(date),
          dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
        };

        // Map fields
        fieldMappings.forEach(mapping => {
          const value = row[mapping.csvColumn];
          if (value !== undefined && value !== null && value !== '') {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
              dayData[mapping.fieldKey] = numValue;
            } else {
              dayData[mapping.fieldKey] = String(value);
            }
          }
        });

        processedData[String(dayOfMonth)] = dayData;
      });

      // Prepare request
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const apiBase = process.env.NODE_ENV === 'production' 
        ? '/bb/api' 
        : process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api`
          : 'http://localhost:3001/api';

      const response = await fetch(`${apiBase}/sales/csv-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          storeId: parseInt(selectedStoreId),
          csvData: JSON.stringify(processedData),
          fieldMapping: fieldMappings.reduce((acc, m) => {
            acc[m.csvColumn] = m.fieldKey;
            return acc;
          }, {} as Record<string, string>),
          newFields: newFields,
          overwriteExisting: true
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUploadResult({
          success: true,
          message: `データのインポートが完了しました。${result.processedCount || 0}件のデータを処理しました。`
        });
        // Clear form after successful upload
        setTimeout(() => {
          router.push('/admin/sales-management');
        }, 2000);
      } else {
        setUploadResult({
          success: false,
          message: result.error || 'データのインポートに失敗しました。'
        });
      }
    } catch (error: any) {
      console.error('アップロードエラー:', error);
      setUploadResult({
        success: false,
        message: error.message || 'データのアップロードに失敗しました。'
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedStoreId, csvData, csvHeaders, fieldMappings, newFields, validateCsvData, router]);

  // Update field mapping
  const updateFieldMapping = useCallback((csvColumn: string, fieldKey: string) => {
    setFieldMappings(prev => {
      const existing = prev.find(m => m.csvColumn === csvColumn);
      if (existing) {
        return prev.map(m => 
          m.csvColumn === csvColumn 
            ? { ...m, fieldKey, fieldLabel: fieldConfigs.find(f => f.key === fieldKey)?.label || csvColumn }
            : m
        );
      } else {
        const field = fieldConfigs.find(f => f.key === fieldKey);
        return [...prev, {
          csvColumn,
          fieldKey,
          fieldLabel: field?.label || csvColumn
        }];
      }
    });
  }, [fieldConfigs]);

  // Available fields for mapping
  const availableFields = useMemo(() => {
    return fieldConfigs.filter(f => f.isVisible && !f.isCalculated);
  }, [fieldConfigs]);

  // Preview data
  const previewData = useMemo(() => {
    return csvData.slice(0, previewRows);
  }, [csvData, previewRows]);

  if (!user || !hasPermission('admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            アクセス権限がありません
          </h2>
          <p className="text-gray-600">
            この機能は管理者のみご利用いただけます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                CSV売上データ読み込み
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">使用方法</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>店舗を選択します</li>
            <li>「テンプレートCSVをダウンロード」ボタンをクリックしてテンプレートをダウンロードします</li>
            <li>テンプレートにデータを入力します（日付列は必須です）</li>
            <li>「CSVファイルを選択」ボタンから入力済みのCSVファイルを選択します</li>
            <li>項目マッピングを確認・調整します</li>
            <li>「データをアップロード」ボタンをクリックしてデータを反映します</li>
          </ol>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>注意:</strong> 既存のデータは上書きされます。重要なデータがある場合は事前にバックアップを取ってください。
            </p>
          </div>
        </div>

        {/* Store Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            店舗を選択
          </label>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">店舗を選択してください</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>

        {/* Template Download */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">テンプレートCSV</h2>
          <button
            onClick={handleDownloadTemplate}
            disabled={!selectedStoreId || isFieldsLoading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            テンプレートCSVをダウンロード
          </button>
          <p className="text-sm text-gray-600 mt-2">
            テンプレートには、選択した店舗の表示可能な項目が含まれます。
          </p>
        </div>

        {/* CSV Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">CSVファイルをアップロード</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="cursor-pointer inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              CSVファイルを選択
            </label>
            {csvFile && (
              <p className="mt-4 text-sm text-gray-600">
                選択されたファイル: {csvFile.name} ({csvData.length}行)
              </p>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-3">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold text-red-900">
                検証エラー ({validationErrors.length}件)
              </h3>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-red-200">
                    <th className="text-left py-2 px-3">行</th>
                    <th className="text-left py-2 px-3">列</th>
                    <th className="text-left py-2 px-3">エラー内容</th>
                  </tr>
                </thead>
                <tbody>
                  {validationErrors.map((error, index) => (
                    <tr key={index} className="border-b border-red-100">
                      <td className="py-2 px-3">{error.row}</td>
                      <td className="py-2 px-3">{error.column}</td>
                      <td className="py-2 px-3 text-red-700">{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Field Mapping */}
        {csvHeaders.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">項目マッピング</h2>
            <div className="space-y-3">
              {csvHeaders.map(header => {
                if (header.toLowerCase().includes('日付') || header.toLowerCase().includes('date')) {
                  return null; // Skip date column
                }

                const mapping = fieldMappings.find(m => m.csvColumn === header);
                const isNewField = newFields.some(f => f.csvColumn === header);

                return (
                  <div key={header} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{header}</span>
                      {isNewField && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          新規項目
                        </span>
                      )}
                    </div>
                    <select
                      value={mapping?.fieldKey || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          updateFieldMapping(header, e.target.value);
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">マッピングしない</option>
                      {availableFields.map(field => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview */}
        {previewData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">プレビュー</h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">表示行数:</span>
                <select
                  value={previewRows}
                  onChange={(e) => setPreviewRows(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value={10}>10行</option>
                  <option value={20}>20行</option>
                  <option value={50}>50行</option>
                  <option value={100}>100行</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {csvHeaders.map(header => (
                      <th key={header} className="text-left py-2 px-3 font-medium text-gray-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      {csvHeaders.map(header => (
                        <td key={header} className="py-2 px-3 text-gray-900">
                          {row[header] !== undefined && row[header] !== null ? String(row[header]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvData.length > previewRows && (
              <p className="mt-4 text-sm text-gray-600 text-center">
                他 {csvData.length - previewRows} 行が表示されていません
              </p>
            )}
          </div>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <div className={`rounded-lg p-6 mb-6 ${
            uploadResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              {uploadResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <p className={`font-medium ${
                uploadResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {uploadResult.message}
              </p>
            </div>
          </div>
        )}

        {/* Upload Button */}
        {csvData.length > 0 && (
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setCsvFile(null);
                setCsvData([]);
                setCsvHeaders([]);
                setFieldMappings([]);
                setNewFields([]);
                setValidationErrors([]);
                setUploadResult(null);
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              リセット
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || !selectedStoreId || fieldMappings.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors inline-flex items-center"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  データをアップロード
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

