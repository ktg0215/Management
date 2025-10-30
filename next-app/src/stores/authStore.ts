import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import apiClient from '../lib/api';
import type { Employee } from '@/types/employee';

export type UserRole = 'user' | 'admin' | 'super_admin';

interface User {
  id: string;
  employeeId: string;
  email: string;
  nickname: string;
  fullName: string;
  storeId: string;
  role: UserRole;
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasExistingAdmins: boolean;
  
  // 権限チェック関数
  isUser: () => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  hasPermission: (requiredRole: UserRole) => boolean;
  
  // 認証関連関数
  login: (employeeId: string, password: string) => Promise<boolean>;
  register: (employeeId: string, nickname: string, fullName: string, storeId: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkExistingAdmins: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, 'nickname' | 'fullName'>>) => Promise<boolean>;
  
  // 管理者関連関数
  createAdminAccount: () => Promise<boolean>;
  createNewAdmin: (employeeId: string, nickname: string, fullName: string, storeId: string, password: string, role: UserRole) => Promise<boolean>;
  createNewSuperAdmin: (employeeId: string, nickname: string, fullName: string, storeId: string, password: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      hasExistingAdmins: false,

      // 権限チェック関数
      isUser: () => {
        const { user } = get();
        return user !== null && user.isActive;
      },

      isAdmin: () => {
        const { user } = get();
        return user !== null && user.isActive && (user.role === 'admin' || user.role === 'super_admin');
      },

      isSuperAdmin: () => {
        const { user } = get();
        return user !== null && user.isActive && user.role === 'super_admin';
      },

      hasPermission: (requiredRole: UserRole) => {
        const { user } = get();
        if (!user || !user.isActive) return false;

        const roleHierarchy = {
          'user': 1,
          'admin': 2,
          'super_admin': 3
        };

        const userLevel = roleHierarchy[user.role];
        const requiredLevel = roleHierarchy[requiredRole];

        return userLevel >= requiredLevel;
      },

      login: async (employeeId, password) => {
        try {
          console.log('ログイン試行:', { employeeId });

          const response = await apiClient.login(employeeId, password);
          
          if (!response.success || !response.data) {
            console.error('ログイン失敗:', response.error);
            throw new Error(response.error || 'ログインに失敗しました');
          }

          const { user, token } = response.data;
          
          console.log('📋 Login response received:', { 
            hasUser: !!user, 
            hasToken: !!token, 
            userId: user?.id,
            userRole: user?.role 
          });
          
          // Set token in API client
          apiClient.setToken(token);

          set({
            user: { ...user, isActive: true, role: user.role ?? 'user' } as User,
            isAuthenticated: true,
            isLoading: false,
          });
          
          console.log('✅ User state updated in store');

          console.log('ログイン成功:', { 
            employeeId: user.employeeId, 
            role: user.role,
            nickname: user.nickname 
          });

          return true;
        } catch (error) {
          console.error('ログインエラー:', error);
          throw error;
        }
      },

      register: async (employeeId, nickname, fullName, storeId, password) => {
        try {
          const response = await apiClient.register({
            employeeId,
            nickname,
            fullName,
            storeId,
            password,
          });

          if (!response.success || !response.data) {
            console.error('登録失敗:', response.error);
            return false;
          }

          const { user, token } = response.data;
          
          // Set token in API client
          apiClient.setToken(token);

          set({
            user: { ...user, isActive: true, role: user.role ?? 'user' } as User,
            isAuthenticated: true,
            isLoading: false,
          });

          return true;
        } catch (error) {
          console.error('登録エラー:', error);
          return false;
        }
      },

      logout: async () => {
        try {
          await apiClient.logout();
        } catch (error) {
          console.error('ログアウトエラー:', error);
        } finally {
          // エラーが発生してもローカルの認証状態をクリアする
          apiClient.setToken(null);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          
          // ローカルストレージからも削除
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-storage');
          }
        }
      },

      checkAuth: async () => {
        try {
          console.log('🔍 checkAuth started');
          
          // APIクライアントが既存のトークンを持っているかチェック
          const existingToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
          console.log('🔑 Existing token check:', { hasToken: !!existingToken });
          
          if (existingToken) {
            apiClient.setToken(existingToken);
          }
          
          // タイムアウトを設定（5秒）
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('認証チェックタイムアウト')), 5000);
          });
          
          const authPromise = apiClient.checkAuth();
          
          const response = await Promise.race([authPromise, timeoutPromise]) as { success: boolean; data?: { user: Employee }; status?: number };
          
          console.log('📋 checkAuth response:', { success: response.success, hasData: !!response.data, status: response.status });
          
          // 304レスポンスも成功として扱う
          if (response.success || response.status === 304) {
            // 304の場合は既存のユーザー情報を使用
            if (response.status === 304) {
              const currentUser = get().user;
              if (currentUser) {
                set({
                  user: currentUser,
                  isAuthenticated: true,
                  isLoading: false,
                });
                console.log('✅ checkAuth: User authenticated (304)');
                return;
              }
            }
            
            // 通常の成功レスポンス
            if (response.data) {
              const user = response.data.user;
              
              set({
                user: { ...user, isActive: true, role: user.role ?? 'user' } as User,
                isAuthenticated: true,
                isLoading: false,
              });
              console.log('✅ checkAuth: User authenticated');
            }
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
            console.log('❌ checkAuth: User not authenticated');
          }
        } catch (error) {
          console.error('認証チェックエラー:', error);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      checkExistingAdmins: async () => {
        try {
          const response = await apiClient.checkExistingAdmins();
          
          if (response.success && response.data) {
            set({ hasExistingAdmins: response.data.hasAdmins });
          } else {
            set({ hasExistingAdmins: false });
          }
        } catch (error) {
          console.error('管理者チェックエラー:', error);
          set({ hasExistingAdmins: true }); // エラー時も管理者が存在することにする
        }
      },

      updateProfile: async (updates) => {
        try {
          const { user } = get();
          if (!user) return false;

          const response = await apiClient.updateEmployee(user.id, updates);
          
          if (response.success) {
            set({
              user: { ...user, ...updates },
            });
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('プロフィール更新エラー:', error);
          return false;
        }
      },

      // 総管理者アカウント作成関数
      createAdminAccount: async () => {
        try {
          console.log('総管理者アカウント作成開始');

          const response = await apiClient.createAdminAccount();
          
          if (response.success) {
            console.log('総管理者アカウントが正常に作成されました');
            await get().checkExistingAdmins();
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('総管理者アカウント作成エラー:', error);
          return false;
        }
      },

      createNewAdmin: async (employeeId, nickname, fullName, storeId, password, role) => {
        try {
          const response = await apiClient.createEmployee({
            employeeId,
            fullName,
            nickname,
            storeId,
            role,
            password,
          });

          if (response.success) {
            console.log('新しい管理者アカウントが正常に作成されました');
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('管理者作成エラー:', error);
          return false;
        }
      },

      createNewSuperAdmin: async (employeeId, nickname, fullName, storeId, password) => {
        try {
          const response = await apiClient.createEmployee({
            employeeId,
            fullName,
            nickname,
            storeId,
            role: 'super_admin',
            password,
          });

          if (response.success) {
            console.log('新しい総管理者アカウントが正常に作成されました');
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('総管理者作成エラー:', error);
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);