"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, TrendingUp, Calendar, ArrowRight, BarChart3, Eye, EyeOff, DollarSign, Target, PieChart, Award, ChevronDown, Check, MapPin } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/lib/api';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName, sortStoresByBusinessType } from '@/utils/storeDisplay';
import AppLayout from '@/app/appLayout/layout';

const monthNames = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
];

// PLItem型を定義
interface PLItem {
  name: string;
  subject_name?: string;
  estimate: number;
  actual: number;
  is_highlighted?: boolean;
  is_subtotal?: boolean;
  is_indented?: boolean;
  type?: 'variable' | 'fixed';
}

function YearlyProgress() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [showAnnualTotals, setShowAnnualTotals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [yearlyPL, setYearlyPL] = useState<PLItem[][]>([]);
  const [plError, setPlError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string>(''); // 初期値を空文字列に変更
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(2024);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentYear(new Date().getFullYear());
    }
  }, []);

  React.useEffect(() => {
    if (stores.length === 0) fetchStores();
    if (!storeId && user?.storeId && user?.role !== 'super_admin') setStoreId(user.storeId);
  }, [stores.length, user, storeId, fetchStores]);

  // stores取得後、storeIdが空なら非Manager店舗をセット（総管理者対応）
  React.useEffect(() => {
    if (stores.length > 0 && !storeId) {
      // Manager以外の最初の店舗を選択
      const nonManagerStores = stores.filter(store => 
        store.name !== '無所属' && store.name !== 'Manager'
      );
      if (nonManagerStores.length > 0) {
        setStoreId(nonManagerStores[0].id);
      } else {
        // 本店があれば本店を選択（フォールバック）
        const mainStore = stores.find(s => s.name === '本店');
        if (mainStore) setStoreId(mainStore.id);
      }
    }
  }, [stores, storeId]);

  // 今年の全月分PLデータを取得
  React.useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    setPlError(null);
    
    const fetchYearlyPL = async () => {
      try {
        const results = await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            apiClient.getPL(currentYear, i + 1, storeId).catch(error => {
              console.warn(`月${i + 1}のPLデータ取得失敗:`, error);
              return { success: false, data: null };
            })
          )
        );
        
        const plData = results.map((r, index) => {
          if (r.success && r.data) {
            // データ構造を確認し、適切に処理
            if (Array.isArray(r.data.items)) {
              return r.data.items as PLItem[];
            } else if (Array.isArray(r.data)) {
              return r.data as PLItem[];
            }
          }
          // デバッグ用ログ
          console.log(`月${index + 1}のPLデータ:`, r);
          return [];
        });
        
        setYearlyPL(plData);
        
        // データが全て空の場合は警告メッセージを表示
        const hasData = plData.some(monthData => monthData.length > 0);
        if (!hasData) {
          setPlError('年間PLデータが見つかりません。先に損益データを作成してください。');
        }
      } catch (error) {
        console.error('PLデータ取得エラー:', error);
        setPlError('年間PLデータの取得に失敗しました。データが存在しない可能性があります。');
        // エラーが発生しても空の配列で初期化
        setYearlyPL(Array(12).fill([]));
      } finally {
        setLoading(false);
      }
    };
    
    fetchYearlyPL();
  }, [storeId, currentYear]);

  if (!storeId) {
    return <div>店舗情報が取得できません。</div>;
  }
  if (loading) {
    return <div>年間損益データを読み込み中...</div>;
  }
  if (plError) {
    return <div className="text-red-600">{plError}</div>;
  }

  // 年間合計・カード用データ計算を改善
  const getSum = (subjects: string[], type: 'estimate' | 'actual'): number =>
    yearlyPL.reduce((sum: number, items: PLItem[]) => {
      if (!items || items.length === 0) return sum;
      // 複数の項目名パターンをチェック
      const item = items.find((i: PLItem) => 
        subjects.some(subject => 
          i.subject_name === subject || i.name === subject
        )
      );
      return sum + (item ? (item[type] || 0) : 0);
    }, 0);

  // 複数の売上項目を統合して取得
  const totalRevenue = getSum(['売上高', '売上', '純売上'], 'actual');

  // PLデータから利益項目を取得する関数
  const getProfitItem = (items: PLItem[]): PLItem | undefined => {
    try {
      if (!items || items.length === 0) return undefined;
      return items.find(item => 
        item.name === '当期純利益' || 
        item.name === '営業利益' || 
        item.name === '経常利益' ||
        item.name === '利益'
      );
    } catch (error) {
      console.error('getProfitItem function error:', error);
      return undefined;
    }
  };

  // 利益の集計を強化 - より多くのパターンに対応
  const totalProfit = getSum(['営業利益', 'operatingProfit', 'operating_profit', '利益'], 'actual');

  // 経費の集計（変動費 + 固定費 + 管理費 + 売上原価）
  const totalExpenses = getSum(['固定費', '変動費', '管理費', '管理費計', '売上原価', '原価'], 'actual');
  
  // 利益率の計算
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  console.log('🔍 損益管理カードデータ:', {
    yearlyPLLength: yearlyPL.length,
    totalRevenue,
    totalProfit,
    totalExpenses,
    profitMargin,
    samplePLData: yearlyPL[0] // 最初の月のデータサンプル
  });

  // 年間合計テーブル用データをPLデータから再構成
  const calculateAnnualTotals = (): { [key: string]: { amount: number; percentage: string } } => {
    const subjects: string[] = Array.from(
      new Set(yearlyPL.flat().filter(item => item).map((item: PLItem) => item.subject_name || item.name).filter(name => name))
    );
    const annualTotals: { [key: string]: { amount: number; percentage: string } } = {};
    
    // まず通常合計
    subjects.forEach(name => {
      const amount = getSum([name], 'actual');
      if (amount !== 0 || name) { // 0でも項目名があれば追加
        annualTotals[name] = { amount, percentage: '' };
      }
    });
    
    // --- 自動計算系は再計算で上書き ---
    // 売上高の統合
    const totalSalesAmount = getSum(['売上高', '売上', '純売上'], 'actual');
    if (totalSalesAmount > 0) {
      annualTotals['売上高'] = { amount: totalSalesAmount, percentage: '' };
    }
    
    // 粗利益の計算
    const grossProfitAmount = getSum(['粗利益', '粗利'], 'actual');
    if (grossProfitAmount > 0) {
      annualTotals['粗利益'] = { amount: grossProfitAmount, percentage: '' };
    } else {
      // 粗利益がない場合は売上 - 売上原価で計算
      const costOfSales = getSum(['売上原価', '原価'], 'actual');
      annualTotals['粗利益'] = { amount: totalSalesAmount - costOfSales, percentage: '' };
    }
    
    // 管理費計
    const managementCostAmount = getSum(['変動費'], 'actual') + getSum(['固定費'], 'actual');
    if (managementCostAmount > 0) {
      annualTotals['管理費計'] = { amount: managementCostAmount, percentage: '' };
    }
    
    // 償却前利益
    const profitBeforeDepAmount = getSum(['償却前利益'], 'actual');
    if (profitBeforeDepAmount > 0) {
      annualTotals['償却前利益'] = { amount: profitBeforeDepAmount, percentage: '' };
    } else {
      // 計算で求める
      annualTotals['償却前利益'] = { amount: (annualTotals['粗利益']?.amount ?? 0) - managementCostAmount, percentage: '' };
    }
    
    // 営業利益
    const operatingProfitAmount = getSum(['営業利益'], 'actual');
    if (operatingProfitAmount > 0) {
      annualTotals['営業利益'] = { amount: operatingProfitAmount, percentage: '' };
    } else {
      // 計算で求める
      const depreciationAmount = getSum(['減価償却費'], 'actual');
      annualTotals['営業利益'] = { amount: (annualTotals['償却前利益']?.amount ?? 0) - depreciationAmount, percentage: '' };
    }
    
    // 売上高合計で比率計算
    const netSalesTotal = totalSalesAmount || 1;
    Object.keys(annualTotals).forEach(name => {
      const percentage = ((annualTotals[name].amount / netSalesTotal) * 100).toFixed(1);
      annualTotals[name].percentage = `${percentage}%`;
    });
    return annualTotals;
  };
  const annualTotals = calculateAnnualTotals();

  const handleMonthClick = (month: number) => {
    // その月のPLデータがあるか判定
    router.push(`/admin/pl-create?month=${month}&storeId=${storeId}`);
  };

  // --- 年間進捗チャート・月次ボタン用データをAPI取得データから生成 ---
  // 各月の売上・利益（実績優先、なければ見込み）
  const monthlyRevenue = yearlyPL.map(items => {
    const actualItem = items.find((i: PLItem) => (i.subject_name === '売上高' || i.name === '売上高' || i.subject_name === '売上' || i.name === '売上'));
    if (actualItem && actualItem.actual && actualItem.actual !== 0) {
      return { value: actualItem.actual, isEstimate: false };
    } else if (actualItem && actualItem.estimate) {
      return { value: actualItem.estimate, isEstimate: true };
    } else {
      return { value: 0, isEstimate: false };
    }
  });
  const monthlyProfit = yearlyPL.map(items => {
    try {
      const profitItem = getProfitItem(items);
      if (profitItem && profitItem.actual && profitItem.actual !== 0) {
        return { value: profitItem.actual, isEstimate: false };
      } else if (profitItem && profitItem.estimate) {
        return { value: profitItem.estimate, isEstimate: true };
      } else {
        return { value: 0, isEstimate: false };
      }
    } catch (error) {
      console.error('getProfitItem error:', error);
      return { value: 0, isEstimate: false };
    }
  });

  // --- 追加: サマリーカード定義 ---
  const summaryCards = [
    {
      id: 'revenue',
      title: '年間売上高',
      value: totalRevenue,
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subtitle: 'Total Annual Revenue',
      growth: '+12.5%'
    },
    {
      id: 'profit',
      title: '年間利益',
      value: totalProfit,
      icon: DollarSign,
      color: 'from-emerald-500 to-green-500',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      subtitle: 'Total Annual Profit',
      growth: '+8.3%'
    },
    {
      id: 'expenses',
      title: '年間経費',
      value: totalExpenses,
      icon: PieChart,
      color: 'from-red-500 to-rose-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
      subtitle: 'Total Annual Expenses',
      growth: '-2.1%'
    },
    {
      id: 'margin',
      title: '利益率',
      value: parseFloat(profitMargin),
      icon: Target,
      color: 'from-purple-500 to-indigo-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      subtitle: 'Annual Profit Margin',
      isPercentage: true,
      growth: '+1.8%'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <main className="py-8 relative z-10">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-200/30 to-blue-200/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 py-8 px-4">
          <div>
            {/* Enhanced Header */}
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6 p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    年間損益進捗
                  </h1>
                  <p className="text-gray-600 text-lg mt-1">Annual Financial Progress Overview</p>
                </div>
              </div>
              {/* Store Selection */}
              <div className="flex items-center gap-6 mb-6">
                {/* Custom Store Dropdown */}
                <div className="relative">
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-xl border border-white/30 hover:shadow-2xl transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-md">
                        <MapPin className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="font-bold text-gray-700 text-lg">店舗：</label>
                        <button
                          onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                          className="group flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white hover:from-blue-50 hover:to-purple-50 rounded-xl px-4 py-2 shadow-md hover:shadow-lg border border-gray-200 hover:border-blue-300 transition-all duration-300 min-w-[160px]"
                        >
                          <span className="font-semibold text-gray-800 group-hover:text-blue-800 transition-colors">
                            {(() => {
                              const currentStore = stores.find(store => store.id === storeId);
                              if (currentStore && currentStore.name !== 'Manager') {
                                return formatStoreName(currentStore);
                              }
                              const fallbackStore = stores.find(s => s.name !== '無所属' && s.name !== 'Manager');
                              return fallbackStore ? formatStoreName(fallbackStore) : '選択してください';
                            })()}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-gray-600 group-hover:text-blue-600 transition-all duration-300 ${isStoreDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Dropdown Menu */}
                  {isStoreDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 animate-in slide-in-from-top-2 duration-200">
                      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/30 overflow-hidden">
                        <div className="p-2">
                          {sortStoresByBusinessType(stores.filter(store => store.name !== '無所属' && store.name !== 'Manager')).map((store, index) => (
                            <button
                              key={store.id}
                              onClick={() => { setStoreId(store.id); setIsStoreDropdownOpen(false); }}
                              className={
                                storeId === store.id
                                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg group w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left'
                                  : 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 text-gray-700 hover:text-blue-800 group w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left'
                              }
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div className={
                                storeId === store.id
                                  ? 'p-2 rounded-lg bg-white/20'
                                  : 'p-2 rounded-lg bg-gray-100 group-hover:bg-blue-100'
                              }>
                                <Building2 className={
                                  storeId === store.id
                                    ? 'h-4 w-4 text-white'
                                    : 'h-4 w-4 text-gray-600 group-hover:text-blue-600'
                                } />
                              </div>
                              <span className="font-semibold flex-1">{formatStoreName(store)}</span>
                              {storeId === store.id && (
                                <div className="p-1 bg-white/20 rounded-full">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Backdrop to close dropdown */}
                  {isStoreDropdownOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setIsStoreDropdownOpen(false)} />
                  )}
                </div>
                <button
                  className="group bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
                  onClick={() => router.push(`/admin/pl-create?storeId=${storeId}`)}
                >
                  <span className="flex items-center gap-2">
                    <Award className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                    損益作成
                  </span>
                </button>
              </div>
            </div>
            {/* Enhanced Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {summaryCards.map((card, index) => {
                // 1つでも見込みがあれば見込みラベルを表示
                let isEstimate = false;
                if (card.id === 'revenue') {
                  isEstimate = monthlyRevenue.some(r => r.isEstimate && r.value !== 0);
                } else if (card.id === 'profit') {
                  isEstimate = monthlyProfit.some(r => r.isEstimate && r.value !== 0);
                }
                return (
                  <div
                    key={card.id}
                    className="group relative overflow-hidden"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl border border-white/20 p-6 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 relative overflow-hidden">
                      {/* Hover Effect Background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                      {/* Content */}
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-3 ${card.bgColor} rounded-xl shadow-sm group-hover:shadow-md transition-all duration-300`}>
                            <card.icon className={`h-6 w-6 ${card.textColor} group-hover:scale-110 transition-transform duration-300`} />
                          </div>
                          <div className={`px-2 py-1 bg-gradient-to-r ${card.color} text-white text-xs font-semibold rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0`}>
                            {card.growth}
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-gray-900 transition-colors flex items-center gap-2">
                          {card.title}
                          {isEstimate && <span className="text-xs text-gray-400 ml-1">(見込み)</span>}
                        </h3>
                        <p className={`text-3xl font-bold ${card.textColor} mb-2 group-hover:scale-105 transition-transform duration-300`}>
                          {card.isPercentage ? `${parseFloat(profitMargin)}%` : `¥${card.id === 'revenue' ? totalRevenue.toLocaleString() : card.id === 'profit' ? totalProfit.toLocaleString() : card.id === 'expenses' ? totalExpenses.toLocaleString() : card.value}`}
                        </p>
                        <p className="text-sm text-gray-500 group-hover:text-gray-600 transition-colors">
                          {card.subtitle}
                        </p>
                      </div>
                      {/* Animated Border */}
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${card.color} opacity-20 blur-xl`}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Enhanced Annual Totals Toggle */}
            <div className="mb-8">
              <button
                onClick={() => setShowAnnualTotals(!showAnnualTotals)}
                className="group w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-6 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02] hover:-translate-y-1"
              >
                <div className="flex items-center justify-center gap-4">
                  <div className="p-2 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors duration-300">
                    <BarChart3 className="h-6 w-6 group-hover:rotate-12 transition-transform duration-300" />
                  </div>
                  <span className="text-xl">年間合計詳細</span>
                  <div className="p-2 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors duration-300">
                    {showAnnualTotals ?
                      <EyeOff className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" /> :
                      <Eye className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
                    }
                  </div>
                </div>
              </button>
            </div>
            {/* Enhanced Annual Totals Table */}
            {showAnnualTotals && (
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/20 mb-12 animate-in slide-in-from-top duration-500">
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <BarChart3 className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">年間合計損益データ</h2>
                      <p className="text-indigo-100 mt-2 text-lg">Annual Financial Data Summary</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                        <th className="text-left py-6 px-8 font-bold text-xl text-gray-800">項目</th>
                        <th className="text-right py-6 px-8 font-bold text-xl text-gray-800">年間合計金額</th>
                        <th className="text-right py-6 px-8 font-bold text-xl text-gray-800">比率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ここは既存のannualTotals描画ロジックを流用しつつ、デザインのみ上記に合わせてリファイン */}
                      {(() => {
                        // 適切な表示順序を定義
                        const keys = Object.keys(annualTotals);
                        const order = ['売上高', '売上', '純売上', '売上原価', '原価', '粗利益', '粗利', '変動費', '固定費', '管理費計', '償却前利益', '減価償却費', '営業利益'];
                        const displayedKeys = new Set();
                        
                        // 順序に従って表示
                        const rows = order.filter(k => keys.includes(k) && !displayedKeys.has(k)).map((name) => {
                          displayedKeys.add(name);
                          const data = annualTotals[name];
                          const isHighlighted = name === '粗利益' || name === '粗利' || name === '営業利益';
                          const isSubtotal = name === '管理費計' || name === '変動費' || name === '固定費';
                          return (
                            <tr key={name} className={
                              `group transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 ${isHighlighted ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-400 font-bold text-lg' : ''} ${isSubtotal ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 font-bold text-lg' : 'font-medium'}`
                            }>
                              <td className="py-4 px-8 text-gray-800">{name}</td>
                              <td className="py-4 px-8 text-right font-mono text-gray-700">¥{data.amount.toLocaleString()}</td>
                              <td className="py-4 px-8 text-right font-mono text-gray-700">{data.percentage}</td>
                            </tr>
                          );
                        });
                        
                        // 残りの項目も表示
                        const remainingRows = Object.entries(annualTotals)
                          .filter(([name]) => !displayedKeys.has(name))
                          .map(([name, data]) => {
                            const isHighlighted = name.includes('利益');
                            const isSubtotal = name.includes('費') || name.includes('計');
                            return (
                              <tr key={name} className={
                                `group transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 ${isHighlighted ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-400 font-bold text-lg' : ''} ${isSubtotal ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 font-bold text-lg' : 'font-medium'}`
                              }>
                                <td className="py-4 px-8 text-gray-800">{name}</td>
                                <td className="py-4 px-8 text-right font-mono text-gray-700">¥{data.amount.toLocaleString()}</td>
                                <td className="py-4 px-8 text-right font-mono text-gray-700">{data.percentage}</td>
                              </tr>
                            );
                          });
                        
                        return [...rows, ...remainingRows];
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Enhanced Monthly Progress Chart */}
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-12 border border-white/20">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-800">月次進捗チャート</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Enhanced Revenue Chart */}
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    売上高推移
                  </h3>
                  <div className="space-y-4">
                    {monthlyRevenue.map((revenue, idx) => {
                      const maxRevenue = Math.max(...monthlyRevenue.map(r => r.value));
                      const width = maxRevenue ? (revenue.value / maxRevenue) * 100 : 0;
                      return (
                        <div key={idx} className="group flex items-center gap-4">
                          <span className="w-12 text-sm font-bold text-gray-600 text-center bg-gray-100 rounded-lg py-2 flex items-center justify-center">
                            {monthNames[idx]}
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden shadow-inner">
                            <div 
                              className="bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 h-full rounded-full transition-all duration-1000 ease-out group-hover:from-blue-600 group-hover:via-blue-700 group-hover:to-cyan-600 relative overflow-hidden"
                              style={{ width: `${width}%`, animationDelay: `${idx * 100}ms` }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            </div>
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-sm">
                              ¥{revenue.value.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Enhanced Profit Chart */}
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    利益推移
                  </h3>
                  <div className="space-y-4">
                    {monthlyProfit.map((profit, idx) => {
                      const maxProfit = Math.max(...monthlyProfit.map(r => r.value));
                      const width = maxProfit ? (profit.value / maxProfit) * 100 : 0;
                      return (
                        <div key={idx} className="group flex items-center gap-4">
                          <span className="w-12 text-sm font-bold text-gray-600 text-center bg-gray-100 rounded-lg py-2 flex items-center justify-center">
                            {monthNames[idx]}
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden shadow-inner">
                            <div 
                              className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-500 h-full rounded-full transition-all duration-1000 ease-out group-hover:from-green-600 group-hover:via-green-700 group-hover:to-emerald-600 relative overflow-hidden"
                              style={{ width: `${width}%`, animationDelay: `${idx * 100}ms` }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            </div>
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-sm">
                              ¥{profit.value.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            {/* Enhanced Monthly Navigation Grid */}
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white/20">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-800">月次詳細へ移動</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {monthNames.map((monthName, index) => {
                  // 実績未入力・見込み入力済の場合のみ見込みラベル
                  const isEstimate = monthlyRevenue[index]?.isEstimate && monthlyRevenue[index]?.value !== 0;
                  return (
                    <button
                      key={index + 1}
                      onClick={() => handleMonthClick(index + 1)}
                      className="group relative bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-purple-50 rounded-2xl p-6 transition-all duration-500 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 border border-gray-200 hover:border-blue-300 overflow-hidden"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Background Animation */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      {/* Content */}
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                            {monthName}
                            {isEstimate && <span className="text-xs text-gray-400 ml-1">(見込み)</span>}
                          </h3>
                          <div className="p-2 bg-gray-100 group-hover:bg-blue-100 rounded-xl transition-colors duration-300">
                            <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300" />
                          </div>
                        </div>
                        <div className="space-y-3 text-left">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">売上:</span>
                            <span className="text-sm font-bold text-blue-700">¥{monthlyRevenue[index]?.value.toLocaleString() ?? 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">利益:</span>
                            <span className="text-sm font-bold text-emerald-700">¥{monthlyProfit[index]?.value.toLocaleString() ?? 0}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="text-xs font-medium text-gray-500">利益率:</span>
                            <span className="text-xs font-bold text-purple-700">
                              {monthlyRevenue[index]?.value && monthlyProfit[index]?.value ? ((monthlyProfit[index]?.value / monthlyRevenue[index]?.value) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Hover Glow Effect */}
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-r from-blue-400 to-purple-400 blur-xl"></div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Enhanced Footer */}
            <div className="flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600 font-medium">年間財務データの概要と月次詳細へのナビゲーション</span>
              <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse delay-500"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <AppLayout>
      <YearlyProgress />
    </AppLayout>
  );
} 