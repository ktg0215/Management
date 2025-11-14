// API response types - separated to avoid circular dependency

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}

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

export interface BusinessType {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
