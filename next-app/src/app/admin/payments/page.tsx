"use client";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Edit2, EyeOff, Building, RotateCcw, Calendar, Plus, X, Save, RefreshCw, Trash2, Eye, Search, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName } from '@/utils/storeDisplay';
import apiClient from '@/lib/api';

// 型定義
export type PaymentType = 'regular' | 'irregular' | 'specific';

export type ExpenseCategory =
  | '広告費'
  | '水道光熱費'
  | '通信費'
  | '賃貸料'
  | '保険料'
  | '消耗品費'
  | '交通費'
  | '外注費'
  | 'その他';

// Company interface specific to payments page (extends the base Company type with page-specific properties)
export interface Company {
  id: string;
  name: string;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  category: ExpenseCategory;
  paymentType: PaymentType;
  regularAmount?: number;
  specificMonths?: number[];
  isVisible?: boolean;
}

// Payment interface specific to payments page (uses Date objects instead of strings)
export interface Payment {
  id: string;
  companyId: string;
  month: string; // YYYY-MM format
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

// 定数
const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  '広告費',
  '水道光熱費',
  '通信費',
  '賃貸料',
  '保険料',
  '消耗品費',
  '交通費',
  '外注費',
  'その他'
];

const CATEGORY_COLORS = {
  '広告費': 'bg-purple-50 border-purple-200 text-purple-800',
  '水道光熱費': 'bg-blue-50 border-blue-200 text-blue-800',
  '通信費': 'bg-green-50 border-green-200 text-green-800',
  '賃貸料': 'bg-orange-50 border-orange-200 text-orange-800',
  '保険料': 'bg-red-50 border-red-200 text-red-800',
  '消耗品費': 'bg-yellow-50 border-yellow-200 text-yellow-800',
  '交通費': 'bg-indigo-50 border-indigo-200 text-indigo-800',
  '外注費': 'bg-pink-50 border-pink-200 text-pink-800',
  'その他': 'bg-gray-50 border-gray-200 text-gray-800'
};

// デモデータは削除済み - APIからデータを取得します

// ローカルストレージのキー
const STORAGE_KEYS = {
  COMPANIES: 'payment-system-companies',
  PAYMENTS: 'payment-system-payments',
  SELECTED_MONTH: 'payment-system-selected-month',
} as const;

// データの保存
const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
  }
};

// データの読み込み
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    // SSR対策: windowが存在する場合のみlocalStorageにアクセス
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Date オブジェクトの復元
      if (key === STORAGE_KEYS.PAYMENTS) {
        return parsed.map((payment: any) => ({
          ...payment,
          createdAt: new Date(payment.createdAt),
          updatedAt: new Date(payment.updatedAt),
        }));
      }
      return parsed;
    }
  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
  }
  return defaultValue;
};

const usePaymentData = (storeId: string | null) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initialize selectedMonth on client side only
  useEffect(() => {
    const stored = loadFromStorage(STORAGE_KEYS.SELECTED_MONTH, '');
    if (stored) {
      setSelectedMonth(stored);
    } else {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      setSelectedMonth(currentMonth);
    }
  }, []);

  // Load companies from API
  useEffect(() => {
    if (!storeId) {
      // storeIdがない場合はcompaniesをクリア
      setCompanies([]);
      return;
    }
    
    const loadCompanies = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getCompanies(storeId);
        console.log('[支払い管理] API Response:', {
          success: response.success,
          hasData: !!response.data,
          dataLength: response.data ? response.data.length : 0,
          data: response.data,
          error: response.error,
          storeId
        });
        if (response.success && response.data) {
          console.log('[支払い管理] Setting companies:', response.data);
          setCompanies(response.data as Company[]);
        } else {
          // APIからデータが取得できない場合は空配列を設定
          console.log('[支払い管理] No data from API, setting empty array');
          setCompanies([]);
        }
      } catch (error) {
        console.error('取引先データの取得に失敗しました:', error);
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [storeId]);

  // Load payments from API when month or storeId changes
  useEffect(() => {
    if (!storeId || !selectedMonth) return;
    
    const loadPayments = async () => {
      try {
        const response = await apiClient.getPayments(selectedMonth, storeId);
        if (response.success && response.data) {
          setPayments(response.data.map(p => ({
            ...p,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date()
          })) as Payment[]);
        }
      } catch (error) {
        console.error('支払いデータの取得に失敗しました:', error);
      }
    };

    loadPayments();
  }, [storeId, selectedMonth]);

  // 選択月が変更されたときに保存
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SELECTED_MONTH, selectedMonth);
  }, [selectedMonth]);

  // 手動保存機能 - APIに保存
  const saveData = useCallback(async () => {
    if (!storeId) return;
    
    try {
      setLoading(true);
      // 支払いデータを一括保存
      const paymentsToSave = payments.map(p => ({
        id: p.id,
        companyId: p.companyId,
        month: p.month,
        amount: p.amount,
        storeId: storeId
      }));
      
      const response = await apiClient.bulkSavePayments(paymentsToSave);
      
      if (response.success) {
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('データの保存に失敗しました:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [payments, storeId]);

  const addCompany = useCallback(async (company: Omit<Company, 'id'>) => {
    if (!storeId) return;
    
    try {
      const response = await apiClient.createCompany({ 
        ...company, 
        storeId,
        isVisible: company.isVisible ?? true
      });
      if (response.success && response.data) {
        setCompanies(prev => [...prev, response.data! as Company]);
      }
    } catch (error) {
      console.error('取引先の追加に失敗しました:', error);
      throw error;
    }
  }, [storeId]);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    try {
      const response = await apiClient.updateCompany(id, updates);
      if (response.success && response.data) {
        setCompanies(prev => prev.map(company =>
          company.id === id ? (response.data! as Company) : company
        ));
      }
    } catch (error) {
      console.error('取引先の更新に失敗しました:', error);
      throw error;
    }
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    try {
      const response = await apiClient.deleteCompany(id);
      if (response.success) {
        setCompanies(prev => prev.filter(company => company.id !== id));
        setPayments(prev => prev.filter(payment => payment.companyId !== id));
      }
    } catch (error) {
      console.error('取引先の削除に失敗しました:', error);
      throw error;
    }
  }, []);

  const toggleCompanyVisibility = useCallback(async (id: string) => {
    const company = companies.find(c => c.id === id);
    if (!company) return;
    
    try {
      await updateCompany(id, { isVisible: !company.isVisible });
    } catch (error) {
      console.error('表示設定の更新に失敗しました:', error);
    }
  }, [companies, updateCompany]);

  const updatePayment = useCallback((companyId: string, amount: number) => {
    const existingPayment = payments.find(p =>
      p.companyId === companyId && p.month === selectedMonth
    );

    if (existingPayment) {
      setPayments(prev => prev.map(payment =>
        payment.id === existingPayment.id
          ? { ...payment, amount, updatedAt: new Date() }
          : payment
      ));
    } else {
      const newPayment: Payment = {
        id: `temp-${Date.now()}`,
        companyId,
        month: selectedMonth,
        amount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setPayments(prev => [...prev, newPayment]);
    }
    setHasUnsavedChanges(true);
  }, [selectedMonth, payments]);

  const getPaymentAmount = useCallback((companyId: string, month: string = selectedMonth) => {
    const payment = payments.find(p => p.companyId === companyId && p.month === month);
    return payment?.amount || 0;
  }, [payments, selectedMonth]);

  // 表示対象の企業のみを対象とした計算
  const visibleCompanies = useMemo(() => {
    return companies.filter(company => {
      if (company.paymentType === 'regular') {
        return true; // 定期支払いは常に表示
      }
      return company.isVisible; // 不定期・特定月は表示フラグに従う
    });
  }, [companies]);

  const monthlyTotal = useMemo(() => {
    return visibleCompanies.reduce((sum, company) => {
      const amount = getPaymentAmount(company.id);
      return sum + amount;
    }, 0);
  }, [visibleCompanies, getPaymentAmount]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    visibleCompanies.forEach(company => {
      const amount = getPaymentAmount(company.id);
      totals[company.category] = (totals[company.category] || 0) + amount;
    });

    return totals;
  }, [visibleCompanies, getPaymentAmount]);

  return {
    companies,
    visibleCompanies,
    payments,
    selectedMonth,
    setSelectedMonth,
    addCompany,
    updateCompany,
    deleteCompany,
    toggleCompanyVisibility,
    updatePayment,
    getPaymentAmount,
    monthlyTotal,
    categoryTotals,
    // 保存関連
    hasUnsavedChanges,
    lastSaved,
    saveData,
    loading,
  };
};

// カテゴリセクションコンポーネント
interface CategorySectionProps {
  category: string;
  companies: Company[];
  selectedMonth: string;
  getPaymentAmount: (companyId: string) => number;
  onAmountChange: (companyId: string, amount: number) => void;
  onEditCompany: (company: Company) => void;
  onToggleVisibility: (id: string) => void;
  categoryTotal: number;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  companies,
  selectedMonth,
  getPaymentAmount,
  onAmountChange,
  onEditCompany,
  onToggleVisibility,
  categoryTotal,
}) => {
  if (companies.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]}`}>
              {category}
            </span>
            <span className="text-xs text-gray-600">
              {companies.length}社
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            ¥{categoryTotal.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="p-2 space-y-1">
        {companies.map((company) => (
          <PaymentCard
            key={company.id}
            company={company}
            currentAmount={getPaymentAmount(company.id)}
            selectedMonth={selectedMonth}
            onAmountChange={(amount) => onAmountChange(company.id, amount)}
            onEdit={onEditCompany}
            onToggleVisibility={onToggleVisibility}
          />
        ))}
      </div>
    </div>
  );
};

// 支払いカードコンポーネント
interface PaymentCardProps {
  company: Company;
  currentAmount: number;
  selectedMonth: string;
  onAmountChange: (amount: number) => void;
  onEdit: (company: Company) => void;
  onToggleVisibility: (id: string) => void;
}

const PaymentCard: React.FC<PaymentCardProps> = ({
  company,
  currentAmount,
  selectedMonth,
  onAmountChange,
  onEdit,
  onToggleVisibility,
}) => {
  const [inputAmount, setInputAmount] = useState(currentAmount.toString());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (company.paymentType === 'regular' && company.regularAmount && currentAmount === 0) {
      onAmountChange(company.regularAmount);
      setInputAmount(company.regularAmount.toString());
    }
  }, [company, currentAmount, onAmountChange]);

  useEffect(() => {
    setInputAmount(currentAmount.toString());
  }, [currentAmount]);

  const handleAmountSubmit = () => {
    const amount = parseFloat(inputAmount) || 0;
    onAmountChange(amount);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAmountSubmit();
    } else if (e.key === 'Escape') {
      setInputAmount(currentAmount.toString());
      setIsEditing(false);
    }
  };

  const isPaymentDue = () => {
    if (company.paymentType === 'specific' && company.specificMonths) {
      const currentMonthNum = parseInt(selectedMonth.split('-')[1]);
      return company.specificMonths.includes(currentMonthNum);
    }
    return true;
  };

  const getPaymentTypeDisplay = () => {
    switch (company.paymentType) {
      case 'regular':
        return (
          <div className="flex items-center space-x-1 text-xs text-green-600">
            <RotateCcw className="w-3 h-3" />
            <span>定期 ¥{company.regularAmount?.toLocaleString() || '0'}</span>
          </div>
        );
      case 'irregular':
        return (
          <div className="flex items-center space-x-1 text-xs text-orange-600">
            <Edit2 className="w-3 h-3" />
            <span>不定期</span>
          </div>
        );
      case 'specific':
        return (
          <div className="flex items-center space-x-1 text-xs text-purple-600">
            <Calendar className="w-3 h-3" />
            <span>特定月</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isPaymentDue()) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-2 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-gray-500 text-sm truncate">{company.name}</h3>
              <p className="text-xs text-gray-400">今月は支払い対象外</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 w-12 justify-end">
            <button
              onClick={() => onEdit(company)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            {company.paymentType !== 'regular' ? (
              <button
                onClick={() => onToggleVisibility(company.id)}
                className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                title="非表示にする"
              >
                <EyeOff className="w-3 h-3" />
              </button>
            ) : (
              <div className="w-5 h-5"></div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-2 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between space-x-3">
        {/* 企業名とタイプ */}
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Building className="w-4 h-4 text-gray-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 text-sm truncate">{company.name}</h3>
            {getPaymentTypeDisplay()}
          </div>
        </div>

        {/* 支払額入力 */}
        <div className="flex items-center space-x-1 w-28 justify-end">
          <span className="text-xs text-gray-600">¥</span>
          {isEditing ? (
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              onBlur={handleAmountSubmit}
              onKeyDown={handleKeyPress}
              className="w-20 px-2 py-1 border border-blue-300 rounded text-right text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="w-20 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-right cursor-pointer hover:bg-gray-100 transition-colors text-sm"
            >
              {currentAmount.toLocaleString()}
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex items-center space-x-1 w-12 justify-end">
          <button
            onClick={() => onEdit(company)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {company.paymentType !== 'regular' ? (
            <button
              onClick={() => onToggleVisibility(company.id)}
              className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
              title="非表示にする"
            >
              <EyeOff className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-5 h-5"></div>
          )}
        </div>
      </div>
    </div>
  );
};

function PaymentManagement() {
  const router = useRouter();
  const { user, hasPermission, isSuperAdmin } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>();
  const [isHydrated, setIsHydrated] = useState(false);

  const {
    companies,
    visibleCompanies,
    selectedMonth,
    setSelectedMonth,
    addCompany,
    updateCompany,
    deleteCompany,
    toggleCompanyVisibility,
    updatePayment,
    getPaymentAmount,
    monthlyTotal,
    categoryTotals,
    hasUnsavedChanges,
    lastSaved,
    saveData,
    loading: paymentDataLoading,
  } = usePaymentData(selectedStoreId);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // 店舗データを取得
  useEffect(() => {
    if (user && hasPermission('admin')) {
      fetchStores();
    }
  }, [user, hasPermission, fetchStores]);

  // ユーザーの権限に応じて初期店舗を設定
  useEffect(() => {
    if (user && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(String(user.storeId || ''));
    }
  }, [user, stores, selectedStoreId]);

  const handleSaveCompany = async (companyData: Omit<Company, 'id'>) => {
    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, companyData);
      } else {
        await addCompany(companyData);
      }
      setEditingCompany(undefined);
    } catch (error) {
      console.error('取引先の保存に失敗しました:', error);
      alert('取引先の保存に失敗しました。');
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleDeleteCompany = async (id: string) => {
    if (window.confirm('この取引先を削除しますか？')) {
      try {
        await deleteCompany(id);
      } catch (error) {
        console.error('取引先の削除に失敗しました:', error);
        alert('取引先の削除に失敗しました。');
      }
    }
  };

  const handleAddCompany = () => {
    setEditingCompany(undefined);
    setIsModalOpen(true);
  };

  const formatSelectedMonth = () => {
    if (!selectedMonth) return '読み込み中...';
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long'
    });
  };

  const groupedCompanies = EXPENSE_CATEGORIES.reduce((acc, category) => {
    acc[category] = visibleCompanies.filter(company => company.category === category);
    return acc;
  }, {} as Record<string, Company[]>);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <Building2 className="w-8 h-8 text-blue-600" />
                  <h1 className="text-xl font-bold text-gray-900">支払い管理システム</h1>

                  {/* 店舗選択/表示 */}
                  {isHydrated && user && (
                    isSuperAdmin() ? (
                      // 総管理者：店舗選択ドロップボックス
                      <select
                        value={selectedStoreId}
                        onChange={(e) => setSelectedStoreId(e.target.value)}
                        className="ml-3 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">店舗を選択してください</option>
                        {stores.map(store => (
                          <option key={store.id} value={store.id}>
                            {formatStoreName(store)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      // 管理者：所属店舗名表示
                      selectedStoreId && stores.length > 0 && (() => {
                        const store = stores.find(s => String(s.id) === selectedStoreId);
                        return store ? (
                          <span className="ml-3 px-3 py-2 bg-gray-100 text-sm font-medium text-gray-700 rounded-lg">
                            {formatStoreName(store)}
                          </span>
                        ) : null;
                      })()
                    )
                  )}
                </div>

                {/* Year-Month Display with Calendar Button and Total */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3 bg-gray-50 px-4 py-2 rounded-lg">
                    <span className="text-lg font-medium text-gray-900">
                      {formatSelectedMonth()}
                    </span>
                    <button
                      onClick={() => setIsCalendarOpen(true)}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
                      title="カレンダーを開く"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

                  {/* Monthly Total */}
                  <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-blue-700 font-medium">月次支払総額</span>
                      <span className="text-lg font-bold text-blue-900">¥{isHydrated ? monthlyTotal.toLocaleString() : '0'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center space-x-6">
                {isHydrated && (
                  <SaveButton
                    hasUnsavedChanges={hasUnsavedChanges}
                    lastSaved={lastSaved}
                    onSave={saveData}
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex">
          {/* Payment Management Area */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
            {/* Payment Management */}
            <div className="space-y-6">
              {!isHydrated ? (
                <div className="text-center py-12">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
                  </div>
                </div>
              ) : visibleCompanies.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                  <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">表示する企業がありません</h3>
                  <p className="text-gray-600 mb-6">右側の取引先一覧から企業を表示するか、新しい企業を登録してください。</p>
                </div>
              ) : (
                EXPENSE_CATEGORIES.map((category) => (
                  <CategorySection
                    key={category}
                    category={category}
                    companies={groupedCompanies[category]}
                    selectedMonth={selectedMonth}
                    getPaymentAmount={getPaymentAmount}
                    onAmountChange={updatePayment}
                    onEditCompany={handleEditCompany}
                    onToggleVisibility={toggleCompanyVisibility}
                    categoryTotal={categoryTotals[category] || 0}
                  />
                ))
              )}
            </div>
          </main>

          {/* Company Sidebar */}
          {isHydrated && (
            <CompanySidebar
              companies={companies}
              onAddCompany={handleAddCompany}
              onEditCompany={handleEditCompany}
              onDeleteCompany={handleDeleteCompany}
              onToggleVisibility={toggleCompanyVisibility}
            />
          )}
        </div>
      </div>

      <CompanyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCompany(undefined);
        }}
        onSave={handleSaveCompany}
        editingCompany={editingCompany}
      />

      <YearCalendar
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedMonth={selectedMonth}
        onMonthSelect={setSelectedMonth}
      />
    </div>
  );
}



// 会社サイドバーコンポーネント
interface CompanySidebarProps {
  companies: Company[];
  onAddCompany: () => void;
  onEditCompany: (company: Company) => void;
  onDeleteCompany: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

const CompanySidebar: React.FC<CompanySidebarProps> = ({
  companies,
  onAddCompany,
  onEditCompany,
  onDeleteCompany,
  onToggleVisibility,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || company.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDelete = (company: Company) => {
    if (window.confirm(`「${company.name}」を完全に削除してもよろしいですか？\n※この操作は取り消せません。`)) {
      onDeleteCompany(company.id);
    }
  };

  const getPaymentTypeDisplay = (company: Company) => {
    switch (company.paymentType) {
      case 'regular':
        return (
          <span className="text-xs text-green-600 font-medium">
            定期 ¥{company.regularAmount?.toLocaleString() || '0'}
          </span>
        );
      case 'irregular':
        return <span className="text-xs text-orange-600 font-medium">不定期</span>;
      case 'specific':
        return <span className="text-xs text-purple-600 font-medium">特定月</span>;
      default:
        return null;
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">取引先一覧</h2>
          <button
            onClick={onAddCompany}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>追加</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="企業名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">すべての科目</option>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Company List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {filteredCompanies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">該当する企業がありません</p>
            </div>
          ) : (
            filteredCompanies.map((company) => (
              <div
                key={company.id}
                className={`border rounded-lg p-2 transition-all ${
                  company.isVisible || company.paymentType === 'regular'
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate text-sm">
                      {company.name}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    {company.paymentType !== 'regular' && (
                      <button
                        onClick={() => onToggleVisibility(company.id)}
                        className={`p-1 rounded transition-colors ${
                          company.isVisible
                            ? 'text-blue-600 hover:text-blue-700'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title={company.isVisible ? '非表示にする' : '表示する'}
                      >
                        {company.isVisible ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => onEditCompany(company)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="編集"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(company)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${CATEGORY_COLORS[company.category as keyof typeof CATEGORY_COLORS]}`}>
                    {company.category}
                  </span>
                  <div className="flex items-center space-x-1">
                    {getPaymentTypeDisplay(company)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          <div className="flex justify-between">
            <span>総企業数:</span>
            <span className="font-medium">{companies.length}社</span>
          </div>
          <div className="flex justify-between">
            <span>表示中:</span>
            <span className="font-medium">
              {companies.filter(c => c.paymentType === 'regular' || c.isVisible).length}社
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 保存ボタンコンポーネント
interface SaveButtonProps {
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  onSave: () => void;
}

const SaveButton: React.FC<SaveButtonProps> = ({
  hasUnsavedChanges,
  lastSaved,
  onSave,
}) => {
  const formatLastSaved = () => {
    if (!lastSaved) return '未保存';

    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) {
      return 'たった今保存';
    } else if (minutes < 60) {
      return `${minutes}分前に保存`;
    } else {
      return lastSaved.toLocaleString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <div className="flex items-center space-x-3">
      {/* 保存状態表示 */}
      <div className="flex items-center space-x-2 text-sm">
        {hasUnsavedChanges ? (
          <>
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-orange-600 font-medium">未保存の変更があります</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">{formatLastSaved()}</span>
          </>
        )}
      </div>

      {/* 保存ボタン */}
      <button
        onClick={onSave}
        disabled={!hasUnsavedChanges}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all
          ${hasUnsavedChanges
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        <Save className="w-4 h-4" />
        <span>保存</span>
      </button>

    </div>
  );
};

// 会社モーダルコンポーネント
interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (companyData: Omit<Company, 'id'>) => void;
  editingCompany?: Company;
}

const CompanyModal: React.FC<CompanyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCompany,
}) => {
  const [formData, setFormData] = useState<Partial<Company>>({});

  useEffect(() => {
    if (editingCompany) {
      setFormData(editingCompany);
    } else {
      setFormData({
        name: '',
        bankName: '',
        branchName: '',
        accountType: '普通',
        accountNumber: '',
        category: '広告費',
        paymentType: 'regular',
        regularAmount: 0,
        specificMonths: [],
        isVisible: true,
      });
    }
  }, [editingCompany, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.bankName) return;

    onSave(formData as Omit<Company, 'id'>);
    onClose();
  };

  const handleSpecificMonthToggle = (month: number) => {
    const currentMonths = formData.specificMonths || [];
    if (currentMonths.includes(month)) {
      setFormData({
        ...formData,
        specificMonths: currentMonths.filter(m => m !== month)
      });
    } else {
      setFormData({
        ...formData,
        specificMonths: [...currentMonths, month]
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingCompany ? '企業情報を編集' : '新しい企業を追加'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">企業名 *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">経費科目</label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">支払いタイプ</label>
                <select
                  value={formData.paymentType || 'regular'}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as PaymentType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="regular">定期支払い</option>
                  <option value="irregular">不定期支払い</option>
                  <option value="specific">特定月のみ</option>
                </select>
              </div>

              {(formData.paymentType === 'regular' || formData.paymentType === 'specific') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">金額</label>
                  <input
                    type="number"
                    value={formData.regularAmount || 0}
                    onChange={(e) => setFormData({ ...formData, regularAmount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {formData.paymentType === 'specific' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">対象月</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                      <button
                        key={month}
                        type="button"
                        onClick={() => handleSpecificMonthToggle(month)}
                        className={`p-2 text-xs rounded border transition-colors ${
                          (formData.specificMonths || []).includes(month)
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {month}月
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">銀行名</label>
                  <input
                    type="text"
                    value={formData.bankName || ''}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">支店名</label>
                  <input
                    type="text"
                    value={formData.branchName || ''}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">口座種別</label>
                  <select
                    value={formData.accountType || '普通'}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="普通">普通</option>
                    <option value="当座">当座</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">口座番号</label>
                  <input
                    type="text"
                    value={formData.accountNumber || ''}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 年カレンダーコンポーネント
interface YearCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  onMonthSelect: (month: string) => void;
}

const YearCalendar: React.FC<YearCalendarProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  onMonthSelect,
}) => {
  const [currentYear, setCurrentYear] = useState(() => {
    if (selectedMonth) {
      const [year] = selectedMonth.split('-').map(Number);
      return year || new Date().getFullYear();
    }
    return new Date().getFullYear();
  });

  if (!isOpen) return null;

  const months = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  const handleMonthClick = (monthIndex: number) => {
    const month = `${currentYear}-${(monthIndex + 1).toString().padStart(2, '0')}`;
    onMonthSelect(month);
    onClose();
  };

  const [currentYearNum, currentMonthNum] = selectedMonth.split('-').map(Number);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">月を選択</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentYear(currentYear - 1)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ←
            </button>
            <h3 className="text-lg font-medium text-gray-900">{currentYear}年</h3>
            <button
              onClick={() => setCurrentYear(currentYear + 1)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {months.map((month, index) => {
              const isSelected = currentYear === currentYearNum && index + 1 === currentMonthNum;
              return (
                <button
                  key={index}
                  onClick={() => handleMonthClick(index)}
                  className={`p-3 text-sm rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {month}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Page() {
  return (
    
      <PaymentManagement />
    
  );
}
