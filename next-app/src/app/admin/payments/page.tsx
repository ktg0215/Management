'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Eye, EyeOff, Save, RotateCcw, Calendar, DollarSign, Building, CreditCard, Users, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName } from '@/utils/storeDisplay';

export type PaymentType = 'regular' | 'irregular' | 'specific';

export type ExpenseCategory = 
  | '広告費' 
  | '水道光熱費' 
  | '通信費' 
  | '賃借料' 
  | '保険料' 
  | '消耗品費' 
  | '交通費' 
  | '外注費' 
  | 'その他';

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
  storeId: string;
}

export interface Payment {
  id: string;
  companyId: string;
  month: string; // YYYY-MM format
  amount: number;
  storeId: string;
  createdAt: Date;
  updatedAt: Date;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  '広告費',
  '水道光熱費', 
  '通信費',
  '賃借料',
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
  '賃借料': 'bg-orange-50 border-orange-200 text-orange-800',
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
    storeId: '1',
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
    storeId: '1',
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
    storeId: '1',
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
    storeId: '1',
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
    storeId: '1',
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
    storeId: '1',
  },
  {
    id: '7',
    name: '三井不動産',
    bankName: 'みずほ銀行',
    branchName: '日本橋支店',
    accountType: '普通',
    accountNumber: '7890123',
    category: '賃借料',
    paymentType: 'regular',
    regularAmount: 280000,
    isVisible: true,
    storeId: '1',
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
    regularAmount: 32000,
    isVisible: true,
    storeId: '1',
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
    isVisible: true,
    storeId: '1',
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
    storeId: '1',
  },
];

const DEMO_PAYMENTS: Payment[] = [
  {
    id: 'p1',
    companyId: '1',
    month: '2024-12',
    amount: 150000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p2',
    companyId: '2',
    month: '2024-12',
    amount: 85000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p3',
    companyId: '3',
    month: '2024-12',
    amount: 25000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p4',
    companyId: '4',
    month: '2024-12',
    amount: 18000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p5',
    companyId: '5',
    month: '2024-12',
    amount: 12000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p6',
    companyId: '6',
    month: '2024-12',
    amount: 45000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p7',
    companyId: '7',
    month: '2024-12',
    amount: 280000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p8',
    companyId: '8',
    month: '2024-12',
    amount: 120000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p9',
    companyId: '9',
    month: '2024-12',
    amount: 32000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  {
    id: 'p10',
    companyId: '10',
    month: '2024-12',
    amount: 180000,
    storeId: '1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
];

// ローカルストレージのキー（店舗別）
const getStorageKeys = (storeId: string) => ({
  COMPANIES: `payment-system-companies-${storeId}`,
  PAYMENTS: `payment-system-payments-${storeId}`,
  SELECTED_MONTH: `payment-system-selected-month-${storeId}`,
});

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('ローカルストレージ保存エラー:', error);
  }
};

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error('ローカルストレージ読み込みエラー:', error);
    return defaultValue;
  }
};

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const storageKeys = useMemo(() => {
    if (!selectedStoreId || typeof selectedStoreId !== 'string') {
      return { COMPANIES: '', PAYMENTS: '', SELECTED_MONTH: '' };
    }
    return getStorageKeys(selectedStoreId);
  }, [selectedStoreId]);

  // 店舗データを取得
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      fetchStores();
    }
  }, [user, fetchStores]);

  // ユーザーの権限に応じて初期店舗を設定
  useEffect(() => {
    if (user && stores.length > 0) {
      if (user.role === 'admin') {
        setSelectedStoreId(user.storeId);
      }
    }
  }, [user, stores]);

  // 店舗が変更された時にデータを再読み込み
  useEffect(() => {
    if (selectedStoreId) {
      const storeCompanies = DEMO_COMPANIES.filter(c => c.storeId === selectedStoreId);
      const storePayments = DEMO_PAYMENTS.filter(p => p.storeId === selectedStoreId);
      
      setCompanies(loadFromStorage(storageKeys.COMPANIES, storeCompanies));
      setPayments(loadFromStorage(storageKeys.PAYMENTS, storePayments));
      
      const stored = loadFromStorage(storageKeys.SELECTED_MONTH, '');
      if (stored) {
        setSelectedMonth(stored);
      } else {
        const now = new Date();
        setSelectedMonth(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);
      }
    }
  }, [selectedStoreId, storageKeys]);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
  };

  const getPaymentAmount = (companyId: string) => {
    const payment = payments.find(p => p.companyId === companyId && p.month === selectedMonth);
    return payment?.amount || 0;
  };

  const handleAmountChange = (companyId: string, amount: number) => {
    setPayments(prev => {
      const existing = prev.find(p => p.companyId === companyId && p.month === selectedMonth);
      if (existing) {
        return prev.map(p => 
          p.id === existing.id 
            ? { ...p, amount, updatedAt: new Date() }
            : p
        );
      } else {
        const newPayment: Payment = {
          id: `p${Date.now()}`,
          companyId,
          month: selectedMonth,
          amount,
          storeId: selectedStoreId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return [...prev, newPayment];
      }
    });
    setHasUnsavedChanges(true);
  };

  const saveData = useCallback(() => {
    if (!selectedStoreId) return;
    saveToStorage(storageKeys.COMPANIES, companies);
    saveToStorage(storageKeys.PAYMENTS, payments);
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  }, [companies, payments, selectedStoreId, storageKeys]);

  const resetData = useCallback(() => {
    if (!selectedStoreId) return;
    if (window.confirm('すべてのデータをリセットしてデモデータに戻しますか？\n※この操作は取り消せません。')) {
      const storeCompanies = DEMO_COMPANIES.filter(c => c.storeId === selectedStoreId);
      const storePayments = DEMO_PAYMENTS.filter(p => p.storeId === selectedStoreId);
      setCompanies(storeCompanies);
      setPayments(storePayments);
      localStorage.removeItem(storageKeys.COMPANIES);
      localStorage.removeItem(storageKeys.PAYMENTS);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    }
  }, [selectedStoreId, storageKeys]);

  // 権限チェック（管理者以上のみアクセス可能）
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
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

  // 現在選択されている店舗名を取得
  const getCurrentStoreName = () => {
    if (!selectedStoreId) return '';
    const selectedStore = stores.find(store => store.id === selectedStoreId);
    return selectedStore ? formatStoreName(selectedStore) : '';
  };

  const months = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  const currentMonthIndex = parseInt(selectedMonth.split('-')[1]) - 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">支払い管理</h1>
              </div>
              {user.role === 'super_admin' && (
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <select
                    value={selectedStoreId}
                    onChange={(e) => handleStoreChange(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">店舗を選択</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {formatStoreName(store)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {hasUnsavedChanges && (
                <span className="text-sm text-orange-600 flex items-center">
                  <div className="w-2 h-2 bg-orange-600 rounded-full mr-2"></div>
                  未保存の変更があります
                </span>
              )}
              <button
                onClick={saveData}
                disabled={!hasUnsavedChanges}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>保存</span>
              </button>
              <button
                onClick={resetData}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>リセット</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedStoreId && user.role === 'super_admin' ? (
          <div className="text-center py-12">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              店舗を選択してください
            </h3>
            <p className="text-gray-600">
              支払いデータを表示するには、上記から店舗を選択してください。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Month Selector */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  月選択
                </h2>
                <div className="text-sm text-gray-500">
                  {selectedMonth && `${selectedMonth.split('-')[0]}年${selectedMonth.split('-')[1]}月`}
                </div>
              </div>
              
              <div className="grid grid-cols-6 gap-2">
                {months.map((month, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      const year = selectedMonth.split('-')[0];
                      setSelectedMonth(`${year}-${(index + 1).toString().padStart(2, '0')}`);
                    }}
                    className={`p-3 text-sm font-medium rounded-md transition-colors ${
                      index === currentMonthIndex
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Categories */}
            <div className="space-y-6">
              {EXPENSE_CATEGORIES.map(category => {
                const categoryCompanies = companies.filter(c => c.category === category && c.isVisible !== false);
                const categoryTotal = categoryCompanies.reduce((sum, company) => {
                  return sum + getPaymentAmount(company.id);
                }, 0);

                if (categoryCompanies.length === 0) return null;

                return (
                  <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[category]}`}>
                            {category}
                          </span>
                          <span className="text-sm text-gray-500">
                            {categoryCompanies.length}社
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            ¥{categoryTotal.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryCompanies.map(company => (
                          <div key={company.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-medium text-gray-900">{company.name}</h3>
                              <div className="flex items-center space-x-2">
                                <button className="text-gray-400 hover:text-gray-600">
                                  <EyeOff className="h-4 w-4" />
                                </button>
                                <button className="text-gray-400 hover:text-gray-600">
                                  <Edit className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm text-gray-600">
                              <div>{company.bankName} {company.branchName}</div>
                              <div>{company.accountType} {company.accountNumber}</div>
                            </div>
                            
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                支払い金額
                              </label>
                              <input
                                type="number"
                                value={getPaymentAmount(company.id)}
                                onChange={(e) => handleAmountChange(company.id, parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 