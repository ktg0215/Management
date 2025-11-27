'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { Company } from '@/types/company';
import apiClient from '@/lib/api';
import { formatStoreName } from '@/utils/storeDisplay';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  CreditCard,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  '水道光熱費',
  '通信費',
  '広告費',
  '地代家賃',
  '消耗品費',
  '修繕費',
  '保険料',
  'その他'
];

const PAYMENT_TYPES = [
  { value: 'regular', label: '定期支払い（毎月）' },
  { value: 'specific', label: '定期支払い（選択した月）' },
  { value: 'irregular', label: '不定期支払い' }
];

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (company: Omit<Company, 'id'>) => Promise<void>;
  company?: Company;
}

const CompanyModal: React.FC<CompanyModalProps> = ({ isOpen, onClose, onSave, company }) => {
  const { user } = useAuthStore();
  const { stores } = useStoreStore();
  const [formData, setFormData] = useState<Omit<Company, 'id'>>({
    name: '',
    bankName: '',
    branchName: '',
    accountType: '普通',
    accountNumber: '',
    category: EXPENSE_CATEGORIES[0],
    paymentType: 'regular',
    regularAmount: 0,
    specificMonths: [],
    isVisible: true,
    storeId: user?.storeId || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>(EXPENSE_CATEGORIES);

  // PL科目一覧を取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apiClient.getPLSubjects();
        if (response.success && response.data && response.data.length > 0) {
          // 既存のEXPENSE_CATEGORIESとPL科目をマージして重複を除去
          const merged = [...new Set([...EXPENSE_CATEGORIES, ...response.data])].sort();
          setAvailableCategories(merged);
        }
      } catch (error) {
        console.error('科目一覧の取得に失敗しました:', error);
        // エラー時はデフォルトの科目リストを使用
        setAvailableCategories(EXPENSE_CATEGORIES);
      }
    };
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (company) {
      // specificMonthsを数値配列として確実に設定
      setFormData({
        ...company,
        specificMonths: Array.isArray(company.specificMonths) 
          ? company.specificMonths.map((m: any) => typeof m === 'string' ? parseInt(m, 10) : m)
          : (company.specificMonths ? [company.specificMonths] : [])
      });
    } else {
      setFormData({
        name: '',
        bankName: '',
        branchName: '',
        accountType: '普通',
        accountNumber: '',
        category: availableCategories[0] || EXPENSE_CATEGORIES[0],
        paymentType: 'regular',
        regularAmount: 0,
        specificMonths: [],
        isVisible: true,
        storeId: user?.storeId || ''
      });
    }
    setError(null);
  }, [company, user?.storeId, availableCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch {
      setError('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Omit<Company, 'id'>, value: string | number | boolean | number[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {company ? '取引先編集' : '新規取引先登録'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  取引先名 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  科目
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableCategories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  銀行名
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  支店名
                </label>
                <input
                  type="text"
                  value={formData.branchName}
                  onChange={(e) => handleChange('branchName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  口座種別
                </label>
                <select
                  value={formData.accountType}
                  onChange={(e) => handleChange('accountType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="普通">普通</option>
                  <option value="当座">当座</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  口座番号
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => handleChange('accountNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  支払いタイプ
                </label>
                <select
                  value={formData.paymentType}
                  onChange={(e) => {
                    const newPaymentType = e.target.value as 'regular' | 'irregular' | 'specific';
                    console.log('[CompanyModal] Payment type changed:', newPaymentType);
                    handleChange('paymentType', newPaymentType);
                    // specificタイプに変更した場合、specificMonthsを初期化
                    if (newPaymentType === 'specific' && (!formData.specificMonths || formData.specificMonths.length === 0)) {
                      handleChange('specificMonths', []);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PAYMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.paymentType === 'regular' || formData.paymentType === 'specific') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      定期支払い金額
                    </label>
                    <input
                      type="number"
                      value={formData.regularAmount || 0}
                      onChange={(e) => handleChange('regularAmount', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                  {formData.paymentType === 'specific' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        支払い月を選択（複数選択可）
                      </label>
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                          <label key={month} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={(formData.specificMonths || []).includes(month)}
                              onChange={(e) => {
                                const currentMonths = formData.specificMonths || [];
                                const newMonths = e.target.checked
                                  ? [...currentMonths, month]
                                  : currentMonths.filter((m) => m !== month);
                                console.log('[CompanyModal] Specific months changed:', newMonths);
                                handleChange('specificMonths', newMonths.sort((a, b) => a - b));
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{month}月</span>
                          </label>
                        ))}
                      </div>
                      {formData.specificMonths && formData.specificMonths.length > 0 && (
                        <p className="mt-2 text-xs text-gray-500">
                          選択中: {formData.specificMonths.map(m => `${m}月`).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {user?.role === 'super_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    店舗
                  </label>
                  <select
                    value={formData.storeId}
                    onChange={(e) => handleChange('storeId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {stores.filter(store => store.name !== 'Manager').map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={formData.isVisible}
                  onChange={(e) => handleChange('isVisible', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="isVisible" className="text-sm text-gray-700">
                  表示する
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

function CompaniesPage() {
  const { user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>();

  const loadCompanies = useCallback(async () => {
    if (!selectedStoreId) {
      setError('店舗が選択されていません');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCompanies(selectedStoreId);
      console.log('[取引先管理] API Response:', {
        success: response.success,
        hasData: !!response.data,
        dataLength: response.data ? response.data.length : 0,
        data: response.data,
        error: response.error,
        selectedStoreId
      });
      if (response.success && response.data) {
        // specificMonthsを数値配列に変換（データベースから取得した配列をそのまま使用）
        const processedData = response.data.map((company: any) => ({
          ...company,
          specificMonths: Array.isArray(company.specificMonths) 
            ? company.specificMonths.map((m: any) => typeof m === 'string' ? parseInt(m, 10) : m)
            : (company.specificMonths ? [company.specificMonths] : [])
        }));
        console.log('[取引先管理] Setting companies:', processedData);
        setCompanies(processedData);
      } else {
        const errorMessage = response.error || '取引先データの取得に失敗しました';
        setError(errorMessage);
        console.error('API Error:', errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '取引先データの取得に失敗しました';
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        setError('認証に失敗しました。再度ログインしてください。');
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        setError('ネットワークエラーが発生しました。接続を確認してください。');
      } else {
        setError('取引先データの取得に失敗しました');
      }
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    if (user?.storeId && selectedStoreId === '') {
      setSelectedStoreId(String(user.storeId || ''));
    }
  }, [user?.storeId, selectedStoreId]);

  useEffect(() => {
    if (selectedStoreId) {
      loadCompanies();
    } else {
      // selectedStoreIdが空の場合はcompaniesをクリア
      setCompanies([]);
    }
  }, [selectedStoreId, loadCompanies]);

  const handleCreateCompany = async (companyData: Omit<Company, 'id'>) => {
    // バリデーション
    if (!companyData.name?.trim()) {
      throw new Error('取引先名は必須です');
    }
    if (!companyData.category) {
      throw new Error('科目の選択は必須です');
    }
    if (!companyData.storeId) {
      throw new Error('店舗の選択は必須です');
    }

    try {
      const response = await apiClient.createCompany(companyData);
      if (response.success) {
        await loadCompanies();
      } else {
        throw new Error(response.error || '作成に失敗しました');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('409') || error.message.includes('already exists')) {
          throw new Error('同じ名前の取引先が既に存在します');
        }
      }
      throw error;
    }
  };

  const handleUpdateCompany = async (companyData: Omit<Company, 'id'>) => {
    if (!editingCompany) return;
    
    try {
      const response = await apiClient.updateCompany(editingCompany.id, companyData);
      if (response.success) {
        await loadCompanies();
      } else {
        throw new Error(response.error || '更新に失敗しました');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteCompany = async (id: string) => {
    // 警告メッセージと認証要求
    const warningMessage = `警告: この取引先を削除しようとしています。\n\nこの操作は取り消せません。\n\n続行するには、勤怠番号とパスワードを再入力してください。`;
    
    if (!confirm(warningMessage)) {
      return;
    }

    // 勤怠番号とパスワードの再入力
    const employeeId = prompt('勤怠番号を入力してください:');
    if (!employeeId) {
      setError('勤怠番号が入力されませんでした');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const password = prompt('パスワードを入力してください:');
    if (!password) {
      setError('パスワードが入力されませんでした');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // 認証確認
    try {
      const authResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employeeId, password }),
      });

      const authData = await authResponse.json();
      
      if (!authData.success) {
        setError('認証に失敗しました。勤怠番号またはパスワードが正しくありません。');
        setTimeout(() => setError(''), 5000);
        return;
      }

      // 認証成功後、削除を実行
      const response = await apiClient.deleteCompany(id);
      if (response.success) {
        await loadCompanies();
        setError(null); // エラーをクリア
      } else {
        const errorMessage = response.error || '削除に失敗しました';
        setError(errorMessage);
        setTimeout(() => setError(''), 10000); // 10秒後にエラーをクリア
      }
    } catch (error: any) {
      console.error('削除エラー:', error);
      const errorMessage = error?.response?.data?.error || error?.message || '削除に失敗しました。ネットワークエラーが発生した可能性があります。';
      setError(errorMessage);
      setTimeout(() => setError(''), 10000); // 10秒後にエラーをクリア
    }
  };

  const handleToggleVisibility = async (company: Company) => {
    try {
      const response = await apiClient.updateCompany(company.id, {
        ...company,
        isVisible: !company.isVisible
      });
      if (response.success) {
        await loadCompanies();
      }
    } catch {
      setError('表示設定の変更に失敗しました');
    }
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.bankName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '' || company.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryCounts = EXPENSE_CATEGORIES.reduce((acc, category) => {
    acc[category] = companies.filter(c => c.category === category).length;
    return acc;
  }, {} as Record<string, number>);

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingCompany(undefined);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCompany(undefined);
  };

  if (loading && companies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">取引先管理</h1>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>新規登録</span>
            </button>
          </div>

          {/* 店舗選択 */}
          {user?.role === 'super_admin' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                表示店舗
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {stores.filter(store => store.name !== 'Manager').map(store => {
                  console.log('Store data:', store);
                  return (
                    <option key={store.id} value={store.id}>
                      {formatStoreName(store)}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* 検索・フィルター */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="取引先名・銀行名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全ての科目</option>
                {EXPENSE_CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category} ({categoryCounts[category] || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* 取引先一覧 */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              取引先一覧 ({filteredCompanies.length}社)
            </h2>
          </div>

          {filteredCompanies.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                取引先が見つかりません
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedCategory 
                  ? '検索条件に合う取引先がありません' 
                  : 'まだ取引先が登録されていません'}
              </p>
              {!searchTerm && !selectedCategory && (
                <button
                  onClick={openCreateModal}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  最初の取引先を登録する
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      取引先名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      科目
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      銀行情報
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支払いタイプ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCompanies.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {company.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {company.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{company.bankName}</div>
                        <div className="text-gray-500">{company.branchName} / {company.accountType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <CreditCard className="w-4 h-4 text-gray-400 mr-1" />
                          {company.paymentType === 'regular' ? '定期' : '不定期'}
                          {company.paymentType === 'regular' && company.regularAmount && (
                            <span className="ml-2 text-gray-600">
                              ¥{company.regularAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleVisibility(company)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            company.isVisible
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {company.isVisible ? (
                            <>
                              <Eye className="w-3 h-3 mr-1" />
                              表示
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 mr-1" />
                              非表示
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditModal(company)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(company.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* モーダル */}
      <CompanyModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={editingCompany ? handleUpdateCompany : handleCreateCompany}
        company={editingCompany}
      />
    </div>
  );
}

export default function Page() {
  return (
    <>
      <CompaniesPage />
    </>
  );
}