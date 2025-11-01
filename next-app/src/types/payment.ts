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
