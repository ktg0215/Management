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
