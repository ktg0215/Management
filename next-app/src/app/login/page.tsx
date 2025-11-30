"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Clock, AlertCircle } from 'lucide-react';

const LoginPage = () => {
  const router = useRouter();
  const { 
    login, 
    isLoading, 
    createAdminAccount, 
    hasExistingAdmins,
    checkExistingAdmins 
  } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  useEffect(() => {
    checkExistingAdmins();
  }, [checkExistingAdmins]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }
    
    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('有効なメールアドレスを入力してください。');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const success = await login(email, password);
      
      if (success) {
        // Wait for Zustand persist to complete localStorage write (increased from 100ms to 500ms)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify localStorage write completed before navigation
        const stored = typeof window !== 'undefined' ? localStorage.getItem('auth-storage') : null;
        if (stored) {
          try {
            const parsedStore = JSON.parse(stored);
            if (parsedStore?.state?.user) {
              console.log('[Login] Auth state persisted successfully:', parsedStore.state.user.role);
            }
          } catch (e) {
            console.error('[Login] Failed to parse auth-storage:', e);
          }
        }

        const { isAuthenticated, isAdmin } = useAuthStore.getState();
        if (isAuthenticated) {
          router.push(isAdmin() ? '/admin/dashboard' : '/employee/dashboard');
        }
      } else {
        setError('ログインに失敗しました。メールアドレスまたはパスワードを確認してください。');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('ログイン中にエラーが発生しました。管理者アカウントを作成していない場合は、「管理者アカウントを作成」ボタンをクリックしてください。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAdminAccount = async () => {
    setIsCreatingAdmin(true);
    setError('');
    
    try {
      const success = await createAdminAccount();
      
      if (success) {
        setError('');
        alert('管理者アカウントが作成/修復されました。メールアドレス: admin@example.com, パスワード: toyama2023 でログインしてください。');
        checkExistingAdmins();
        setEmail('admin@example.com');
        setPassword('toyama2023');
      } else {
        setError('管理者アカウントの作成に失敗しました。');
      }
    } catch (err: unknown) {
      console.error('Admin creation error:', err);
      setError('管理者アカウント作成中にエラーが発生しました。');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Clock className="animate-spin h-8 w-8 text-primary-600 mr-3" />
        <span>認証状態を確認中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Clock className="h-12 w-12 text-primary-900" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">シフト提出システム</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          メールアドレスとパスワードでログインしてください
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="form-label">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレスを入力"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    ログイン中...
                  </span>
                ) : (
                  'ログイン'
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
                  アカウント作成
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {!hasExistingAdmins && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800 mb-2">
                    初回セットアップ: まず管理者アカウントを作成してください
                  </p>
                  <button
                    onClick={handleCreateAdminAccount}
                    disabled={isCreatingAdmin}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {isCreatingAdmin ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        作成中...
                      </span>
                    ) : (
                      '管理者アカウントを作成'
                    )}
                  </button>
                </div>
              )}
              <Link
                href="/register"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-700 bg-white border-primary-300 hover:bg-primary-50"
              >
                新規登録
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;