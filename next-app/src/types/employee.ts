/**
 * Employee type definitions
 *
 * Shared type used across the application to avoid circular dependencies
 */

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
