"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';

const RegisterPage = () => {
  const router = useRouter();
  const { register, isLoading: authLoading } = useAuthStore();
  const { stores, fetchStores, isLoading: storesLoading } = useStoreStore();
  const [employeeId, setEmployeeId] = useState('');
  const [nickname, setNickname] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const validateEmployeeId = (id: string) => {
    return /^\d{4}$/.test(id);
  };

  const handleRegister = async (e: React.FormEvent) => {
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
    
    try {
      const success = await register(employeeId, nickname, fullName, storeId, password);
      
      if (success) {
        router.push('/employee/dashboard');
      } else {
        setError('アカウントの登録に失敗しました。勤怠番号が既に使用されている可能性があります。');
      }
    } catch {
      setError('登録中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Clock className="animate-spin h-8 w-8 text-primary-600 mr-3" />
        <span>認証状態を確認中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="py-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <Clock className="h-12 w-12 text-primary-900" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">アカウント登録</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            新しいアカウントを作成してください
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleRegister}>
              <div>
                <label htmlFor="employeeId" className="form-label">
                  勤怠番号（4桁）
                </label>
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  autoComplete="off"
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
                  name="nickname"
                  type="text"
                  autoComplete="off"
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
                  name="fullName"
                  type="text"
                  autoComplete="name"
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
                  name="store"
                  required
                  className="form-input"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  disabled={isSubmitting || storesLoading}
                >
                  <option value="">店舗を選択</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
                {storesLoading && (
                  <p className="mt-1 text-xs text-gray-500">店舗情報を読み込み中...</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="form-label">
                  パスワード
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
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
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
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

              <div>
                <button
                  type="submit"
                  className="btn-primary w-full flex justify-center items-center"
                  disabled={isSubmitting || storesLoading}
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      登録中...
                    </span>
                  ) : (
                    '登録する'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    既にアカウントをお持ちの場合
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Link href="/login"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-700 bg-white border-primary-300 hover:bg-primary-50"
                >
                  ログイン
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;