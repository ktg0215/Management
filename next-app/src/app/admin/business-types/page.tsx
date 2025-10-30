"use client";
import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
import { useBusinessTypeStore } from '@/stores/businessTypeStore';
import { BusinessType } from '@/lib/api';

const BusinessTypesPage = () => {
  const { businessTypes, isLoading, fetchBusinessTypes, createBusinessType, updateBusinessType, deleteBusinessType } = useBusinessTypeStore();
  const [showModal, setShowModal] = useState(false);
  const [editingBusinessType, setEditingBusinessType] = useState<BusinessType | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchBusinessTypes();
  }, [fetchBusinessTypes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      let success = false;
      
      if (editingBusinessType) {
        success = await updateBusinessType(editingBusinessType.id, formData);
      } else {
        const result = await createBusinessType(formData);
        success = result !== null;
      }

      if (success) {
        setSuccessMessage(editingBusinessType ? '業態を更新しました' : '業態を作成しました');
        setShowModal(false);
        setEditingBusinessType(null);
        setFormData({ name: '' });
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage('操作に失敗しました');
      }
    } catch {
      setErrorMessage('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (businessType: BusinessType) => {
    setEditingBusinessType(businessType);
    setFormData({
      name: businessType.name
    });
    setShowModal(true);
  };

  const handleDelete = async (businessType: BusinessType) => {
    // Manager業態の削除を禁止
    if (businessType.name === 'Manager' || businessType.name === '管理者') {
      setErrorMessage('管理者業態は削除できません');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    // 警告メッセージと認証要求
    const warningMessage = `警告: 「${businessType.name}」業態を削除しようとしています。\n\nこの操作は取り消せません。\n\n続行するには、勤怠番号とパスワードを再入力してください。`;
    
    if (!confirm(warningMessage)) {
      return;
    }

    // 勤怠番号とパスワードの再入力
    const employeeId = prompt('勤怠番号を入力してください:');
    if (!employeeId) {
      setErrorMessage('勤怠番号が入力されませんでした');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const password = prompt('パスワードを入力してください:');
    if (!password) {
      setErrorMessage('パスワードが入力されませんでした');
      setTimeout(() => setErrorMessage(''), 3000);
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
        setErrorMessage('認証に失敗しました。勤怠番号またはパスワードが正しくありません。');
        setTimeout(() => setErrorMessage(''), 5000);
        return;
      }

      // 認証成功後、削除を実行
      const success = await deleteBusinessType(businessType.id);
      if (success) {
        setSuccessMessage('業態を削除しました');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage('削除に失敗しました');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch (error) {
      console.error('認証エラー:', error);
      setErrorMessage('認証処理中にエラーが発生しました');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const resetForm = () => {
    setFormData({ name: '' });
    setEditingBusinessType(null);
    setShowModal(false);
    setErrorMessage('');
  };

  // Manager業態かどうかを判定
  const isManagerBusinessType = (businessType: BusinessType) => {
    return businessType.name === 'Manager' || businessType.name === '管理者';
  };

  return (
    <>
      <div className="py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Building2 className="h-6 w-6 mr-3 text-blue-600" />
                    業態管理
                  </h1>
                  <p className="mt-2 text-gray-600">
                    店舗の業態（焼肉、居酒屋など）を管理します。
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="btn-primary flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  新しい業態を追加
                </button>
              </div>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
                {successMessage}
              </div>
            )}

            {errorMessage && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                {errorMessage}
              </div>
            )}

            {/* Business Types Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        業態名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        作成日
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                          読み込み中...
                        </td>
                      </tr>
                    ) : businessTypes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                          業態がありません
                        </td>
                      </tr>
                    ) : (
                      businessTypes.map((businessType) => (
                        <tr key={businessType.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900 flex items-center">
                              {businessType.name}
                              {isManagerBusinessType(businessType) && (
                                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                  システム必須
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            {new Date(businessType.createdAt).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleEdit(businessType)}
                                className="btn-outline text-sm flex items-center"
                              >
                                <Edit2 className="h-3 w-3 mr-1" />
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete(businessType)}
                                disabled={isManagerBusinessType(businessType)}
                                className={`text-sm flex items-center ${
                                  isManagerBusinessType(businessType)
                                    ? 'btn-outline-disabled cursor-not-allowed'
                                    : 'btn-outline-danger'
                                }`}
                                title={isManagerBusinessType(businessType) ? '管理者業態は削除できません' : '削除'}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                削除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              {editingBusinessType ? '業態を編集' : '新しい業態を追加'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="form-label">
                    業態名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    placeholder="例: 焼肉"
                    required
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="mt-4 text-sm text-red-600">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-outline"
                  disabled={isSubmitting}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || !formData.name.trim()}
                >
                  {isSubmitting ? '処理中...' : editingBusinessType ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default BusinessTypesPage; 