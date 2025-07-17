import React, { useState, useEffect } from 'react';
import { BusinessType, StoreMonthlyData, MonthlyData, Field, ProfitData } from '../../types/monthly-sales';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/calculations';
import { Edit2, Plus, Calendar, Building, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useStoreStore } from '../../stores/storeStore';

interface StoreMonthlyDataTableProps {
  businessTypes: BusinessType[];
  storeData: StoreMonthlyData[];
  onDataChange: (storeData: StoreMonthlyData[]) => void;
  onEditData: (data: MonthlyData, storeId: string, businessTypeId: string) => void;
}

export const StoreMonthlyDataTable: React.FC<StoreMonthlyDataTableProps> = ({
  businessTypes, 
  storeData,
  onEditData,
}) => {
  const { user, isSuperAdmin } = useAuthStore();
  const { stores } = useStoreStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['sales', 'customer', 'profit']));
  
  // 管理者の場合は自分の店舗、総管理者の場合は選択可能
  const availableStores = isSuperAdmin() ? stores : stores.filter(store => store.id === user?.storeId);
  
  useEffect(() => {
    if (availableStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(availableStores[0].id);
    }
  }, [availableStores, selectedStoreId]);

  const selectedStore = availableStores.find(store => store.id === selectedStoreId);
  const currentStoreData = storeData.find(sd => sd.storeId === selectedStoreId);
  const businessType = selectedStore && businessTypes.find(bt => bt.id === selectedStore.businessTypeId);

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

  const currentYearData = currentStoreData?.monthlyData.filter(data => data.year === selectedYear) || [];
  
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
    return currentYearData.find(data => data.month === month) || null;
  };

  const createNewDataForMonth = (month: number) => {
    if (!selectedStore || !businessType) return;
    
    const newData: MonthlyData = {
      id: Date.now().toString(),
      storeId: selectedStoreId,
      businessTypeId: businessType.id,
      year: selectedYear,
      month,
      data: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    onEditData(newData, selectedStoreId, businessType.id);
  };

  const getAvailableYears = () => {
    const years = currentYearData.map(data => data.year);
    const uniqueYears = [...new Set(years)].sort((a, b) => b - a);
    if (!uniqueYears.includes(selectedYear)) {
      uniqueYears.push(selectedYear);
      uniqueYears.sort((a, b) => b - a);
    }
    return uniqueYears;
  };

  const getCategoryFields = (category: string) => {
    if (!businessType) return [];
    return businessType.fields.filter(field => field.category === category).sort((a, b) => a.order - b.order);
  };

  const fieldCategories = businessType ? [...new Set(businessType.fields.map(field => field.category))] : [];

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

  // 損益管理データからの自動反映（模擬実装）
  const getProfitDataFromPL = (month: number): ProfitData | null => {
    // 実際には損益管理APIから取得
    // ここでは模擬データを返す
    if (!selectedStoreId) return null;
    
    return {
      storeId: selectedStoreId,
      year: selectedYear,
      month,
      actualProfit: Math.floor(Math.random() * 2000000) + 500000,
      expectedProfit: Math.floor(Math.random() * 2000000) + 500000,
      profitRate: Math.random() * 20 + 10,
    };
  };

  const getValueWithProfitIntegration = (value: string | number | null | undefined, field: Field, month: number): string | number | null | undefined => {
    // 利益関連項目で損益管理データと連携
    if (field.category === 'profit') {
      const profitData = getProfitDataFromPL(month);
      if (profitData) {
        switch (field.name) {
          case '償却前利益額（実績）':
            return profitData.actualProfit;
          case '償却前利益額（見込）':
            return profitData.expectedProfit;
          case '利益率':
            return profitData.profitRate;
          default:
            return value;
        }
      }
    }
    return value;
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

  if (!businessType) {
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
        <h4 className="text-2xl font-bold text-gray-900 mb-4">業態設定が必要です</h4>
        <p className="text-gray-500 text-lg">
          選択された店舗の業態に対応する項目設定がありません。<br />
          総管理者に業態設定を依頼してください。
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
              {businessType.name} | Monthly Performance Analytics
            </p>
          </div>
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
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            )}
            
            {/* Year Selector */}
            <div className="flex items-center space-x-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200">
              <Calendar className="w-5 h-5 text-blue-500" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent border-none focus:ring-0 text-gray-900 font-semibold cursor-pointer"
              >
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}年度</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400" />
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
                    {category === 'profit' && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        損益連携
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
                      {fields.map((field, index) => (
                        <tr key={field.id} className={`hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
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
                                
                                {field.category === 'profit' && ['償却前利益額（実績）', '償却前利益額（見込）', '利益率'].includes(field.name) && (
                                  <div className="flex-shrink-0">
                                    <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs font-medium rounded-full">
                                      自動
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {months.map((month) => {
                            const monthData = getDataForMonth(month.value);
                            const rawValue = monthData?.data[field.id];
                            const value = getValueWithProfitIntegration(rawValue, field, month.value);
                            const hasData = monthData && Object.keys(monthData.data).length > 0;
                            const isAutoCalculated = field.category === 'profit' && ['償却前利益額（実績）', '償却前利益額（見込）', '利益率'].includes(field.name);
                            
                            return (
                              <td key={month.value} className="px-4 py-2 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <span className={`text-xs font-medium ${
                                    value !== undefined && value !== '' 
                                      ? isAutoCalculated 
                                        ? 'text-green-700' 
                                        : 'text-gray-900'
                                      : 'text-gray-400'
                                  }`}>
                                    {formatValue(value, field)}
                                  </span>
                                  <div className="flex space-x-1">
                                    {!hasData && !isAutoCalculated && (
                                      <button
                                        onClick={() => createNewDataForMonth(month.value)}
                                        className="group p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-all duration-200 hover:scale-110"
                                        title="データを追加"
                                      >
                                        <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-200" />
                                      </button>
                                    )}
                                    {hasData && !field.isCalculated && !isAutoCalculated && (
                                      <button
                                        onClick={() => onEditData(monthData, selectedStoreId, businessType.id)}
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