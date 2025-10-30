// API client for backend communication
// Docker環境では相対パス（/api）を使用してNginxプロキシ経由でアクセス
// ローカル開発環境では直接APIサーバーにアクセス
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api'  // プロダクション環境ではNginxプロキシ経由
  : process.env.NEXT_PUBLIC_API_URL 
    ? `${process.env.NEXT_PUBLIC_API_URL}/api`
    : 'http://localhost:3001/api';

console.log('🔧 API Configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  API_BASE_URL: API_BASE_URL
});

import type { Employee } from '@/types/employee';
import { Store } from '@/stores/storeStore';
import { ShiftEntry, ShiftPeriod } from '@/stores/shiftStore';

// Company type definition
export interface Company {
  id: string;
  name: string;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  category: string;
  paymentType: 'regular' | 'irregular';
  regularAmount?: number;
  specificMonths?: string[];
  isVisible: boolean;
  storeId: string;
  storeName?: string;
}

// Payment type definition  
export interface Payment {
  id: string;
  companyId: string;
  amount: number;
  month: string;
  storeId: string;
  createdAt?: string;
  updatedAt?: string;
}

// BusinessType型を定義
export interface BusinessType {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ActivityLog型を定義
export interface ActivityLog {
  id: string;
  storeId: string;
  userId?: string;
  businessTypeId?: string;
  actionType: string; // 'create', 'update', 'delete'
  resourceType: string; // 'payment', 'shift', 'employee', etc.
  resourceName?: string;
  description: string;
  createdAt: string;
  userName?: string;
  storeName?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}

// ShiftSubmission型を定義
export interface ShiftSubmission {
  id: string;
  employeeId: string;
  status: string; // 'draft', 'submitted', etc.
  submittedAt: string | null;
  shiftEntries: ShiftEntry[];
}

// PLItem型を定義
export interface PLItem {
  name: string;
  estimate: number;
  actual: number;
  is_highlighted?: boolean;
  is_subtotal?: boolean;
  is_indented?: boolean;
  subject_name?: string;
  type?: 'variable' | 'fixed';
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage if available
    this.token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  }

  setToken(token: string | null) {
    console.log('🔑 APIClient.setToken called:', { token: token ? '***存在***' : 'null', hasWindow: typeof window !== 'undefined' });
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
        console.log('💾 Token saved to localStorage');
      } else {
        localStorage.removeItem('auth_token');
        console.log('🗑️ Token removed from localStorage');
      }
    }
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    } as Record<string, string>;

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      console.log('🔐 Authorization header set for request to:', endpoint);
    } else {
      console.log('⚠️ No token available for request to:', endpoint);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let data: Record<string, unknown> | null = null;
      
      // レスポンスボディを一度だけ読み取る
      const responseText = await response.text();
      
      try {
        data = JSON.parse(responseText);
      } catch {
        // JSONでない場合（例: 401 UnauthorizedでHTMLやテキストが返る場合）
        return {
          success: false,
          error: responseText || `HTTP ${response.status}`,
        };
      }

      // 304 Not Modifiedは成功レスポンスとして扱う
      if (!response.ok && response.status !== 304) {
        let errorMessage = (data?.error as string) || `HTTP ${response.status}`;
        
        // 409 Conflictエラーの場合、より分かりやすいメッセージを設定
        if (response.status === 409) {
          errorMessage = '同じ名前の取引先が既に存在します。別の名前を使用してください。';
        }
        
        console.log('❌ API Request failed:', { 
          endpoint, 
          status: response.status, 
          errorMessage,
          responseData: data 
        });
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      console.log('✅ API Request success:', { 
        endpoint, 
        status: response.status,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : []
      });

      return {
        success: true,
        data: (data?.data as T) || (data as T),
        message: data?.message as string,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Authentication endpoints
  async login(employeeId: string, password: string) {
    console.log('🔑 APIClient.login called:', { employeeId });
    const response = await this.request<{ user: Employee; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employeeId, password }),
    });
    console.log('📋 Login API response:', { 
      success: response.success, 
      hasData: !!response.data,
      hasUser: !!response.data?.user,
      hasToken: !!response.data?.token,
      error: response.error 
    });
    return response;
  }

  async register(data: {
    employeeId: string;
    nickname: string;
    fullName: string;
    storeId: string;
    password: string;
  }) {
    return this.request<{ user: Employee; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout() {
    const result = await this.request('/auth/logout', {
      method: 'POST',
    });
    this.setToken(null);
    return result;
  }

  async checkAuth() {
    return this.request<{ user: Employee }>('/auth/me');
  }

  // Store endpoints
  async getStores() {
    return this.request<Store[]>('/stores');
  }

  async createStore(name: string, businessTypeId?: string) {
    return this.request<Store>('/stores', {
      method: 'POST',
      body: JSON.stringify({ name, businessTypeId }),
    });
  }

  async updateStore(id: string, name: string, businessTypeId?: string) {
    return this.request<Store>(`/stores/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, businessTypeId }),
    });
  }

  async deleteStore(id: string) {
    return this.request(`/stores/${id}`, {
      method: 'DELETE',
    });
  }

  // Business Type endpoints
  async getBusinessTypes() {
    return this.request<BusinessType[]>('/business-types');
  }

  async createBusinessType(data: { name: string; description?: string }) {
    return this.request<BusinessType>('/business-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBusinessType(id: string, data: { name: string; description?: string }) {
    return this.request<BusinessType>(`/business-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBusinessType(id: string) {
    return this.request(`/business-types/${id}`, {
      method: 'DELETE',
    });
  }

  // Activity Logs endpoints
  async getActivityLogs(limit?: number) {
    const params = limit ? `?limit=${limit}` : '';
    return this.request<ActivityLog[]>(`/activity-logs${params}`);
  }

  // Employee endpoints
  async getEmployees() {
    return this.request<Employee[]>('/employees');
  }

  async createEmployee(data: {
    employeeId: string;
    fullName: string;
    nickname: string;
    storeId: string;
    role: 'user' | 'admin' | 'super_admin';
    password: string;
  }) {
    return this.request<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id: string, data: Partial<Employee>) {
    return this.request<Employee>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmployee(id: string) {
    return this.request(`/employees/${id}`, {
      method: 'DELETE',
    });
  }

  // Shift period endpoints
  async getShiftPeriods(storeId?: string) {
    const query = storeId ? `?storeId=${storeId}` : '';
    return this.request<ShiftPeriod[]>(`/shift-periods${query}`);
  }

  // Shift submission endpoints
  async getShiftSubmissions(periodId: string) {
    return this.request<ShiftSubmission[]>(`/shift-submissions?periodId=${periodId}`);
  }

  async createShiftSubmission(data: { 
    periodId: string;
    employeeId: string;
    shiftEntries: ShiftEntry[];
  }) {
    return this.request<ShiftSubmission>('/shift-submissions', {
      method: 'POST',
      body: JSON.stringify({
        periodId: data.periodId,
        employeeId: data.employeeId,
        status: 'draft'
      }),
    });
  }

  async updateShiftSubmission(id: string, data: Partial<Omit<ShiftSubmission, 'id'>>) {
    return this.request<ShiftSubmission>(`/shift-submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async submitShift(id: string) {
    return this.request<ShiftSubmission>(`/shift-submissions/${id}/submit`, {
      method: 'POST',
    });
  }

  // Shift entry endpoints
  async getShiftEntries(submissionId: string) {
    return this.request<ShiftEntry[]>(`/shift-entries?submissionId=${submissionId}`);
  }

  async createShiftEntry(data: { 
    submissionId: string;
    work_date: string;
    startTime: string | null;
    endTime: string | null;
    isHoliday: boolean;
  }) {
    return this.request<ShiftEntry>('/shift-entries', {
      method: 'POST',
      body: JSON.stringify({
        submissionId: data.submissionId,
        work_date: data.work_date,
        startTime: data.startTime,
        endTime: data.endTime,
        isHoliday: data.isHoliday
      }),
    });
  }

  async updateShiftEntry(id: string, data: Partial<ShiftEntry>) {
    return this.request<ShiftEntry>(`/shift-entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteShiftEntry(id: string) {
    return this.request(`/shift-entries/${id}`, {
      method: 'DELETE',
    });
  }

  async cleanupOldShiftData() {
    return this.request<{
      message: string;
      deletedPeriods: number;
      deletedSubmissions: number;
      deletedEntries: number;
      cutoffDate: string;
    }>('/shift-cleanup', {
      method: 'POST',
    });
  }

  // Admin endpoints
  async createAdminAccount() {
    return this.request<{ user: Employee; token: string }>('/admin/create-account', {
      method: 'POST',
    });
  }

  async checkExistingAdmins() {
    return this.request<{ hasAdmins: boolean }>('/admin/check-existing');
  }

  // PL（損益）管理API
  async getPL(year: number, month: number, storeId: string) {
    const query = `?year=${year}&month=${month}&storeId=${storeId}`;
    return this.request<{ items: PLItem[] }>(`/pl${query}`);
  }

  async savePL(data: {
    year: number;
    month: number;
    storeId: string;
    items: PLItem[];
  }) {
    return this.request<{ items: PLItem[] }>('/pl', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payments endpoints
  async savePaymentsBulk(payments: Payment[]) {
    return this.request<Payment[]>('/payments/bulk', {
      method: 'POST',
      body: JSON.stringify({ payments }),
    });
  }

  async getPayments(month: string, storeId?: string) {
    let query = `?month=${month}`;
    if (storeId) {
      query += `&storeId=${storeId}`;
    }
    return this.request<Payment[]>(`/payments${query}`);
  }

  // Company/取引先管理API
  async getCompanies(storeId?: string) {
    const query = storeId ? `?storeId=${storeId}` : '';
    return this.request<Company[]>(`/companies${query}`);
  }

  async createCompany(data: Omit<Company, 'id'>) {
    return this.request<Company>('/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCompany(id: string, data: Partial<Company>) {
    return this.request<Company>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCompany(id: string) {
    return this.request(`/companies/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;

// 売上データ型を定義
export interface SalesDataResponse {
  year: number;
  month: number;
  daily_data: Record<string, any>;
}

export interface SaveSalesRequest {
  year: number;
  month: number;
  storeId: string;
  dailyData: Record<string, any>;
}

// Enhanced sales API with retry mechanisms and error handling
interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  shouldRetry: (error: any) => boolean;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  shouldRetry: (error) => {
    // Retry on network errors or 5xx server errors
    return !error.status || error.status >= 500;
  },
};

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retryOptions: Partial<RetryOptions> = {}
): Promise<ApiResponse<T>> {
  const finalOptions = { ...defaultRetryOptions, ...retryOptions };
  let lastError: any;

  for (let attempt = 0; attempt <= finalOptions.maxRetries; attempt++) {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }

      // Handle client errors (4xx) - don't retry
      if (response.status >= 400 && response.status < 500) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Server errors (5xx) - may retry
      lastError = {
        status: response.status,
        statusText: response.statusText,
        message: `HTTP ${response.status}: ${response.statusText}`,
      };

    } catch (error) {
      lastError = {
        message: error instanceof Error ? error.message : 'Network error',
        networkError: true,
      };
    }

    // Check if we should retry
    if (attempt < finalOptions.maxRetries && finalOptions.shouldRetry(lastError)) {
      const delay = finalOptions.retryDelay * Math.pow(2, attempt); // Exponential backoff
      console.log(`API call failed, retrying in ${delay}ms (attempt ${attempt + 1}/${finalOptions.maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } else {
      break;
    }
  }

  return {
    success: false,
    error: lastError.message || 'Unknown error occurred',
  };
}

// 売上データ関連のAPI
export const salesApi = {
  // 売上データ取得
  getSales: async (year: number, month: number, storeId: string): Promise<ApiResponse<SalesDataResponse>> => {
    return fetchWithRetry<SalesDataResponse>(
      `${API_BASE_URL}/sales?year=${year}&month=${month}&storeId=${storeId}`,
      { method: 'GET' }
    );
  },

  // 売上データ保存
  saveSales: async (year: number, month: number, storeId: string, dailyData: Record<string, any>): Promise<ApiResponse<SalesDataResponse>> => {
    return fetchWithRetry<SalesDataResponse>(
      `${API_BASE_URL}/sales`,
      {
        method: 'POST',
        body: JSON.stringify({ year, month, storeId, dailyData }),
      },
      {
        // Don't retry POST requests by default (to avoid duplicate submissions)
        maxRetries: 0,
        shouldRetry: () => false,
      }
    );
  },

  // 日別売上データ保存
  saveDailySales: async (
    year: number,
    month: number,
    storeId: string,
    date: string,
    data: any
  ): Promise<ApiResponse<any>> => {
    return fetchWithRetry(
      `${API_BASE_URL}/sales/daily`,
      {
        method: 'PUT',
        body: JSON.stringify({
          year,
          month,
          storeId,
          date,
          data,
        }),
      },
      {
        maxRetries: 1, // Retry once for updates
        shouldRetry: (error) => error.networkError || error.status >= 500,
      }
    );
  },

  // バッチ売上データ保存
  saveBatchSales: async (
    year: number,
    month: number,
    storeId: string,
    updates: Array<{ date: string; data: any }>
  ): Promise<ApiResponse<any>> => {
    return fetchWithRetry(
      `${API_BASE_URL}/sales/batch`,
      {
        method: 'PUT',
        body: JSON.stringify({
          year,
          month,
          storeId,
          updates,
        }),
      },
      {
        maxRetries: 1,
        shouldRetry: (error) => error.networkError || error.status >= 500,
      }
    );
  },

  // ヘルスチェック
  healthCheck: async (): Promise<ApiResponse<any>> => {
    return fetchWithRetry(
      `${API_BASE_URL}/health`,
      { method: 'HEAD' },
      {
        maxRetries: 1,
        retryDelay: 500,
        shouldRetry: () => true,
      }
    );
  },
};

// API response cache utilities
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  set<T>(key: string, data: T, ttl = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
}

export const apiCache = new ApiCache();

// Utility functions for handling API responses
export const handleApiError = (error: string): string => {
  if (error.includes('Network error') || error.includes('fetch')) {
    return 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
  }
  
  if (error.includes('HTTP 401')) {
    return '認証が必要です。ログインしてください。';
  }
  
  if (error.includes('HTTP 403')) {
    return 'アクセス権限がありません。';
  }
  
  if (error.includes('HTTP 404')) {
    return '要求されたリソースが見つかりません。';
  }
  
  if (error.includes('HTTP 429')) {
    return 'リクエストが多すぎます。しばらく待ってからお試しください。';
  }
  
  if (error.includes('HTTP 5')) {
    return 'サーバーエラーが発生しました。しばらく待ってからお試しください。';
  }
  
  return error || '予期しないエラーが発生しました。';
};