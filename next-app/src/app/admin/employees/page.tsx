"use client";

import { useState, useEffect } from 'react';
import { 
  Search, Plus, Edit, Trash, Check, X, AlertCircle, User
} from 'lucide-react';
import { useStoreStore } from '@/stores/storeStore';
import { useBusinessTypeStore } from '@/stores/businessTypeStore';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/app/appLayout/layout';

export interface Employee {
  id: string;
  employeeId: string;
  email: string;
  fullName: string;
  nickname: string;
  storeId: string;
  storeName?: string;
  role?: 'user' | 'admin' | 'super_admin';
  createdAt: string;
  updatedAt: string;
}

const EmployeeManagement = () => {
  const { stores, fetchStores } = useStoreStore();
  const { businessTypes, fetchBusinessTypes } = useBusinessTypeStore();
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState<string>('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state for add/edit
  const [formState, setFormState] = useState<{
    employeeId: string;
    name: string;
    nickname: string;
    storeId: string;
    role: 'user' | 'admin' | 'super_admin';
    password: string;
  }>({
    employeeId: '',
    name: '',
    nickname: '',
    storeId: '',
    role: 'user',
    password: '',
  });
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await fetchStores();
        await fetchBusinessTypes();
        await fetchEmployees();
      } catch (error) {
        console.error('データの取得に失敗しました:', error);
        setError('データの取得に失敗しました。ネットワーク接続とAPIサーバーの状態を確認してください。');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [fetchBusinessTypes, fetchStores]);
  
  const fetchEmployees = async () => {
    try {
      const response = await apiClient.getEmployees();
      if (response.success && response.data) {
        setEmployees(response.data);
      } else {
        console.error('従業員取得エラー:', response.error);
        setError('従業員の取得に失敗しました');
      }
    } catch (error) {
      console.error('従業員取得エラー:', error);
      setError('従業員の取得に失敗しました');
    }
  };
  
  // Get accessible stores based on user role
  const getAccessibleStores = () => {
    if (!user) return [];
    
    if (user.role === 'super_admin') {
      return stores; // 総管理者は全店舗にアクセス可能
    } else if (user.role === 'admin') {
      // 管理者は自分の業態の店舗のみアクセス可能
      const userStore = stores.find(s => s.id === user.storeId);
      if (userStore?.businessTypeId) {
        return stores.filter(s => s.businessTypeId === userStore.businessTypeId);
      }
      return stores.filter(s => s.id === user.storeId);
    }
    return [];
  };

  // Filter employees based on search, store, business type, and user permissions
  useEffect(() => {
    let filtered = employees;
    
    // Apply access control based on user role
    if (user?.role === 'admin') {
      // 管理者は自分の業態の従業員のみ管理可能
      const accessibleStores = getAccessibleStores();
      const accessibleStoreIds = accessibleStores.map(s => s.id);
      filtered = filtered.filter(emp => accessibleStoreIds.includes(emp.storeId));
    }
    // 総管理者は全従業員にアクセス可能
    
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId.includes(searchTerm)
      );
    }
    
    if (selectedBusinessTypeId) {
      const businessTypeStores = stores.filter(s => s.businessTypeId === selectedBusinessTypeId);
      const businessTypeStoreIds = businessTypeStores.map(s => s.id);
      filtered = filtered.filter(emp => businessTypeStoreIds.includes(emp.storeId));
    }
    
    if (selectedStoreId) {
      filtered = filtered.filter(emp => emp.storeId === selectedStoreId);
    }
    
    setFilteredEmployees(filtered);
  }, [employees, searchTerm, selectedStoreId, selectedBusinessTypeId, user, stores, getAccessibleStores]);
  
  // Handle add employee
  const handleAddEmployee = async () => {
    if (!formState.employeeId || !formState.name || !formState.nickname || !formState.storeId || !formState.password) {
      setError('すべての項目を入力してください。');
      return;
    }
    
    if (!/^\d{4}$/.test(formState.employeeId)) {
      setError('勤怠番号は4桁の数字を入力してください。');
      return;
    }
    
    if (formState.password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }
    
    // Check if employee ID already exists
    if (employees.some(emp => emp.employeeId === formState.employeeId)) {
      setError('この勤怠番号は既に使用されています。');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await apiClient.createEmployee({
        employeeId: formState.employeeId,
        fullName: formState.name,
        nickname: formState.nickname,
        storeId: formState.storeId,
        role: formState.role,
        password: formState.password,
      });
      
      if (response.success) {
        setSuccess('従業員が正常に追加されました。');
        await fetchEmployees(); // 再取得
      } else {
        setError(response.error || '従業員の追加に失敗しました');
      }
      
      // Reset form
      setFormState({
        employeeId: '',
        name: '',
        nickname: '',
        storeId: '',
        role: 'user',
        password: '',
      });
      
      setShowAddModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '従業員の追加中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle edit employee
  const handleEditEmployee = async () => {
    if (!selectedEmployee) return;
    
    if (!formState.employeeId || !formState.name || !formState.nickname || !formState.storeId) {
      setError('勤怠番号、氏名、ニックネーム、店舗を入力してください。');
      return;
    }
    
    if (!/^\d{4}$/.test(formState.employeeId)) {
      setError('勤怠番号は4桁の数字を入力してください。');
      return;
    }
    
    // Check if employee ID already exists (except for this employee)
    if (employees.some(emp => emp.employeeId === formState.employeeId && emp.id !== selectedEmployee.id)) {
      setError('この勤怠番号は既に使用されています。');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await apiClient.updateEmployee(selectedEmployee.id, {
        fullName: formState.name,
        nickname: formState.nickname,
        storeId: formState.storeId,
        role: formState.role,
      });
      
      if (response.success) {
        setSuccess('従業員が正常に更新されました。');
        await fetchEmployees(); // 再取得
      } else {
        setError(response.error || '従業員の更新に失敗しました');
      }
      
      setShowEditModal(false);
      setTimeout(() => setSuccess(''), 3000);
      
      setFormState({
        employeeId: '',
        name: '',
        nickname: '',
        storeId: '',
        role: 'user',
        password: '',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '従業員の更新中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle delete employee
  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await apiClient.deleteEmployee(selectedEmployee.id);
      
      if (response.success) {
        setSuccess('従業員が正常に削除されました。');
        await fetchEmployees(); // 再取得
      } else {
        setError(response.error || '従業員の削除に失敗しました');
      }
      
      setShowDeleteModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '従業員の削除中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormState({
      employeeId: employee.employeeId,
      name: employee.fullName,
      nickname: employee.nickname,
      storeId: employee.storeId,
      role: employee.role || 'user',
      password: '',
    });
    setShowEditModal(true);
  };
  
  const openDeleteModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  // 新規作成時のみ「無所属」を除外
  const selectableStores = stores.filter(store => store.name !== '無所属');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="py-8">
        <div className="space-y-6 slide-up">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">従業員管理</h1>
            <button 
              onClick={() => {
                setFormState({
                  employeeId: '',
                  name: '',
                  nickname: '',
                  storeId: stores[0]?.id || '',
                  role: 'user',
                  password: '',
                });
                setShowAddModal(true);
                setError('');
              }}
              className="btn-primary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              従業員を追加
            </button>
          </div>
          
          {/* Success/Error Messages */}
          {success && (
            <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded-md fade-in">
              <div className="flex">
                <Check className="h-5 w-5 text-green-500" />
                <p className="ml-3 text-sm text-green-700">{success}</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-md fade-in">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="ml-3 text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
          
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <label htmlFor="search" className="form-label">検索</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="search"
                    type="text"
                    className="form-input pl-10"
                    placeholder="勤怠番号・氏名・ニックネームで検索"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              {/* 総管理者のみ業態フィルターを表示 */}
              {user?.role === 'super_admin' && (
                <div className="w-full md:w-64">
                  <label htmlFor="business-type-filter" className="form-label">業態</label>
                  <select
                    id="business-type-filter"
                    className="form-input"
                    value={selectedBusinessTypeId}
                    onChange={(e) => setSelectedBusinessTypeId(e.target.value)}
                  >
                    <option value="">すべての業態</option>
                    {businessTypes.map((businessType) => (
                      <option key={businessType.id} value={businessType.id}>
                        {businessType.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="w-full md:w-64">
                <label htmlFor="store-filter" className="form-label">店舗</label>
                <select
                  id="store-filter"
                  className="form-input"
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                >
                  <option value="">すべての店舗</option>
                  {getAccessibleStores().map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Employee List */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      勤怠番号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      氏名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      業態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      所属店舗
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      権限
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        該当する従業員がいません
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.employeeId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary-600" />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">{employee.fullName}</div>
                              <div className="text-xs text-gray-500">{employee.nickname}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(() => {
                            const store = stores.find(s => s.id === employee.storeId);
                            const businessType = businessTypes.find(bt => bt.id === store?.businessTypeId);
                            return businessType?.name || '-';
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stores.find(store => store.id === employee.storeId)?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.role === 'super_admin' ? (
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                              総管理者
                            </span>
                          ) : employee.role === 'admin' ? (
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                              管理者
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              一般
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openEditModal(employee)}
                            className="text-indigo-600 hover:text-indigo-900 mr-2"
                            title="編集"
                            disabled={isSubmitting}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(employee)}
                            className="text-red-600 hover:text-red-900"
                            title="削除"
                            disabled={isSubmitting}
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Add Employee Modal */}
          {showAddModal && (
            <div 
              className="z-50 fade-in" 
              style={{ 
                position: 'fixed', 
                top: '0', 
                left: '0', 
                width: '100vw', 
                height: '100vh', 
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50
              }}
            >
              <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl slide-up mx-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">新しい従業員を追加</h3>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                    disabled={isSubmitting}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="employee-id" className="form-label">勤怠番号（4桁）</label>
                    <input
                      type="text"
                      id="employee-id"
                      className="form-input"
                      value={formState.employeeId}
                      onChange={(e) => setFormState({ ...formState, employeeId: e.target.value })}
                      placeholder="4桁の数字"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="name" className="form-label">氏名</label>
                    <input
                      type="text"
                      id="name"
                      className="form-input"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      placeholder="例: 山田 太郎"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="nickname" className="form-label">ニックネーム</label>
                    <input
                      type="text"
                      id="nickname"
                      className="form-input"
                      value={formState.nickname}
                      onChange={(e) => setFormState({ ...formState, nickname: e.target.value })}
                      placeholder="例: タロウ"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="store" className="form-label">所属店舗</label>
                    <select
                      id="store"
                      className="form-input"
                      value={formState.storeId}
                      onChange={(e) => setFormState({ ...formState, storeId: e.target.value })}
                      disabled={isSubmitting}
                    >
                      <option value="">店舗を選択</option>
                      {selectableStores.map((store) => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="form-label">初期パスワード</label>
                    <input
                      type="password"
                      id="password"
                      className="form-input"
                      value={formState.password}
                      onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                      placeholder="6文字以上"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">権限</label>
                    {user?.role === 'super_admin' ? (
                      <select
                        className="form-input"
                        value={formState.role}
                        onChange={e => setFormState({ ...formState, role: e.target.value as 'user' | 'admin' | 'super_admin' })}
                        disabled={isSubmitting}
                      >
                        <option value="user">一般</option>
                        <option value="admin">管理者</option>
                        <option value="super_admin">総管理者</option>
                      </select>
                    ) : (
                      <select
                        className="form-input"
                        value={formState.role}
                        onChange={e => setFormState({ ...formState, role: e.target.value as 'user' | 'admin' | 'super_admin' })}
                        disabled={isSubmitting}
                      >
                        <option value="user">一般</option>
                        <option value="admin">管理者</option>
                      </select>
                    )}
                  </div>
                  
                  {error && (
                    <div className="flex items-center text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-outline"
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEmployee}
                    className="btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        追加中...
                      </span>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        追加する
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Edit Employee Modal */}
          {showEditModal && selectedEmployee && (
            <div 
              className="z-50 fade-in" 
              style={{ 
                position: 'fixed', 
                top: '0', 
                left: '0', 
                width: '100vw', 
                height: '100vh', 
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50
              }}
            >
              <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl slide-up mx-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">従業員情報を編集</h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                    disabled={isSubmitting}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="edit-employee-id" className="form-label">勤怠番号（4桁）</label>
                    <input
                      type="text"
                      id="edit-employee-id"
                      className="form-input"
                      value={formState.employeeId}
                      onChange={(e) => setFormState({ ...formState, employeeId: e.target.value })}
                      placeholder="4桁の数字"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-name" className="form-label">氏名</label>
                    <input
                      type="text"
                      id="edit-name"
                      className="form-input"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      placeholder="例: 山田 太郎"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-nickname" className="form-label">ニックネーム</label>
                    <input
                      type="text"
                      id="edit-nickname"
                      className="form-input"
                      value={formState.nickname}
                      onChange={(e) => setFormState({ ...formState, nickname: e.target.value })}
                      placeholder="例: タロウ"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-store" className="form-label">所属店舗</label>
                    <select
                      id="edit-store"
                      className="form-input"
                      value={formState.storeId}
                      onChange={(e) => setFormState({ ...formState, storeId: e.target.value })}
                      disabled={isSubmitting}
                    >
                      <option value="">店舗を選択</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">権限</label>
                    {user?.role === 'super_admin' ? (
                      <select
                        className="form-input"
                        value={formState.role}
                        onChange={e => setFormState({ ...formState, role: e.target.value as 'user' | 'admin' | 'super_admin' })}
                        disabled={isSubmitting}
                      >
                        <option value="user">一般</option>
                        <option value="admin">管理者</option>
                        <option value="super_admin">総管理者</option>
                      </select>
                    ) : (
                      <select
                        className="form-input"
                        value={formState.role}
                        onChange={e => setFormState({ ...formState, role: e.target.value as 'user' | 'admin' | 'super_admin' })}
                        disabled={isSubmitting}
                      >
                        <option value="user">一般</option>
                        <option value="admin">管理者</option>
                      </select>
                    )}
                  </div>
                  
                  {error && (
                    <div className="flex items-center text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn-outline"
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleEditEmployee}
                    className="btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        保存中...
                      </span>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        保存する
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Delete Employee Modal */}
          {showDeleteModal && selectedEmployee && (
            <div 
              className="z-50 fade-in" 
              style={{ 
                position: 'fixed', 
                top: '0', 
                left: '0', 
                width: '100vw', 
                height: '100vh', 
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50
              }}
            >
              <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl slide-up mx-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 bg-red-100 rounded-full p-2">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">従業員を削除</h3>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  「{selectedEmployee.fullName}（{selectedEmployee.nickname}）」を削除しますか？この操作は取り消せません。
                </p>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="btn-outline"
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEmployee}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        削除中...
                      </span>
                    ) : (
                      <>
                        <Trash className="h-4 w-4 mr-2 inline" />
                        削除する
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default function Page() {
  return (
    <AppLayout>
      <EmployeeManagement />
    </AppLayout>
  );
}