"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UserPlus, ArrowLeft, AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';

const AddAdmin = () => {
  const navigate = useRouter();
  const { createNewAdmin } = useAuthStore();
  const { stores, fetchStores, isLoading: storesLoading } = useStoreStore();
  
  const [employeeId, setEmployeeId] = useState('');
  const [nickname, setNickname] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    if (stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  const validateEmployeeId = (id: string) => {
    return /^\d{4}$/.test(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeId || !nickname || !fullName || !storeId || !password || !confirmPassword) {
      setError('すべての項目を入力してください。');
      return;
    }
    
    if (!validateEmployeeId(employeeId)) {
      setError('勤怠番号は4桁の数字を入力してください。');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }
    
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await createNewAdmin(employeeId, nickname, fullName, storeId, password, 'admin');
      
      if (result) {
        setSuccess('管理者アカウントが正常に作成されました。');
        // フォームをリセット
        setEmployeeId('');
        setNickname('');
        setFullName('');
        setPassword('');
        setConfirmPassword('');
        
        // 3秒後に従業員管理ページに移動
        setTimeout(() => {
          navigate.push('/admin/employees');
        }, 3000);
      } else {
        setError('管理者アカウントの作成に失敗しました。勤怠番号が既に使用されている可能性があります。');
      }
    } catch {
      setError('管理者アカウント作成中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (storesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Clock className="animate-spin h-8 w-8 text-primary-600 mr-3" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="py-8">
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate.push('/admin/employees')}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>従業員管理に戻る</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">管理者追加</h1>
            <div className="w-6"></div> {/* Spacer for centering */}
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center mb-6">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <UserPlus className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">新しい管理者を追加</h2>
                  <p className="text-sm text-gray-600">管理者権限を持つアカウントを作成します</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="employeeId" className="form-label">
                    勤怠番号（4桁）
                  </label>
                  <input
                    id="employeeId"
                    type="text"
                    required
                    maxLength={4}
                    pattern="[0-9]{4}"
                    className="form-input"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="4桁の数字を入力"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="nickname" className="form-label">
                    ニックネーム
                  </label>
                  <input
                    id="nickname"
                    type="text"
                    required
                    className="form-input"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="例: タロウ"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="fullName" className="form-label">
                    氏名
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="例: 山田 太郎"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="store" className="form-label">
                    所属店舗
                  </label>
                  <select
                    id="store"
                    required
                    className="form-input"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    disabled={isSubmitting}
                  >
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="password" className="form-label">
                    パスワード
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6文字以上"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="form-label">
                    パスワード（確認）
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="パスワードを再入力"
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start">
                    <AlertCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-start">
                    <CheckCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    className="btn-primary w-full flex justify-center items-center"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white\" xmlns="http://www.w3.org/2000/svg\" fill="none\" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        作成中...
                      </span>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        管理者を作成
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 mb-2">注意事項</h3>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• 作成されたアカウントは管理者権限を持ちます</li>
                  <li>• 勤怠番号は4桁の数字で、システム内で一意である必要があります</li>
                  <li>• パスワードは6文字以上で設定してください</li>
                  <li>• 作成後、新しい管理者にログイン情報を安全に共有してください</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default function Page() {
  return (
    <>
      <AddAdmin />
    </>
  );
}