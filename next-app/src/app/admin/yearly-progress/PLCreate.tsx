import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Plus, X, Calculator, TrendingUp, DollarSign, BarChart3, Save, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName, sortStoresByBusinessType } from '@/utils/storeDisplay';
import apiClient from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import YearMonthSelector from '@/components/YearMonthSelector';

// 型定義
type Payment = {
  id: string;
  companyId: string;
  amount: number;
  month: string;
};

type Company = {
  id: string;
  name: string;
  category: string;
};

// カスタムフック
const usePaymentData = (storeId: string | null) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!storeId) return;
    
    // 実際のデータ取得ロジックをここに実装
    // 現在は空のデータを返す
    setCompanies([]);
    setPayments([]);
  }, [storeId]);

  return { companies, payments };
};

const initialVariableSubjects = [
  'バイト給与', 'カードポイント', '求人募集費', '広告宣伝費', '容器包装費', '備品消耗品費', '車両費'
];
const initialFixedSubjects = [
  '従業員給与', 'ロイヤリティ', '地代家賃', '修繕費', '通信交通費', '水道光熱費', '保険料', '法定福利費', '厚生費', '管理諸費', 'リース料', '清掃費', '雑費'
];

type Subject = {
  name: string;
  estimate: number;
  actual: number;
};

// PLのitem型を定義
export interface PLItem {
  name: string;
  estimate: number;
  actual: number;
  is_highlighted?: boolean;
  is_subtotal?: boolean;
  is_indented?: boolean;
  subject_name?: string;
  type?: 'variable' | 'fixed';
  percentage?: string;
}

// SearchParamsを使用するコンポーネントを分離
function PLCreateWithSearchParams() {
  const [variableSubjects, setVariableSubjects] = useState<Subject[]>(
    initialVariableSubjects.map(name => ({ name, estimate: 0, actual: 0 }))
  );
  const [fixedSubjects, setFixedSubjects] = useState<Subject[]>(
    initialFixedSubjects.map(name => ({ name, estimate: 0, actual: 0 }))
  );
  const [showAddBox, setShowAddBox] = useState<'variable' | 'fixed' | null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(1);
  const { user, isSuperAdmin } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [storeId, setStoreId] = useState<string>(''); // 初期値を空文字列に変更
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sales, setSales] = useState({ estimate: 0, actual: 0 });
  const [cost, setCost] = useState({ estimate: 0, actual: 0 });
  const [depreciation, setDepreciation] = useState({ estimate: 0, actual: 0 });
  const [openDetail, setOpenDetail] = useState<{ [subject: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted] = useState(true);

  // 未使用関数を削除
  // const getCurrentYearMonth = () => {
  //   if (typeof window === 'undefined') return { year: 2024, month: 1 };
  //   const now = new Date();
  //   return {
  //     year: now.getFullYear(),
  //     month: now.getMonth() + 1
  //   };
  // };

  // 未使用変数を削除
  // const { year: currentYear, month: currentMonth } = getCurrentYearMonth();

  const storeName = user?.storeId ? (() => {
    const found = stores.find((store) => typeof store.id === 'string' && store.id === user.storeId);
    return typeof found?.name === 'string' ? found.name : '';
  })() : '';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const searchParams = useSearchParams();
  const { companies, payments } = usePaymentData(storeId);

  // クライアントサイドで現在の日付を設定（ハイドレーション対策）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const now = new Date();
      setYear(now.getFullYear());
      setMonth(now.getMonth() + 1);
    }
  }, []);

  // 支払いデータの計算を最適化
  const paymentSumBySubject = useMemo(() => {
    const nowMonth = `${year}-${String(month).padStart(2, '0')}`;
    const subjectSums: { [key: string]: number } = {};
    
    companies.forEach((company: Company) => {
      if (company.category) {
        const companyPayments = payments.filter(
          (p: Payment) => p.companyId === company.id && p.month === nowMonth
        );
        const sum = companyPayments.reduce((total: number, p: Payment) => total + (p.amount || 0), 0);
        subjectSums[company.category] = (subjectSums[company.category] || 0) + sum;
      }
    });
    
    return subjectSums;
  }, [companies, payments, year, month]);

  const getPaymentSumBySubject = useCallback((subject: string): number => {
    return paymentSumBySubject[subject] || 0;
  }, [paymentSumBySubject]);

  const toggleDetail = useCallback((subject: string) => {
    setOpenDetail(prev => ({ ...prev, [subject]: !prev[subject] }));
  }, []);

  const getPaymentDetailsBySubject = useCallback((subject: string): Payment[] => {
    const subjectCompanies: Company[] = companies.filter((c: Company) => c.category === subject);
    const companyIds: string[] = subjectCompanies.map((c: Company) => c.id).filter((id): id is string => !!id);
    const nowMonth = `${year}-${String(month).padStart(2, '0')}`;
    return payments.filter((p: Payment) => companyIds.includes(p.companyId) && p.month === nowMonth);
  }, [companies, payments, year, month]);

  // 支払いデータに基づく科目の更新を最適化
  useEffect(() => {
    setVariableSubjects(prev => prev.map(item => {
      if (!item.estimate || item.estimate === 0) {
        const sum = getPaymentSumBySubject(item.name);
        return sum > 0 ? { ...item, estimate: sum } : item;
      }
      return item;
    }));
    setFixedSubjects(prev => prev.map(item => {
      if (!item.estimate || item.estimate === 0) {
        const sum = getPaymentSumBySubject(item.name);
        return sum > 0 ? { ...item, estimate: sum } : item;
      }
      return item;
    }));
  }, [getPaymentSumBySubject]);

  // URLパラメータの処理
  useEffect(() => {
    const queryMonth = searchParams?.get('month');
    const queryStoreId = searchParams?.get('storeId');
    if (typeof queryMonth === 'string' && Number(queryMonth) !== month) {
      setMonth(Number(queryMonth));
    }
    if (typeof queryStoreId === 'string' && queryStoreId !== storeId) {
      setStoreId(queryStoreId);
    }
  }, [searchParams?.get('month'), searchParams?.get('storeId')]);

  // 店舗データの初期化
  useEffect(() => {
    if (stores.length === 0) {
      fetchStores();
    }
  }, [stores.length, fetchStores]);

  // ユーザーに基づく店舗ID設定
  useEffect(() => {
    console.log('店舗ID初期設定:', { storeId, user, storesLength: stores.length });
    if (!storeId && user && stores.length > 0) {
      if (typeof user.storeId === 'string' && user.storeId) {
        // 一般管理者の場合は自分の店舗をセット
        console.log('管理者の店舗IDをセット:', user.storeId);
        setStoreId(user.storeId);
      } else if (isSuperAdmin()) {
        // 総管理者の場合は最初の有効な店舗をセット
        const firstStore = stores.find(store => store.name !== '無所属' && store.name !== 'Manager');
        if (firstStore) {
          console.log('総管理者用の最初の店舗をセット:', firstStore.id);
          setStoreId(firstStore.id);
        }
      }
    }
  }, [user, stores, storeId]); // storeIdも依存配列に追加して一度だけ実行されるように

  // PLデータの取得
  useEffect(() => {
    if (!storeId || !year || !month || !isMounted) return;
    let ignore = false;
    
    const fetchPLData = async () => {
      try {
        setIsLoading(true);
        const res = await apiClient.getPL(year, month, storeId);
        
        if (!ignore) {
          let items: PLItem[] = [];
          
          // データ構造を確認し、適切に処理
          if (res.success && res.data) {
            if (Array.isArray(res.data.items)) {
              items = res.data.items as PLItem[];
            } else if (Array.isArray(res.data)) {
              items = res.data as PLItem[];
            }
          }
          
          const salesItem = items.find((item) =>
            item.name === '売上' || item.name === '売上高' ||
            item.subject_name === '売上' || item.subject_name === '売上高'
          );
          const costItem = items.find((item) =>
            item.name === '原価' || item.name === '売上原価' ||
            item.subject_name === '原価' || item.subject_name === '売上原価'
          );
          const depreciationItem = items.find((item) =>
            item.name === '減価償却費' || item.subject_name === '減価償却費'
          );
          
          setSales({
            estimate: salesItem ? (salesItem.estimate ?? 0) : 0,
            actual: salesItem ? (salesItem.actual ?? 0) : 0
          });
          setCost({
            estimate: costItem ? (costItem.estimate ?? 0) : 0,
            actual: costItem ? (costItem.actual ?? 0) : 0
          });
          setDepreciation({
            estimate: depreciationItem ? (depreciationItem.estimate ?? 0) : 0,
            actual: depreciationItem ? (depreciationItem.actual ?? 0) : 0
          });
          
          const variable = items.filter((item) => initialVariableSubjects.includes(item.name ?? item.subject_name ?? ''));
          const fixed = items.filter((item) => initialFixedSubjects.includes(item.name ?? item.subject_name ?? ''));
          const otherVariable = items.filter((item) => !initialVariableSubjects.includes(item.name ?? item.subject_name ?? '') && !initialFixedSubjects.includes(item.name ?? item.subject_name ?? '') && item.type === 'variable');
          const otherFixed = items.filter((item) => !initialVariableSubjects.includes(item.name ?? item.subject_name ?? '') && !initialFixedSubjects.includes(item.name ?? item.subject_name ?? '') && item.type === 'fixed');
          
          setVariableSubjects([
            ...initialVariableSubjects.map(name => {
              const found = variable.find((v) => (v.name || v.subject_name) === name);
              return found ? { name, estimate: found.estimate, actual: found.actual } : { name, estimate: 0, actual: 0 };
            }),
            ...otherVariable.map((v) => ({ name: (v.name ?? v.subject_name ?? ''), estimate: v.estimate, actual: v.actual }))
          ]);
          setFixedSubjects([
            ...initialFixedSubjects.map(name => {
              const found = fixed.find((f) => (f.name || f.subject_name) === name);
              return found ? { name, estimate: found.estimate, actual: found.actual } : { name, estimate: 0, actual: 0 };
            }),
            ...otherFixed.map((f) => ({ name: (f.name ?? f.subject_name ?? ''), estimate: f.estimate, actual: f.actual }))
          ]);
        } else if (!ignore) {
          setSales({ estimate: 0, actual: 0 });
          setCost({ estimate: 0, actual: 0 });
          setDepreciation({ estimate: 0, actual: 0 });
          setVariableSubjects(initialVariableSubjects.map(name => ({ name, estimate: 0, actual: 0 })));
          setFixedSubjects(initialFixedSubjects.map(name => ({ name, estimate: 0, actual: 0 })));
        }
              } catch (error) {
          console.error('PLデータの取得に失敗しました:', error);
        } finally {
          if (!ignore) setIsLoading(false);
        }
      };
      
      fetchPLData();
      return () => { ignore = true; };
    }, [year, month, storeId, isMounted]);

  // 自動計算値（useMemoで最適化）
  const variableTotal = useMemo(() => variableSubjects.reduce((sum, item) => sum + (item.estimate || 0), 0), [variableSubjects]);
  const variableTotalActual = useMemo(() => variableSubjects.reduce((sum, item) => sum + (item.actual || 0), 0), [variableSubjects]);
  const fixedTotal = useMemo(() => fixedSubjects.reduce((sum, item) => sum + (item.estimate || 0), 0), [fixedSubjects]);
  const fixedTotalActual = useMemo(() => fixedSubjects.reduce((sum, item) => sum + (item.actual || 0), 0), [fixedSubjects]);
  const grossProfit = useMemo(() => sales.estimate - cost.estimate, [sales, cost]);
  const grossProfitActual = useMemo(() => sales.actual - cost.actual, [sales, cost]);
  const managementCost = useMemo(() => variableTotal + fixedTotal, [variableTotal, fixedTotal]);
  const managementCostActual = useMemo(() => variableTotalActual + fixedTotalActual, [variableTotalActual, fixedTotalActual]);
  const profitBeforeDep = useMemo(() => grossProfit - managementCost, [grossProfit, managementCost]);
  const profitBeforeDepActual = useMemo(() => grossProfitActual - managementCostActual, [grossProfitActual, managementCostActual]);
  const operatingProfit = useMemo(() => profitBeforeDep - depreciation.estimate, [profitBeforeDep, depreciation]);
  const operatingProfitActual = useMemo(() => profitBeforeDepActual - depreciation.actual, [profitBeforeDepActual, depreciation]);

  const handleAddSubject = useCallback((type: 'variable' | 'fixed') => {
    if (!newSubjectName.trim()) return;
    const newSubject: Subject = { name: newSubjectName.trim(), estimate: 0, actual: 0 };
    if (type === 'variable') {
      setVariableSubjects(prev => [...prev, newSubject]);
    } else {
      setFixedSubjects(prev => [...prev, newSubject]);
    }
    setNewSubjectName('');
    setShowAddBox(null);
  }, [newSubjectName]);

  const handleInputChange = useCallback((
    type: 'variable' | 'fixed',
    index: number,
    field: 'estimate' | 'actual',
    value: string
  ) => {
    const setter = type === 'variable' ? setVariableSubjects : setFixedSubjects;
    setter(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: Number(value)
      };
      return updated;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    if (!storeId) {
      setSaveError('店舗を選択してください');
      setIsSaving(false);
      return;
    }
    try {
      const items: PLItem[] = [
        { name: '売上', estimate: sales.estimate, actual: sales.actual },
        { name: '原価', estimate: cost.estimate, actual: cost.actual },
        ...variableSubjects.map(item => ({ ...item })),
        { name: '変動費', estimate: variableTotal, actual: variableTotalActual, is_subtotal: true },
        ...fixedSubjects.map(item => ({ ...item })),
        { name: '固定費', estimate: fixedTotal, actual: fixedTotalActual, is_subtotal: true },
        { name: '管理費計', estimate: managementCost, actual: managementCostActual, is_subtotal: true },
        { name: '粗利益', estimate: grossProfit, actual: grossProfitActual, is_highlighted: true },
        { name: '償却前利益', estimate: profitBeforeDep, actual: profitBeforeDepActual, is_highlighted: true },
        { name: '減価償却費', estimate: depreciation.estimate, actual: depreciation.actual },
        { name: '営業利益', estimate: operatingProfit, actual: operatingProfitActual, is_highlighted: true }
      ];
      const res = await apiClient.savePL({ year, month, storeId, items });
      if (res.success) {
        setSaveMessage('保存に成功しました');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveError(res.error || '保存に失敗しました');
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : '保存時にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  }, [storeId, year, month, sales, cost, variableSubjects, fixedSubjects, variableTotal, variableTotalActual, fixedTotal, fixedTotalActual, managementCost, managementCostActual, grossProfit, grossProfitActual, profitBeforeDep, profitBeforeDepActual, depreciation, operatingProfit, operatingProfitActual]);

  const formatCurrency = useCallback((value: number) => {
    return `¥${value.toLocaleString()}`;
  }, []);

  const ProfitabilityIndicator = React.memo(({ value }: { value: number }) => (
    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
      value > 0 
        ? 'bg-emerald-100 text-emerald-800' 
        : value < 0 
        ? 'bg-red-100 text-red-800' 
        : 'bg-gray-100 text-gray-800'
    }`}>
      {value > 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : null}
      {value === 0 ? '±' : value > 0 ? '+' : ''}
      {formatCurrency(Math.abs(value))}
    </div>
  ));
  ProfitabilityIndicator.displayName = 'ProfitabilityIndicator';

  // 支払い明細リスト表示用コンポーネント
  const PaymentDetailList: React.FC<{ details: Payment[] }> = React.memo(({ details }) => (
  <div className="bg-gray-50 border border-gray-200 rounded p-2 mt-2">
    <table className="w-full text-xs">
      <thead>
        <tr>
          <th className="text-left px-2 py-1">企業名</th>
          <th className="text-right px-2 py-1">金額</th>
        </tr>
      </thead>
      <tbody>
        {details.map((d, i) => (
          <tr key={d.id ? `payment-${d.id}` : `payment-${i}-${d.companyId || 'unknown'}`}>
            <td className="px-2 py-1">{typeof d.companyId === 'string' ? d.companyId : ''}</td>
            <td className="px-2 py-1 text-right">¥{d.amount.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
));
PaymentDetailList.displayName = 'PaymentDetailList';

  // ユーザー情報がない場合のみローディング表示
  if (!user) {
    return (
      <main className="py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">初期化中...</p>
          </div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">データを読み込み中...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      {/* Compact Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-3">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-white" />
              <h1 className="text-xl font-bold text-white">損益計算書作成</h1>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1">
              <div className="text-white text-sm font-medium">
                {year}年{month}月期
              </div>
            </div>
          </div>
        </div>

        {/* Compact Controls */}
        <div className="px-4 py-3 bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <YearMonthSelector
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />

            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <label className="font-semibold text-gray-700">店舗</label>
              {isAdmin ? (
                <select
                  className="px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                  value={storeId}
                  onChange={e => {
                    const newStoreId = e.target.value;
                    console.log('店舗選択変更:', newStoreId);
                    setStoreId(newStoreId);
                  }}
                >
                  <option value="">選択してください</option>
                  {stores.length > 0 ? (
                    sortStoresByBusinessType(stores.filter(store => store.name !== '無所属' && store.name !== 'Manager')).map((store) => (
                      <option key={store.id} value={store.id}>{formatStoreName(store)}</option>
                    ))
                  ) : (
                    <option disabled>店舗を読み込み中...</option>
                  )}
                </select>
              ) : (
                <div className="px-2 py-1 bg-indigo-50 border border-indigo-200 rounded text-indigo-700 font-medium">
                  {storeName}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content in Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-16">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Revenue & Cost Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-white" />
                <h2 className="text-sm font-bold text-white">売上・原価</h2>
              </div>
            </div>
            <div className="p-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1 text-xs font-semibold text-gray-700">項目</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">見込み</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">実績</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">差異</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-2 py-1 font-medium text-gray-900">売上高</td>
                    <td className="px-2 py-1 text-right">
                      <input 
                        type="number" 
                        className="w-20 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-emerald-500" 
                        value={sales.estimate} 
                        onChange={e => setSales({ ...sales, estimate: Number(e.target.value) })} 
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input 
                        type="number" 
                        className="w-20 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-emerald-500" 
                        value={sales.actual} 
                        onChange={e => setSales({ ...sales, actual: Number(e.target.value) })} 
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <ProfitabilityIndicator value={sales.actual - sales.estimate} />
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-2 py-1 font-medium text-gray-900">売上原価</td>
                    <td className="px-2 py-1 text-right">
                      <input 
                        type="number" 
                        className="w-20 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-emerald-500" 
                        value={cost.estimate} 
                        onChange={e => setCost({ ...cost, estimate: Number(e.target.value) })} 
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input 
                        type="number" 
                        className="w-20 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-emerald-500" 
                        value={cost.actual} 
                        onChange={e => setCost({ ...cost, actual: Number(e.target.value) })} 
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <ProfitabilityIndicator value={-(cost.actual - cost.estimate)} />
                    </td>
                  </tr>
                  <tr className="bg-emerald-50 border-t border-emerald-200">
                    <td className="px-2 py-1 font-bold text-emerald-800">売上総利益</td>
                    <td className="px-2 py-1 text-right font-bold text-emerald-800 text-xs">{formatCurrency(grossProfit)}</td>
                    <td className="px-2 py-1 text-right font-bold text-emerald-800 text-xs">{formatCurrency(grossProfitActual)}</td>
                    <td className="px-2 py-1 text-right">
                      <ProfitabilityIndicator value={grossProfitActual - grossProfit} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Variable Costs Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-white" />
                  <h2 className="text-sm font-bold text-white">変動費</h2>
                </div>
                <button
                  onClick={() => setShowAddBox('variable')}
                  className="bg-white/20 hover:bg-white/30 p-1 rounded transition-colors"
                >
                  <Plus className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>
            <div className="p-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1 text-xs font-semibold text-gray-700">科目名</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">見込み</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">実績</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">差異</th>
                  </tr>
                </thead>
                <tbody>
                  {variableSubjects.map((item, idx) => {
                    const uniqueKey = `variable-${item.name}-${idx}`;
                    return (
                      <React.Fragment key={uniqueKey}>
                        <tr className="border-b border-gray-100 cursor-pointer hover:bg-blue-50" onClick={() => toggleDetail(item.name)}>
                          <td className="px-2 py-1 font-medium text-gray-900 text-xs flex items-center">
                            <button onClick={(e) => e.stopPropagation()}>
                              {openDetail[item.name] ? <ChevronUp /> : <ChevronDown />}
                            </button>
                            {item.name}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <input 
                              type="number" 
                              className="w-16 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-orange-500" 
                              value={item.estimate} 
                              onChange={e => handleInputChange('variable', idx, 'estimate', e.target.value)} 
                            />
                          </td>
                          <td className="px-2 py-1 text-right">
                            <input 
                              type="number" 
                              className="w-16 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-orange-500" 
                              value={item.actual} 
                              onChange={e => handleInputChange('variable', idx, 'actual', e.target.value)} 
                            />
                          </td>
                          <td className="px-2 py-1 text-right">
                            <ProfitabilityIndicator value={-(item.actual - item.estimate)} />
                          </td>
                        </tr>
                        {openDetail[item.name] && (
                          <tr key={`${uniqueKey}-detail`}>
                            <td colSpan={4}>
                              <PaymentDetailList details={getPaymentDetailsBySubject(item.name)} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-orange-50 border-t border-orange-200">
                    <td className="px-2 py-1 font-bold text-orange-800">変動費合計</td>
                    <td className="px-2 py-1 text-right font-bold text-orange-800 text-xs">{formatCurrency(variableTotal)}</td>
                    <td className="px-2 py-1 text-right font-bold text-orange-800 text-xs">{formatCurrency(variableTotalActual)}</td>
                    <td className="px-2 py-1 text-right">
                      <ProfitabilityIndicator value={-(variableTotalActual - variableTotal)} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Fixed Costs Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-white" />
                  <h2 className="text-sm font-bold text-white">固定費</h2>
                </div>
                <button
                  onClick={() => setShowAddBox('fixed')}
                  className="bg-white/20 hover:bg-white/30 p-1 rounded transition-colors"
                >
                  <Plus className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>
            <div className="p-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1 text-xs font-semibold text-gray-700">科目名</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">見込み</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">実績</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">差異</th>
                  </tr>
                </thead>
                <tbody>
                  {fixedSubjects.map((item, idx) => {
                    const uniqueKey = `fixed-${item.name}-${idx}`;
                    return (
                      <React.Fragment key={uniqueKey}>
                        <tr className="border-b border-gray-100 cursor-pointer hover:bg-purple-50" onClick={() => toggleDetail(item.name)}>
                          <td className="px-2 py-1 font-medium text-gray-900 text-xs flex items-center">
                            <button onClick={(e) => e.stopPropagation()}>
                              {openDetail[item.name] ? <ChevronUp /> : <ChevronDown />}
                            </button>
                            {item.name}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <input 
                              type="number" 
                              className="w-16 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-purple-500" 
                              value={item.estimate} 
                              onChange={e => handleInputChange('fixed', idx, 'estimate', e.target.value)} 
                            />
                          </td>
                          <td className="px-2 py-1 text-right">
                            <input 
                              type="number" 
                              className="w-16 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-purple-500" 
                              value={item.actual} 
                              onChange={e => handleInputChange('fixed', idx, 'actual', e.target.value)} 
                            />
                          </td>
                          <td className="px-2 py-1 text-right">
                            <ProfitabilityIndicator value={-(item.actual - item.estimate)} />
                          </td>
                        </tr>
                        {openDetail[item.name] && (
                          <tr key={`${uniqueKey}-detail`}>
                            <td colSpan={4}>
                              <PaymentDetailList details={getPaymentDetailsBySubject(item.name)} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-purple-50 border-t border-purple-200">
                    <td className="px-2 py-1 font-bold text-purple-800">固定費合計</td>
                    <td className="px-2 py-1 text-right font-bold text-purple-800 text-xs">{formatCurrency(fixedTotal)}</td>
                    <td className="px-2 py-1 text-right font-bold text-purple-800 text-xs">{formatCurrency(fixedTotalActual)}</td>
                    <td className="px-2 py-1 text-right">
                      <ProfitabilityIndicator value={-(fixedTotalActual - fixedTotal)} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Depreciation Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-3 py-2">
              <div className="flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-white" />
                <h2 className="text-sm font-bold text-white">減価償却費</h2>
              </div>
            </div>
            <div className="p-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1 text-xs font-semibold text-gray-700">項目</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">見込み</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">実績</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">差異</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-2 py-1 font-semibold text-gray-900">減価償却費</td>
                    <td className="px-2 py-1 text-right">
                      <input 
                        type="number" 
                        className="w-20 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-gray-500" 
                        value={depreciation.estimate} 
                        onChange={e => setDepreciation({ ...depreciation, estimate: Number(e.target.value) })} 
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input 
                        type="number" 
                        className="w-20 px-1 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-gray-500" 
                        value={depreciation.actual} 
                        onChange={e => setDepreciation({ ...depreciation, actual: Number(e.target.value) })} 
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <ProfitabilityIndicator value={-(depreciation.actual - depreciation.estimate)} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section - Full Width */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-16 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-3 py-2">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white">損益サマリー</h2>
          </div>
        </div>
        <div className="p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-2 py-1 text-xs font-semibold text-gray-700">項目</th>
                <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">見込み</th>
                <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">実績</th>
                <th className="text-right px-2 py-1 text-xs font-semibold text-gray-700">差異</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-blue-50 border-b border-blue-200">
                <td className="px-2 py-1 font-bold text-blue-800">管理費計</td>
                <td className="px-2 py-1 text-right font-bold text-blue-800 text-xs">{formatCurrency(managementCost)}</td>
                <td className="px-2 py-1 text-right font-bold text-blue-800 text-xs">{formatCurrency(managementCostActual)}</td>
                <td className="px-2 py-1 text-right">
                  <ProfitabilityIndicator value={-(managementCostActual - managementCost)} />
                </td>
              </tr>
              <tr className="bg-amber-50 border-b border-amber-200">
                <td className="px-2 py-1 font-bold text-amber-800">償却前利益</td>
                <td className="px-2 py-1 text-right font-bold text-amber-800 text-xs">{formatCurrency(profitBeforeDep)}</td>
                <td className="px-2 py-1 text-right font-bold text-amber-800 text-xs">{formatCurrency(profitBeforeDepActual)}</td>
                <td className="px-2 py-1 text-right">
                  <ProfitabilityIndicator value={profitBeforeDepActual - profitBeforeDep} />
                </td>
              </tr>
              <tr className="bg-emerald-100 border-t-2 border-emerald-400">
                <td className="px-2 py-2 text-lg font-bold text-emerald-800">営業利益</td>
                <td className="px-2 py-2 text-right text-lg font-bold text-emerald-800">{formatCurrency(operatingProfit)}</td>
                <td className="px-2 py-2 text-right text-lg font-bold text-emerald-800">{formatCurrency(operatingProfitActual)}</td>
                <td className="px-2 py-2 text-right">
                  <div className={`inline-flex items-center px-2 py-1 rounded-lg text-sm font-bold ${
                    (operatingProfitActual - operatingProfit) > 0 
                      ? 'bg-emerald-200 text-emerald-900' 
                      : (operatingProfitActual - operatingProfit) < 0 
                      ? 'bg-red-200 text-red-900' 
                      : 'bg-gray-200 text-gray-900'
                  }`}>
                    {(operatingProfitActual - operatingProfit) > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : null}
                    {formatCurrency(Math.abs(operatingProfitActual - operatingProfit))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixed Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-center gap-4">
            <button 
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-lg transition-all transform hover:scale-105 ${
                isSaving 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25'
              }`}
              onClick={handleSave} 
              disabled={isSaving}
            >
              <Save className="w-4 h-4" />
              {isSaving ? '保存中...' : '保存'}
            </button>
            
            {saveMessage && (
              <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-lg font-semibold text-sm">
                {saveMessage}
              </div>
            )}
            
            {saveError && (
              <div className="bg-red-100 border border-red-200 text-red-800 px-3 py-1 rounded-lg font-semibold text-sm">
                {saveError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Subject Modal */}
      {showAddBox && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-4 w-80 mx-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {showAddBox === 'variable' ? '変動費' : '固定費'}科目を追加
              </h3>
              <button
                onClick={() => setShowAddBox(null)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="科目名を入力"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddSubject(showAddBox)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddSubject(showAddBox)}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  追加
                </button>
                <button
                  onClick={() => setShowAddBox(null)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Suspenseでラップしたメインコンポーネント
export default function PLCreate() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <PLCreateWithSearchParams />
    </Suspense>
  );
}

// 未使用コンポーネントを削除
// const CategorySelect = ({ categories, selectedCategory, onCategoryChange }: {
//   categories: string[];
//   selectedCategory: string;
//   onCategoryChange: (category: string) => void;
// }) => {
//   // ... existing code ...
// };
// CategorySelect.displayName = 'CategorySelect';

// const ItemSelect = ({ items, selectedItem, onItemChange }: {
//   items: string[];
//   selectedItem: string;
//   onItemChange: (item: string) => void;
// }) => {
//   // ... existing code ...
// };
// ItemSelect.displayName = 'ItemSelect'; 
// ItemSelect.displayName = 'ItemSelect'; 