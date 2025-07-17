import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../lib/api';
import type { Employee } from '@/app/admin/employees/page';

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
          
          // Set token in API client
          apiClient.setToken(token);

          set({
            user: { ...user, isActive: true, role: user.role ?? 'user' } as User,
            isAuthenticated: true,
            isLoading: false,
          });

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
          // タイムアウトを設定（5秒）
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('認証チェックタイムアウト')), 5000);
          });
          
          const authPromise = apiClient.checkAuth();
          
          const response = await Promise.race([authPromise, timeoutPromise]) as { success: boolean; data?: { user: Employee } };
          
          if (response.success && response.data) {
            const user = response.data.user;
            
            set({
              user: { ...user, isActive: true, role: user.role ?? 'user' } as User,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
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
          set({ hasExistingAdmins: false });
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
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);