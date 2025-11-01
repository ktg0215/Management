"use client";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Edit2, EyeOff, Building, RotateCcw, Calendar, Plus, X, Save, RefreshCw, Trash2, Eye, Search, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';

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

// デモデータ
const DEMO_COMPANIES: Company[] = [
  {
    id: '1',
    name: 'Google広告',
    bankName: 'みずほ銀行',
    branchName: '新宿支店',
    accountType: '普通',
    accountNumber: '1234567',
    category: '広告費',
    paymentType: 'regular',
    regularAmount: 150000,
    isVisible: true,
  },
  {
    id: '2',
    name: 'Facebook広告',
    bankName: 'みずほ銀行',
    branchName: '渋谷支店',
    accountType: '普通',
    accountNumber: '2345678',
    category: '広告費',
    paymentType: 'irregular',
    isVisible: true,
  },
  {
    id: '3',
    name: '東京電力',
    bankName: '三菱UFJ銀行',
    branchName: '東京駅前支店',
    accountType: '普通',
    accountNumber: '3456789',
    category: '水道光熱費',
    paymentType: 'regular',
    regularAmount: 25000,
    isVisible: true,
  },
  {
    id: '4',
    name: '東京ガス',
    bankName: '三菱UFJ銀行',
    branchName: '東京駅前支店',
    accountType: '普通',
    accountNumber: '4567890',
    category: '水道光熱費',
    paymentType: 'regular',
    regularAmount: 18000,
    isVisible: true,
  },
  {
    id: '5',
    name: 'NTTドコモ',
    bankName: '三井住友銀行',
    branchName: '丸の内支店',
    accountType: '普通',
    accountNumber: '5678901',
    category: '通信費',
    paymentType: 'regular',
    regularAmount: 12000,
    isVisible: true,
  },
  {
    id: '6',
    name: 'AWS',
    bankName: '三井住友銀行',
    branchName: '丸の内支店',
    accountType: '普通',
    accountNumber: '6789012',
    category: '通信費',
    paymentType: 'irregular',
    isVisible: false,
  },
  {
    id: '7',
    name: '三井不動産',
    bankName: 'みずほ銀行',
    branchName: '日本橋支店',
    accountType: '普通',
    accountNumber: '7890123',
    category: '賃貸料',
    paymentType: 'regular',
    regularAmount: 280000,
    isVisible: true,
  },
  {
    id: '8',
    name: '東京海上日動',
    bankName: '三菱UFJ銀行',
    branchName: '大手町支店',
    accountType: '普通',
    accountNumber: '8901234',
    category: '保険料',
    paymentType: 'specific',
    specificMonths: [3, 6, 9, 12],
    isVisible: true,
  },
  {
    id: '9',
    name: 'アスクル',
    bankName: '三井住友銀行',
    branchName: '品川支店',
    accountType: '普通',
    accountNumber: '9012345',
    category: '消耗品費',
    paymentType: 'irregular',
    isVisible: false,
  },
  {
    id: '10',
    name: 'デザイン会社ABC',
    bankName: 'みずほ銀行',
    branchName: '青山支店',
    accountType: '普通',
    accountNumber: '0123456',
    category: '外注費',
    paymentType: 'irregular',
    isVisible: true,
  },
];

const DEMO_PAYMENTS: Payment[] = [
  {
    id: 'p1',
    companyId: '1',
    month: '2024-12',
    amount: 150000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p2',
    companyId: '2',
    month: '2024-12',
    amount: 85000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p3',
    companyId: '3',
    month: '2024-12',
    amount: 25000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p4',
    companyId: '4',
    month: '2024-12',
    amount: 18000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p5',
    companyId: '5',
    month: '2024-12',
    amount: 12000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p6',
    companyId: '6',
    month: '2024-12',
    amount: 45000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p7',
    companyId: '7',
    month: '2024-12',
    amount: 280000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p8',
    companyId: '8',
    month: '2024-12',
    amount: 120000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p9',
    companyId: '9',
    month: '2024-12',
    amount: 32000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p10',
    companyId: '10',
    month: '2024-12',
    amount: 180000,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
];

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

const usePaymentData = () => {
  // 初期化時にローカルストレージからデータを読み込み
  const [companies, setCompanies] = useState<Company[]>(() =>
    loadFromStorage(STORAGE_KEYS.COMPANIES, DEMO_COMPANIES)
  );

  const [payments, setPayments] = useState<Payment[]>(() =>
    loadFromStorage(STORAGE_KEYS.PAYMENTS, DEMO_PAYMENTS)
  );

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const stored = loadFromStorage(STORAGE_KEYS.SELECTED_MONTH, '');
    if (stored) return stored;

    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    const companies = loadFromStorage(STORAGE_KEYS.COMPANIES, []);
    return companies.length > 0 ? new Date() : null;
  });

  // データが変更されたときに未保存フラグを立てる
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [companies, payments]);

  // 選択月が変更されたときに保存
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SELECTED_MONTH, selectedMonth);
  }, [selectedMonth]);

  // 手動保存機能
  const saveData = useCallback(() => {
    saveToStorage(STORAGE_KEYS.COMPANIES, companies);
    saveToStorage(STORAGE_KEYS.PAYMENTS, payments);
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  }, [companies, payments]);

  // データリセット機能
  const resetData = useCallback(() => {
    if (window.confirm('すべてのデータをリセットしてデモデータに戻しますか？\n※この操作は取り消せません。')) {
      setCompanies(DEMO_COMPANIES);
      setPayments(DEMO_PAYMENTS);
      localStorage.removeItem(STORAGE_KEYS.COMPANIES);
      localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    }
  }, []);

  const addCompany = useCallback((company: Omit<Company, 'id'>) => {
    const newCompany: Company = {
      ...company,
      id: Date.now().toString(),
      isVisible: true,
    };
    setCompanies(prev => [...prev, newCompany]);
  }, []);

  const updateCompany = useCallback((id: string, updates: Partial<Company>) => {
    setCompanies(prev => prev.map(company =>
      company.id === id ? { ...company, ...updates } : company
    ));
  }, []);

  const deleteCompany = useCallback((id: string) => {
    setCompanies(prev => prev.filter(company => company.id !== id));
    setPayments(prev => prev.filter(payment => payment.companyId !== id));
  }, []);

  const toggleCompanyVisibility = useCallback((id: string) => {
    setCompanies(prev => prev.map(company =>
      company.id === id ? { ...company, isVisible: !company.isVisible } : company
    ));
  }, []);

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
        id: Date.now().toString(),
        companyId,
        month: selectedMonth,
        amount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setPayments(prev => [...prev, newPayment]);
    }
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
    return payments
      .filter(p => {
        const company = companies.find(c => c.id === p.companyId);
        return p.month === selectedMonth && company && (
          company.paymentType === 'regular' || company.isVisible
        );
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments, selectedMonth, companies]);

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
    resetData,
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
  const { user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
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
    resetData,
  } = usePaymentData();

  const storeName = user?.storeId ? stores.find(store => store.id === user.storeId)?.name || '株式会社サンプル' : '株式会社サンプル';

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (stores.length === 0) fetchStores();
  }, [stores.length, fetchStores]);

  const handleSaveCompany = (companyData: Omit<Company, 'id'>) => {
    if (editingCompany) {
      updateCompany(editingCompany.id, companyData);
    } else {
      addCompany(companyData);
    }
    setEditingCompany(undefined);
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleDeleteCompany = (id: string) => {
    deleteCompany(id);
  };

  const handleAddCompany = () => {
    setEditingCompany(undefined);
    setIsModalOpen(true);
  };

  const formatSelectedMonth = () => {
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

              {/* Save Button and Store Name */}
              <div className="flex items-center space-x-6">
{isHydrated && (
                <SaveButton
                  hasUnsavedChanges={hasUnsavedChanges}
                  lastSaved={lastSaved}
                  onSave={saveData}
                  onReset={resetData}
                />
                )}

                <div className="text-lg font-semibold text-gray-900">
                  {storeName}
                </div>
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
  onReset: () => void;
}

const SaveButton: React.FC<SaveButtonProps> = ({
  hasUnsavedChanges,
  lastSaved,
  onSave,
  onReset,
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

      {/* リセットボタン */}
      <button
        onClick={onReset}
        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
      >
        <RotateCcw className="w-4 h-4" />
        <span>リセット</span>
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
    const [year] = selectedMonth.split('-').map(Number);
    return year;
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
