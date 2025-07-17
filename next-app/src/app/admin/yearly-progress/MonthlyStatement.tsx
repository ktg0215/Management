import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Building2, ArrowLeft, ChevronLeft, ChevronRight, Plus, BarChart3 } from 'lucide-react';
import apiClient from '@/lib/api';
import type { PLItem } from './PLCreate';

const monthNames = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
];

// テーブル用データ型
type SubjectRow = { name: string; estimate: number | null; actual: number | null; isHighlighted: boolean; isSubtotal: boolean };

export default function MonthlyStatement() {
  const router = useRouter();
  const params = useParams() as Record<string, string | undefined>;
  const [currentDate, setCurrentDate] = useState<{ year: number; month: number } | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const now = new Date();
      setCurrentDate({ year: now.getFullYear(), month: now.getMonth() });
    }
  }, []);
  
  const storeId = params?.storeId ?? '';
  const [loading, setLoading] = useState(true);
  const [plItems, setPlItems] = useState<PLItem[]>([]);
  const [plError, setPlError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    setPlError(null);
    apiClient.getPL(currentDate?.year ?? 2024, currentDate?.month ?? 1, storeId)
      .then(res => {
        if (res.success && res.data && Array.isArray(res.data.items)) {
          setPlItems(res.data.items);
        } else {
          setPlItems([]);
        }
      })
      .catch(() => setPlError('データ取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [currentDate, storeId]);

  if (!storeId) {
    return <div>店舗情報が取得できません。</div>;
  }
  if (loading) {
    return <div>損益データを読み込み中...</div>;
  }
  if (plError) {
    return <div className="text-red-600">{plError}</div>;
  }
  if (!plItems.length) {
    return <div>この月の損益データは登録されていません。</div>;
  }

  // --- PLデータから各値を取得する関数 ---
  const getEstimate = (name: string) => {
    const item = plItems.find(i => i.subject_name === name);
    return item ? item.estimate : 0;
  };
  const getActual = (name: string) => {
    const item = plItems.find(i => i.subject_name === name);
    return item ? item.actual : 0;
  };

  // 主要値
  const netSalesEstimate = getEstimate('売上高');
  const netSalesActual = getActual('売上高');
  const costOfSalesEstimate = getEstimate('売上原価');
  const costOfSalesActual = getActual('売上原価');
  const grossProfitEstimate = getEstimate('粗利益');
  const grossProfitActual = getActual('粗利益');

  // 変動費
  const variableNames = [
    'バイト給与','カードポイント','求人募集費','広告宣伝費','容器包装費','備品消耗品費','車両費'
  ];
  const variableItems: SubjectRow[] = variableNames.map(name => ({
    name,
    estimate: getEstimate(name),
    actual: getActual(name),
    isHighlighted: false,
    isSubtotal: false
  }));
  const variableTotalEstimate = variableItems.reduce((sum, i) => sum + (i.estimate || 0), 0);
  const variableTotalActual = variableItems.reduce((sum, i) => sum + (i.actual || 0), 0);

  // 固定費
  const fixedNames = [
    '従業員給与','ロイヤリティ','地代家賃','修繕費','通信交通費','水道光熱費','保険料','法定福利費','厚生費','管理諸費','リース料','清掃費','雑費'
  ];
  const fixedItems: SubjectRow[] = fixedNames.map(name => ({
    name,
    estimate: getEstimate(name),
    actual: getActual(name),
    isHighlighted: false,
    isSubtotal: false
  }));
  const fixedTotalEstimate = fixedItems.reduce((sum, i) => sum + (i.estimate || 0), 0);
  const fixedTotalActual = fixedItems.reduce((sum, i) => sum + (i.actual || 0), 0);

  // 管理費
  const managementCostEstimate = variableTotalEstimate + fixedTotalEstimate;
  const managementCostActual = variableTotalActual + fixedTotalActual;
  // 償却前利益
  const profitBeforeDepEstimate = grossProfitEstimate - managementCostEstimate;
  const profitBeforeDepActual = grossProfitActual - managementCostActual;
  // 減価償却費
  const depreciationEstimate = getEstimate('減価償却費');
  const depreciationActual = getActual('減価償却費');
  // 営業利益
  const operatingProfitEstimate = profitBeforeDepEstimate - depreciationEstimate;
  const operatingProfitActual = profitBeforeDepActual - depreciationActual;

  const subjectRows: SubjectRow[] = [
    { name: '純売上', estimate: netSalesEstimate, actual: netSalesActual, isHighlighted: false, isSubtotal: false },
    { name: '売上原価', estimate: costOfSalesEstimate, actual: costOfSalesActual, isHighlighted: false, isSubtotal: false },
    { name: '粗利', estimate: grossProfitEstimate, actual: grossProfitActual, isHighlighted: true, isSubtotal: false },
    ...variableItems,
    { name: '変動費', estimate: variableTotalEstimate, actual: variableTotalActual, isHighlighted: false, isSubtotal: true },
    ...fixedItems,
    { name: '固定費', estimate: fixedTotalEstimate, actual: fixedTotalActual, isHighlighted: false, isSubtotal: true },
    { name: '管理費', estimate: managementCostEstimate, actual: managementCostActual, isHighlighted: false, isSubtotal: true },
    { name: '償却前利益', estimate: profitBeforeDepEstimate, actual: profitBeforeDepActual, isHighlighted: true, isSubtotal: false },
    { name: '減価償却費', estimate: depreciationEstimate, actual: depreciationActual, isHighlighted: false, isSubtotal: false },
    { name: '営業利益', estimate: operatingProfitEstimate, actual: operatingProfitActual, isHighlighted: true, isSubtotal: false },
  ];

  // 前月・翌月の計算
  const prevMonth = currentDate?.month === 1 ? 12 : currentDate?.month ?? 1 - 1;
  const prevYear = currentDate?.month === 1 ? currentDate?.year ?? 2024 - 1 : currentDate?.year ?? 2024;
  const nextMonth = currentDate?.month === 12 ? 1 : currentDate?.month ?? 1 + 1;
  const nextYear = currentDate?.month === 12 ? currentDate?.year ?? 2024 + 1 : currentDate?.year ?? 2024;

  const handlePrevMonth = () => {
    router.push(`/admin/yearly-progress/${prevYear}/${prevMonth}`);
  };

  const handleNextMonth = () => {
    router.push(`/admin/yearly-progress/${nextYear}/${nextMonth}`);
  };

  const handleCreatePL = () => {
    router.push('/admin/pl-create');
  };

  const handleViewAnnualTotals = () => {
    router.push('/admin/yearly-progress');
  };

  // 比率取得関数
  const getPercent = (name: string) => {
    const item = plItems.find(i => i.subject_name === name);
    return item?.percentage || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="py-8">
        {/* Action Buttons Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Create P&L Button */}
          <button
            onClick={handleCreatePL}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <Plus className="h-6 w-6" />
            <span className="text-lg">{monthNames[currentDate?.month ?? 0]} 当月損益作成</span>
          </button>

          {/* View Annual Totals Button */}
          <button
            onClick={handleViewAnnualTotals}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <BarChart3 className="h-6 w-6" />
            <span className="text-lg">年間損益を見る</span>
          </button>
        </div>

        {/* Header with Navigation */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              ダッシュボードに戻る
            </button>
            
            <div className="flex items-center gap-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-lg bg-white shadow-md hover:shadow-lg transition-all hover:scale-105"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Building2 className="h-8 w-8 text-blue-600" />
                  <h1 className="text-3xl font-bold text-gray-800">
                    {currentDate?.year}年{monthNames[currentDate?.month ?? 0]} 損益管理表
                  </h1>
                </div>
                <p className="text-gray-600">Monthly Financial Statement</p>
              </div>
              
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg bg-white shadow-md hover:shadow-lg transition-all hover:scale-105"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards - Moved to top */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">純売上高</h3>
            <p className="text-3xl font-bold text-blue-600">¥{netSalesActual.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Net Sales ({getPercent('純売上高')})</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">粗利益</h3>
            <p className="text-3xl font-bold text-green-600">¥{grossProfitActual.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Gross Profit ({getPercent('粗利益')})</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">償却後営業利益</h3>
            <p className="text-3xl font-bold text-purple-600">¥{operatingProfitActual.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Operating Profit ({getPercent('営業利益')})</p>
          </div>
        </div>

        {/* Main Financial Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <th className="text-left py-4 px-6 font-semibold text-lg">項目</th>
                  <th className="text-right py-4 px-6 font-semibold text-lg">見込み</th>
                  <th className="text-right py-4 px-6 font-semibold text-lg">実績</th>
                  <th className="text-right py-4 px-6 font-semibold text-lg">比率</th>
                </tr>
              </thead>
              <tbody>
                {subjectRows.map((item, index) => (
                  <tr
                    key={index}
                    className={`
                      transition-all duration-200 hover:bg-gray-50
                      ${item.isHighlighted ? 'bg-yellow-100 hover:bg-yellow-150 border-l-4 border-yellow-400' : ''}
                      ${item.isSubtotal ? 'bg-blue-50 hover:bg-blue-100 font-medium border-l-4 border-blue-400' : ''}
                      ${index % 2 === 0 && !item.isHighlighted && !item.isSubtotal ? 'bg-gray-25' : ''}
                    `}
                  >
                    <td className={`py-3 px-6 text-gray-800 ${item.isHighlighted || item.isSubtotal ? 'font-semibold' : ''}`}>
                      {item.name}
                    </td>
                    <td className={`py-3 px-6 text-right font-mono ${item.isHighlighted || item.isSubtotal ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                      {item.estimate === null || item.estimate === undefined ? '' : item.estimate.toLocaleString()}
                    </td>
                    <td className={`py-3 px-6 text-right font-mono ${item.isHighlighted || item.isSubtotal ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                      {item.actual === null || item.actual === undefined ? '' : item.actual.toLocaleString()}
                    </td>
                    <td className={`py-3 px-6 text-right font-mono ${item.isHighlighted || item.isSubtotal ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                      {/* 比率は必要に応じて計算・表示。ここでは空欄 */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex justify-center mt-8">
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 mr-2">月選択:</span>
              {monthNames.map((monthName, index) => (
                <button
                  key={index + 1}
                  onClick={() => router.push(`/admin/pl/${index + 1}`)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentDate?.month === index + 1
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {monthName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          {currentDate?.year}年{monthNames[currentDate?.month ?? 0]}の詳細データ
        </div>
      </main>
    </div>
  );
} 