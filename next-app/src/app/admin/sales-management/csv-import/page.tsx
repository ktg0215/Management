'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, AlertCircle, CheckCircle, ArrowLeft, ArrowRight, Check, Plus, RefreshCw, Database, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import Encoding from 'encoding-japanese';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { useBusinessTypeFields } from '@/hooks/useBusinessTypeFields';
import { parseCsvDate, formatDateForCsv } from '@/utils/csvUtils';

interface CsvRow {
  [key: string]: string | number;
}

interface CsvValidationError {
  row: number;
  column: string;
  message: string;
}

interface ExistingFieldMapping {
  csvColumn: string;
  fieldKey: string;
  fieldLabel: string;
  include: boolean; // Whether to include this existing field
}

interface NewFieldConfig {
  csvColumn: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  include: boolean; // Whether to include this new field
}

export default function CsvImportPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [existingFieldMappings, setExistingFieldMappings] = useState<ExistingFieldMapping[]>([]);
  const [newFields, setNewFields] = useState<NewFieldConfig[]>([]);
  const [validationErrors, setValidationErrors] = useState<CsvValidationError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{success: boolean, message: string} | null>(null);
  const [previewRows, setPreviewRows] = useState(10);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);

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
    setExistingFieldMappings([]);
    setNewFields([]);
    setValidationErrors([]);
    setUploadResult(null);

    // FileReaderでバイナリとして読み込み、エンコーディングを自動検出
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);

      // encoding-japaneseでエンコーディングを検出
      const detectedEncoding = Encoding.detect(uint8Array);
      console.log('検出されたエンコーディング:', detectedEncoding);

      // UTF-8またはUnicodeに変換
      let text: string;
      if (detectedEncoding === 'UTF8' || detectedEncoding === 'ASCII') {
        // UTF-8の場合はそのまま文字列に変換
        const decoder = new TextDecoder('utf-8');
        text = decoder.decode(uint8Array);
      } else {
        // Shift-JIS, EUC-JP等の場合はUnicodeに変換
        const unicodeArray = Encoding.convert(uint8Array, {
          to: 'UNICODE',
          from: detectedEncoding as string || 'SJIS'
        });
        text = Encoding.codeToString(unicodeArray);
      }

      // BOMを除去
      const cleanText = text.replace(/^\uFEFF/, '');

      Papa.parse(cleanText, {
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
          autoMapFields(headers);
        },
        error: (error: Error) => {
          console.error('CSV読み込みエラー:', error);
          alert('CSVファイルの読み込みに失敗しました。');
        }
      });
    };
    reader.onerror = () => {
      alert('ファイルの読み込みに失敗しました。');
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // Normalize string for comparison (remove all whitespace)
  const normalizeString = (str: string): string => {
    return str.replace(/[\s\u3000]+/g, '').toLowerCase();
  };

  // Auto-map CSV columns to field keys
  const autoMapFields = useCallback((headers: string[]) => {
    if (!fieldConfigs || fieldConfigs.length === 0) {
      console.log('autoMapFields: fieldConfigs not loaded yet', { fieldConfigsLength: fieldConfigs?.length });
      return;
    }

    console.log('autoMapFields: processing', { headers, fieldConfigsLength: fieldConfigs.length });
    console.log('Available field labels:', fieldConfigs.map(f => f.label));

    const mappings: ExistingFieldMapping[] = [];
    const detectedNewFields: NewFieldConfig[] = [];

    headers.forEach(header => {
      if (!header || header.trim() === '') return;

      // 日付列は特別処理
      if (header.toLowerCase().includes('日付') || header.toLowerCase().includes('date')) {
        return; // 日付列はマッピングしない
      }

      const normalizedHeader = normalizeString(header);

      // 既存のフィールドとマッチング（スペースを除去して比較）
      // 自動計算項目（isCalculated: true）はスキップ
      const matchedField = fieldConfigs.find(field => {
        // 自動計算項目はマッチング対象外
        if (field.isCalculated) return false;

        const normalizedLabel = normalizeString(field.label);
        const normalizedKey = normalizeString(field.key);

        return (
          normalizedLabel === normalizedHeader ||
          normalizedKey === normalizedHeader ||
          normalizedHeader.includes(normalizedLabel) ||
          normalizedLabel.includes(normalizedHeader)
        );
      });

      if (matchedField) {
        console.log(`Matched: "${header}" -> "${matchedField.label}" (${matchedField.key})`);
      } else {
        // 自動計算項目とマッチしたかチェック（新規項目として扱わないため）
        const calculatedMatch = fieldConfigs.find(field => {
          if (!field.isCalculated) return false;
          const normalizedLabel = normalizeString(field.label);
          return normalizedLabel === normalizedHeader || normalizedHeader.includes(normalizedLabel);
        });
        if (calculatedMatch) {
          console.log(`Skipped (calculated): "${header}" -> "${calculatedMatch.label}"`);
          return; // 自動計算項目は新規項目としても追加しない
        }
        console.log(`No match for: "${header}" (normalized: "${normalizedHeader}")`);
      }

      if (matchedField) {
        mappings.push({
          csvColumn: header,
          fieldKey: matchedField.key,
          fieldLabel: matchedField.label,
          include: true // デフォルトで含める
        });
      } else {
        // 新しい項目として検出
        const fieldKey = header.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '_');
        detectedNewFields.push({
          csvColumn: header,
          fieldKey: fieldKey,
          fieldLabel: header,
          fieldType: 'number', // デフォルトは数値
          include: false // デフォルトは追加しない
        });
      }
    });

    console.log('autoMapFields: results', { mappings: mappings.length, newFields: detectedNewFields.length });
    setExistingFieldMappings(mappings);
    setNewFields(detectedNewFields);
  }, [fieldConfigs]);

  // Re-run auto mapping when fieldConfigs become available (after CSV is already loaded)
  React.useEffect(() => {
    if (csvHeaders.length > 0 && fieldConfigs && fieldConfigs.length > 0) {
      console.log('Re-running autoMapFields because fieldConfigs loaded');
      autoMapFields(csvHeaders);
    }
  }, [fieldConfigs, csvHeaders, autoMapFields]);

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

      // 数値項目の検証（含める項目のみ）
      existingFieldMappings.filter(m => m.include).forEach(mapping => {
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
  }, [csvData, csvHeaders, existingFieldMappings]);

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'テンプレートのダウンロードに失敗しました。';
      console.error('テンプレートダウンロードエラー:', error);
      alert(errorMessage);
    }
  }, [selectedStoreId, businessTypeId]);

  // Show confirmation modal before upload
  const handleShowConfirmation = useCallback(() => {
    // Validate first
    const errors = validateCsvData();
    if (errors.length > 0) {
      setValidationErrors(errors);
      alert(`CSVデータにエラーがあります（${errors.length}件）。詳細を確認してください。`);
      return;
    }
    setValidationErrors([]);
    setShowConfirmModal(true);
  }, [validateCsvData]);

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

    setIsUploading(true);
    setUploadResult(null);
    setShowConfirmModal(false);

    try {
      // Convert CSV data to the format expected by the API
      const dateColumnIndex = csvHeaders.findIndex(h =>
        h.toLowerCase().includes('日付') || h.toLowerCase().includes('date')
      );

      const processedData: Record<string, Record<string, unknown>> = {};

      csvData.forEach(row => {
        const dateValue = row[csvHeaders[dateColumnIndex]];
        const date = parseCsvDate(String(dateValue));
        if (!date) return;

        const dayOfMonth = date.getDate();
        const dayData: Record<string, unknown> = {
          date: formatDateForCsv(date),
          dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
        };

        // Map existing fields (only included ones)
        existingFieldMappings.filter(m => m.include).forEach(mapping => {
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

        // Include selected new fields
        newFields.filter(f => f.include).forEach(field => {
          const value = row[field.csvColumn];
          if (value !== undefined && value !== null && value !== '') {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
              dayData[field.fieldKey] = numValue;
            } else {
              dayData[field.fieldKey] = String(value);
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

      // Build fieldMapping from included existing fields
      const fieldMapping = existingFieldMappings
        .filter(m => m.include)
        .reduce((acc, m) => {
          acc[m.csvColumn] = m.fieldKey;
          return acc;
        }, {} as Record<string, string>);

      const response = await fetch(`${apiBase}/sales/csv-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          storeId: parseInt(selectedStoreId),
          csvData: JSON.stringify(processedData),
          fieldMapping,
          newFields: newFields.filter(f => f.include),
          overwriteExisting
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'データのアップロードに失敗しました。';
      console.error('アップロードエラー:', error);
      setUploadResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedStoreId, csvData, csvHeaders, existingFieldMappings, newFields, overwriteExisting, router]);

  // Toggle existing field inclusion
  const toggleExistingField = useCallback((csvColumn: string) => {
    setExistingFieldMappings(prev => prev.map(m =>
      m.csvColumn === csvColumn
        ? { ...m, include: !m.include }
        : m
    ));
  }, []);

  // Toggle new field inclusion
  const toggleNewField = useCallback((csvColumn: string) => {
    setNewFields(prev => prev.map(f =>
      f.csvColumn === csvColumn
        ? { ...f, include: !f.include }
        : f
    ));
  }, []);

  // Select/deselect all existing fields
  const toggleAllExistingFields = useCallback((include: boolean) => {
    setExistingFieldMappings(prev => prev.map(m => ({ ...m, include })));
  }, []);

  // Preview data
  const previewData = useMemo(() => {
    return csvData.slice(0, previewRows);
  }, [csvData, previewRows]);

  // Counts
  const includedExistingCount = useMemo(() => {
    return existingFieldMappings.filter(m => m.include).length;
  }, [existingFieldMappings]);

  const includedNewFieldsCount = useMemo(() => {
    return newFields.filter(f => f.include).length;
  }, [newFields]);

  // Check if any fields are selected for import
  const hasFieldsToImport = includedExistingCount > 0 || includedNewFieldsCount > 0;

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
            <li>インポートする項目を選択します</li>
            <li>「確認してアップロード」ボタンをクリックして確認画面へ進みます</li>
          </ol>
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

        {/* Date Column Info */}
        {csvHeaders.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-blue-800">
                日付列: <strong>{csvHeaders.find(h => h.toLowerCase().includes('日付') || h.toLowerCase().includes('date')) || '（検出されませんでした）'}</strong>
                （自動的に処理されます）
              </span>
            </div>
          </div>
        )}

        {/* Existing Fields Section */}
        {existingFieldMappings.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Database className="w-5 h-5 text-green-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  既存項目へのインポート
                </h2>
                <span className="ml-3 px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                  {includedExistingCount} / {existingFieldMappings.length} 選択中
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleAllExistingFields(true)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  すべて選択
                </button>
                <button
                  onClick={() => toggleAllExistingFields(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  すべて解除
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              CSVの列名と一致した既存の項目です。チェックを入れた項目のデータがインポートされます。
            </p>
            <div className="space-y-2">
              {existingFieldMappings.map(mapping => (
                <label
                  key={mapping.csvColumn}
                  className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${
                    mapping.include
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={mapping.include}
                    onChange={() => toggleExistingField(mapping.csvColumn)}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <div className="ml-3 flex items-center flex-1">
                    <span className="font-medium text-gray-900">{mapping.csvColumn}</span>
                    <ArrowRight className={`w-4 h-4 mx-3 ${mapping.include ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className={mapping.include ? 'text-green-700' : 'text-gray-500'}>
                      {mapping.fieldLabel}
                    </span>
                  </div>
                  {mapping.include && (
                    <span className="text-sm text-green-600">インポート</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* New Fields Section */}
        {newFields.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <Sparkles className="w-5 h-5 text-purple-600 mr-2" />
              <h2 className="text-lg font-semibold text-purple-900">
                新規項目の追加
              </h2>
              <span className="ml-3 px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                {includedNewFieldsCount} / {newFields.length} 選択中
              </span>
            </div>
            <p className="text-sm text-purple-800 mb-4">
              CSVに含まれる以下の列は、現在のシステムに存在しない新しい項目です。
              チェックを入れると、新規項目としてシステムに追加されます。
            </p>
            <div className="space-y-2">
              {newFields.map(field => (
                <label
                  key={field.csvColumn}
                  className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${
                    field.include
                      ? 'bg-purple-100 border-purple-300'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={field.include}
                    onChange={() => toggleNewField(field.csvColumn)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="ml-3 flex items-center flex-1">
                    <span className="font-medium text-gray-900">{field.csvColumn}</span>
                    {field.include && (
                      <>
                        <Plus className="w-4 h-4 mx-2 text-purple-500" />
                        <span className="text-purple-700 text-sm">新規項目として追加</span>
                      </>
                    )}
                  </div>
                  {field.include && (
                    <span className="text-sm text-purple-600">追加予定</span>
                  )}
                </label>
              ))}
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
                setExistingFieldMappings([]);
                setNewFields([]);
                setValidationErrors([]);
                setUploadResult(null);
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              リセット
            </button>
            <button
              onClick={handleShowConfirmation}
              disabled={isUploading || !selectedStoreId || !hasFieldsToImport}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors inline-flex items-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              確認してアップロード
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">インポート内容の確認</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">インポート概要</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span className="text-gray-600">対象店舗:</span>
                    <span className="font-medium">{selectedStore?.name}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-600">データ行数:</span>
                    <span className="font-medium">{csvData.length}行</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-600">既存項目:</span>
                    <span className="font-medium text-green-700">{includedExistingCount}項目</span>
                  </li>
                  {includedNewFieldsCount > 0 && (
                    <li className="flex justify-between">
                      <span className="text-gray-600">新規追加項目:</span>
                      <span className="font-medium text-purple-700">{includedNewFieldsCount}項目</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Existing Fields to Import */}
              {includedExistingCount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-900 mb-2 flex items-center">
                    <Database className="w-4 h-4 mr-2" />
                    インポートする既存項目
                  </h3>
                  <ul className="space-y-1">
                    {existingFieldMappings.filter(m => m.include).map(mapping => (
                      <li key={mapping.csvColumn} className="text-sm text-green-800 flex items-center">
                        <Check className="w-3 h-3 mr-2" />
                        {mapping.csvColumn} → {mapping.fieldLabel}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* New Fields */}
              {includedNewFieldsCount > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-medium text-purple-900 mb-2 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    追加される新規項目
                  </h3>
                  <ul className="space-y-1">
                    {newFields.filter(f => f.include).map(field => (
                      <li key={field.csvColumn} className="text-sm text-purple-800 flex items-center">
                        <Plus className="w-3 h-3 mr-2" />
                        {field.csvColumn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Overwrite Option */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">既存データの処理</h3>
                <div className="space-y-3">
                  <label className={`flex items-start p-3 rounded-lg cursor-pointer border transition-colors ${
                    overwriteExisting ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="overwrite"
                      checked={overwriteExisting}
                      onChange={() => setOverwriteExisting(true)}
                      className="mt-0.5 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                    />
                    <div className="ml-3">
                      <div className="flex items-center">
                        <RefreshCw className="w-4 h-4 text-orange-600 mr-2" />
                        <span className="font-medium text-gray-900">上書きする</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        同じ日付のデータがある場合、CSVの値で上書きします
                      </p>
                    </div>
                  </label>
                  <label className={`flex items-start p-3 rounded-lg cursor-pointer border transition-colors ${
                    !overwriteExisting ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="overwrite"
                      checked={!overwriteExisting}
                      onChange={() => setOverwriteExisting(false)}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <div className="flex items-center">
                        <Plus className="w-4 h-4 text-blue-600 mr-2" />
                        <span className="font-medium text-gray-900">スキップする</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        同じ日付のデータがある場合、インポートをスキップします
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Warning */}
              {overwriteExisting && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      <strong>注意:</strong> 上書きモードでは、既存のデータが失われる可能性があります。重要なデータがある場合は事前にバックアップを取ってください。
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors inline-flex items-center"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    処理中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    インポート実行
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
