// Company type definition
export interface Company {
  id: string;
  name: string;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  category: string;
  paymentType: 'regular' | 'irregular' | 'specific';
  regularAmount?: number;
  specificMonths?: number[]; // 数値配列に変更
  isVisible: boolean;
  storeId: string;
  storeName?: string;
}
