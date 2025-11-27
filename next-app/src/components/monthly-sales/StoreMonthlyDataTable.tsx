import React, { useState, useEffect, useCallback } from 'react';
import { Field, StoreMonthlyData, MonthlyData, StoreFieldVisibility, DEFAULT_FIELDS } from '../../types/monthly-sales';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/calculations';
import { Edit2, Plus, Building, ChevronDown, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useStoreStore } from '../../stores/storeStore';
import { formatStoreName, sortStoresByBusinessType } from '../../utils/storeDisplay';
import { useLocalStorage } from '../../hooks/useLocalStorage';

// 売上管理フィールド → 月次売上管理フィールドのマッピング
const SALES_TO_MONTHLY_FIELD_MAP: Record<string, string> = {
  // 売上関連
  'netSales': '店舗純売上',
  'edwNetSales': 'EDW純売上',
  'ohbNetSales': 'OHB純売上',
  'salesTarget': '売上目標',

  // 客数・組数
  'totalGroups': '組数（計）',
  'totalCustomers': '客数（計）',
  'groupUnitPrice': '組単価',
  'customerUnitPrice': '客単価',

  // 人件費
  'laborCost': '人件費額',
  'laborCostRate': '人件費率',
  'employeeHours': '社員時間',
  'asHours': 'AS時間',

  // L/D売上
  'lunchSales': 'L：売上',
  'dinnerSales': 'D：売上',
  'lunchCustomers': 'L：客数',
  'dinnerCustomers': 'D：客数',
  'lunchGroups': 'L：組数',
  'dinnerGroups': 'D：組数',
  'lunchUnitPrice': 'L：単価',
  'dinnerUnitPrice': 'D：単価',

  // VOID
  'voidCount': 'VOID件数',
  'voidAmount': 'VOID金額',
  'salesDiscrepancy': '売上金過不足',

  // 生産性
  'totalHours': '総時間社員込',
  'edwBaitHours': 'EDW総時間',
  'ohbBaitHours': 'OHB総時間',
  'edwProductivity': 'EDW生産性',
  'ohbProductivity': 'OHB生産性',
  'totalProductivity': '総生産性',

  // アンケート
  'surveyCount': 'アンケート取得枚数',
  'surveyRate': 'アンケート取得率',

  // OHB予約関連
  'reservationCount': '予約件数',
  'plain': 'プレーン',
  'junsei': '純生',
  'seasonal': '季節',

  // 対比
  'targetRatio': '対目標比',
  'yearOverYear': '前年比',
  'edwYearOverYear': 'EDW前年比',
  'ohbYearOverYear': 'OHB前年比',
};

// 売上管理の累計データの型
interface SalesMonthlySummary {
  year: number;
  month: number;
  storeId: string;
  summary: Record<string, number>;
  dataCount: number;
}

interface StoreMonthlyDataTableProps {
  storeData: StoreMonthlyData[];
  onDataChange: (storeData: StoreMonthlyData[]) => void;
  onEditData: (data: MonthlyData, storeId: string, businessTypeId: string) => void;
}

export const StoreMonthlyDataTable: React.FC<StoreMonthlyDataTableProps> = ({
  storeData,
  onEditData,
}) => {
  const { user, isSuperAdmin } = useAuthStore();
  const { stores } = useStoreStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['sales', 'customer', 'profit']));

  // 売上管理の月間累計データのキャッシュ (月別)
  const [salesSummaryCache, setSalesSummaryCache] = useState<Record<string, SalesMonthlySummary | null>>({});
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  // Get master fields from localStorage (shared across all stores)
  // Initialize with DEFAULT_FIELDS, adding IDs based on order field
  const defaultFields: Field[] = DEFAULT_FIELDS.map((field) => ({
    ...field,
    id: `default-${field.order}`,
  }));

  const [masterFields] = useLocalStorage<Field[]>('monthly-sales-master-fields', defaultFields);

  // Get per-store visibility settings from localStorage
  const [storeVisibilitySettings] = useLocalStorage<StoreFieldVisibility[]>(
    'store-field-visibility',
    []
  );

  // Get available stores based on user role
  // Super Adminは全店舗、それ以外は自分の店舗のみ
  // storesが空の場合はそのまま空配列
  const availableStores = React.useMemo(() => {
    if (stores.length === 0) return [];
    // 「無所属」と「Manager」を除外
    const filteredStores = stores.filter(store =>
      store.name !== '無所属' && store.name !== 'Manager'
    );
    if (isSuperAdmin()) {
      return sortStoresByBusinessType(filteredStores);
    }
    return filteredStores.filter(store => store.id === user?.storeId);
  }, [stores, user?.storeId, isSuperAdmin]);

  useEffect(() => {
    if (availableStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(availableStores[0].id);
    }
  }, [availableStores, selectedStoreId]);

  // 選択された店舗（storesから直接検索してフォールバック）
  const selectedStore = React.useMemo(() => {
    return availableStores.find(store => store.id === selectedStoreId)
      || stores.find(store => store.id === selectedStoreId);
  }, [availableStores, stores, selectedStoreId]);

  // API Base URL（api.tsと同じロジックを使用）
  const getApiBaseUrl = useCallback(() => {
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
  }, []);

  // 売上管理の月間累計データを取得
  const fetchSalesMonthlySummary = useCallback(async (storeId: string, year: number, month: number): Promise<SalesMonthlySummary | null> => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const apiBase = getApiBaseUrl();

      if (!token) {
        console.warn('認証トークンが見つかりません');
      }

      const response = await fetch(`${apiBase}/sales/monthly-summary?year=${year}&month=${month}&storeId=${storeId}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[fetchSalesMonthlySummary] API response for ${year}/${month}:`, data);
        if (data.success && data.data) {
          return data.data;
        } else {
          console.warn(`[fetchSalesMonthlySummary] No data returned for ${year}/${month}:`, data);
        }
      } else {
        console.error(`API error: ${response.status} ${response.statusText}`);
      }
      return null;
    } catch (error) {
      console.error('売上管理累計データ取得エラー:', error);
      return null;
    }
  }, [getApiBaseUrl]);

  // 店舗・年が変わったら全月のデータを取得
  useEffect(() => {
    if (!selectedStoreId) return;

    const loadAllMonthsData = async () => {
      setLoadingSummary(true);
      const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const newCache: Record<string, SalesMonthlySummary | null> = {};

      await Promise.all(
        months.map(async (month) => {
          const cacheKey = `${selectedStoreId}-${selectedYear}-${month}`;
          const summary = await fetchSalesMonthlySummary(selectedStoreId, selectedYear, month);
          newCache[cacheKey] = summary;
        })
      );

      setSalesSummaryCache(prev => ({ ...prev, ...newCache }));
      setLoadingSummary(false);
    };

    loadAllMonthsData();
  }, [selectedStoreId, selectedYear, fetchSalesMonthlySummary]);

  const currentStoreData = storeData.find(sd => sd.storeId === selectedStoreId);

  // Get visible fields for current store
  const getVisibleFields = (): Field[] => {
    try {
      const settings = storeVisibilitySettings.find(s => s.storeId === selectedStoreId);
      if (settings && settings.visibleFieldIds && settings.visibleFieldIds.length > 0) {
        // Filter master fields by visibility settings
        return safeMasterFields.filter(field => field && field.id && settings.visibleFieldIds.includes(field.id));
      }
      // Default: show all fields if no visibility setting exists
      return safeMasterFields;
    } catch (error) {
      console.error('Error in getVisibleFields:', error);
      return safeMasterFields;
    }
  };

  const visibleFields = getVisibleFields();
  
  // Ensure visibleFields is always an array and fields have valid IDs
  const safeVisibleFields = (visibleFields || []).filter(field => {
    if (!field || !field.id) {
      console.warn('Invalid field found:', field);
      return false;
    }
    return true;
  });

  // 6月から始まる月の配列
  const months = [
    { name: '6月', value: 6, color: 'from-emerald-400 to-teal-500' },
    { name: '7月', value: 7, color: 'from-blue-400 to-cyan-500' },
    { name: '8月', value: 8, color: 'from-purple-400 to-violet-500' },
    { name: '9月', value: 9, color: 'from-orange-400 to-amber-500' },
    { name: '10月', value: 10, color: 'from-red-400 to-pink-500' },
    { name: '11月', value: 11, color: 'from-indigo-400 to-blue-500' },
    { name: '12月', value: 12, color: 'from-rose-400 to-red-500' },
    { name: '1月', value: 1, color: 'from-slate-400 to-gray-500' },
    { name: '2月', value: 2, color: 'from-pink-400 to-rose-500' },
    { name: '3月', value: 3, color: 'from-green-400 to-emerald-500' },
    { name: '4月', value: 4, color: 'from-yellow-400 to-orange-500' },
    { name: '5月', value: 5, color: 'from-teal-400 to-green-500' },
  ];

  // Safely get current year data with null checks
  const currentYearData = currentStoreData?.monthlyData?.filter(data => data && data.year === selectedYear) || [];

  const formatValue = (value: string | number | null | undefined, field: Field): string => {
    if (value === undefined || value === null || value === '') return '-';

    switch (field.type) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return formatPercentage(value);
      case 'count':
      case 'number':
        return formatNumber(value);
      case 'text':
        return String(value);
      default:
        return String(value);
    }
  };

  const getDataForMonth = (month: number): MonthlyData | null => {
    if (!currentYearData || !Array.isArray(currentYearData)) {
      return null;
    }
    const found = currentYearData.find(data => data && data.month === month);
    return found || null;
  };

  const createNewDataForMonth = (month: number) => {
    if (!selectedStore) return;

    const newData: MonthlyData = {
      id: Date.now().toString(),
      storeId: selectedStoreId,
      businessTypeId: selectedStore.businessTypeId || '',
      year: selectedYear,
      month,
      data: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    onEditData(newData, selectedStoreId, selectedStore.businessTypeId || '');
  };

  const getCategoryFields = (category: string) => {
    try {
      return safeVisibleFields.filter(field => {
        if (!field || !field.id) {
          return false;
        }
        return field.category === category;
      }).sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      console.error('Error in getCategoryFields:', error);
      return [];
    }
  };

  const fieldCategories = [...new Set(safeVisibleFields.map(field => field && field.category).filter(Boolean))];

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryName = (category: string): string => {
    const categoryNames: Record<string, string> = {
      sales: '売上関連',
      customer: '客数・客単価',
      profit: '利益関連',
      operations: '運営関連',
      inventory: '在庫・原価',
      marketing: 'マーケティング',
      staff: '人事・労務',
      other: 'その他'
    };
    return categoryNames[category] || category;
  };

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

  // 売上管理データからフィールド名でマッピングして値を取得
  const getValueFromSalesData = (fieldName: string, month: number): number | null => {
    const cacheKey = `${selectedStoreId}-${selectedYear}-${month}`;
    const summary = salesSummaryCache[cacheKey];

    if (!summary) {
      console.log(`[getValueFromSalesData] No cache for ${cacheKey}`);
      return null;
    }

    if (!summary.summary) {
      console.log(`[getValueFromSalesData] No summary in cache for ${cacheKey}:`, summary);
      return null;
    }

    // フィールドマッピングから対応するsummaryキーを逆引き
    for (const [salesKey, monthlyFieldName] of Object.entries(SALES_TO_MONTHLY_FIELD_MAP)) {
      if (monthlyFieldName === fieldName) {
        const value = summary.summary[salesKey];
        if (value !== undefined && value !== null && !isNaN(value)) {
          return value;
        }
      }
    }
    return null;
  };

  // 売上管理データと連携してフィールドの値を取得
  const getValueWithSalesIntegration = (value: string | number | null | undefined, field: Field, month: number): string | number | null | undefined => {
    // 売上管理データにマッピングされたフィールドかチェック
    const salesValue = getValueFromSalesData(field.name, month);
    if (salesValue !== null) {
      return salesValue;
    }
    return value;
  };

  // フィールドが売上管理データから自動反映されるかどうか
  const isAutoFromSales = (fieldName: string): boolean => {
    return Object.values(SALES_TO_MONTHLY_FIELD_MAP).includes(fieldName);
  };

  if (!selectedStore) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-16 text-center">
        <div className="text-gray-400 mb-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl blur opacity-25"></div>
            <div className="relative bg-gradient-to-r from-blue-500 to-indigo-500 p-6 rounded-2xl">
              <Building className="w-16 h-16 text-white mx-auto" />
            </div>
          </div>
        </div>
        <h4 className="text-2xl font-bold text-gray-900 mb-4">店舗が見つかりません</h4>
        <p className="text-gray-500 text-lg">
          アクセス権限のある店舗がありません。
        </p>
      </div>
    );
  }

  if (visibleFields.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-16 text-center">
        <div className="text-gray-400 mb-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-400 rounded-2xl blur opacity-25"></div>
            <div className="relative bg-gradient-to-r from-orange-500 to-red-500 p-6 rounded-2xl">
              <Building className="w-16 h-16 text-white mx-auto" />
            </div>
          </div>
        </div>
        <h4 className="text-2xl font-bold text-gray-900 mb-4">表示項目が設定されていません</h4>
        <p className="text-gray-500 text-lg">
          選択された店舗の表示項目設定を確認してください。<br />
          総管理者に項目表示設定を依頼してください。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-8 border-b border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="mb-6 lg:mb-0">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {selectedStore.name} - 月次データ
            </h3>
            <p className="text-gray-600 font-medium">
              Monthly Performance Analytics | {visibleFields.length}項目表示中
            </p>
          </div>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              {/* Store Selector (Super Admin Only) */}
              {isSuperAdmin() && availableStores.length > 1 && (
                <div className="flex items-center space-x-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200 min-w-48">
                  <Building className="w-5 h-5 text-blue-500" />
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-gray-900 font-semibold cursor-pointer flex-1"
                  >
                    {availableStores.map(store => (
                      <option key={store.id} value={store.id}>{formatStoreName(store)}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>

            {/* Year Selector */}
            <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-3">
                <label className="text-sm font-semibold text-gray-700">年:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-transparent border-none focus:ring-0 text-gray-900 font-semibold cursor-pointer"
                >
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() - 5 + i;
                    return (
                      <option key={year} value={year}>
                        {year}年
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        {fieldCategories.map(category => {
          const fields = getCategoryFields(category);
          if (fields.length === 0) return null;
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="border-b border-gray-100 last:border-b-0">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full bg-gradient-to-r from-gray-50 to-slate-50 hover:from-gray-100 hover:to-slate-100 px-8 py-4 text-left transition-all duration-200 border-b border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{getCategoryIcon(category)}</span>
                    <h4 className="font-bold text-gray-800 text-lg">{getCategoryName(category)}</h4>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {fields.length}項目
                    </span>
                    {fields.some(f => isAutoFromSales(f.name)) && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        売上連携
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Category Content */}
              {isExpanded && (
                <div className="overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <tr>
                        <th className="px-8 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-blue-50 to-indigo-50 z-10 border-r border-blue-100">
                          項目名
                        </th>
                        {months.map((month) => (
                          <th key={month.value} className="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider min-w-24">
                            {month.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {fields.filter(field => {
                        if (!field || !field.id) {
                          console.warn('Invalid field found:', field);
                          return false;
                        }
                        return true;
                      }).map((field, index) => {
                        if (!field || !field.id) {
                          console.error('Field without id in map:', field);
                          return null;
                        }
                        return (
                        <tr key={field.id || `field-${index}`} className={`hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white border-r border-gray-100 z-10">
                            <div className="flex items-center space-x-4">
                              <div className="w-1.5 h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full flex-shrink-0"></div>
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <span className="text-xs font-semibold text-gray-900 truncate">{field.name}</span>

                                {field.unit && (
                                  <div className="flex-shrink-0">
                                    <span className="text-gray-400 text-xs">{field.unit}</span>
                                  </div>
                                )}

                                {isAutoFromSales(field.name) && (
                                  <div className="flex-shrink-0">
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                                      売上連携
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {months.map((month) => {
                            try {
                              const monthData = getDataForMonth(month.value);
                              // Ensure monthData.data exists and is an object, and field.id exists
                              if (!field || !field.id) {
                                return (
                                  <td key={month.value} className="px-4 py-2 whitespace-nowrap text-center">
                                    <span className="text-gray-400">-</span>
                                  </td>
                                );
                              }
                              // Safely get monthData.data with multiple fallbacks
                              let monthDataData: Record<string, any> = {};
                              try {
                                if (monthData && monthData.data) {
                                  if (typeof monthData.data === 'object' && !Array.isArray(monthData.data)) {
                                    monthDataData = monthData.data;
                                  }
                                }
                              } catch (e) {
                                console.warn(`Error accessing monthData.data for month ${month.value}:`, e);
                                monthDataData = {};
                              }
                              
                              // Double-check monthDataData is an object before accessing
                              if (!monthDataData || typeof monthDataData !== 'object' || Array.isArray(monthDataData)) {
                                monthDataData = {};
                              }
                              
                              // Ensure monthDataData is not undefined before accessing field.id
                              let rawValue: any = undefined;
                              try {
                                // Triple-check monthDataData is a valid object
                                if (monthDataData && 
                                    typeof monthDataData === 'object' && 
                                    !Array.isArray(monthDataData) && 
                                    monthDataData !== null &&
                                    field && 
                                    field.id) {
                                  rawValue = monthDataData[field.id];
                                } else {
                                  // If monthDataData is invalid, set to empty object
                                  monthDataData = {};
                                  rawValue = undefined;
                                }
                              } catch (e) {
                                console.warn(`Error accessing monthDataData[${field?.id || 'unknown'}] for month ${month.value}:`, e);
                                monthDataData = {};
                                rawValue = undefined;
                              }
                              const value = getValueWithSalesIntegration(rawValue, field, month.value);
                              const hasData = monthData && monthData.data && typeof monthData.data === 'object' && Object.keys(monthData.data).length > 0;
                              const isAutoField = isAutoFromSales(field.name);
                              const hasSalesValue = getValueFromSalesData(field.name, month.value) !== null;

                              return (
                              <td key={month.value} className="px-4 py-2 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  {loadingSummary && isAutoField ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                  ) : (
                                    <span className={`text-xs font-medium ${
                                      value !== undefined && value !== '' && value !== null
                                        ? hasSalesValue
                                          ? 'text-blue-700'
                                          : 'text-gray-900'
                                        : 'text-gray-400'
                                    }`}>
                                      {formatValue(value, field)}
                                    </span>
                                  )}
                                  <div className="flex space-x-1">
                                    {!hasData && !isAutoField && (
                                      <button
                                        onClick={() => createNewDataForMonth(month.value)}
                                        className="group p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-all duration-200 hover:scale-110"
                                        title="データを追加"
                                      >
                                        <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-200" />
                                      </button>
                                    )}
                                    {hasData && !field.isCalculated && !isAutoField && (
                                      <button
                                        onClick={() => onEditData(monthData, selectedStoreId, selectedStore.businessTypeId || '')}
                                        className="group p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110"
                                        title="データを編集"
                                      >
                                        <Edit2 className="w-3 h-3 group-hover:text-blue-500 transition-colors duration-200" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                            } catch (error) {
                              console.error(`Error rendering month ${month.value} for field ${field?.id || 'unknown'}:`, error);
                              return (
                                <td key={month.value} className="px-4 py-2 whitespace-nowrap text-center">
                                  <span className="text-gray-400">-</span>
                                </td>
                              );
                            }
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};