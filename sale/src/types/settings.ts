export interface ColumnConfig {
  id: string;
  label: string;
  category: 'sales' | 'customer' | 'labor' | 'productivity' | 'other';
  type: 'number' | 'text' | 'calculated';
  visible: boolean;
  order: number;
  required?: boolean;
  calculationFormula?: string;
}

export interface SettingsData {
  columns: ColumnConfig[];
  categories: {
    id: string;
    label: string;
    order: number;
  }[];
}

export const defaultColumns: ColumnConfig[] = [
  // 売上データ
  { id: 'storeNetSales', label: '店舗純売上', category: 'sales', type: 'number', visible: true, order: 1, required: true },
  { id: 'edwNetSales', label: 'EDW純売上', category: 'sales', type: 'calculated', visible: true, order: 2 },
  { id: 'ohbNetSales', label: 'OHB純売上', category: 'sales', type: 'number', visible: true, order: 3 },
  { id: 'storeNetSalesCumulative', label: '店舗純売上累計', category: 'sales', type: 'calculated', visible: true, order: 4 },
  { id: 'dinnerSales', label: 'ディナー売上', category: 'sales', type: 'number', visible: false, order: 5 },
  { id: 'lunchSales', label: 'ランチ売上', category: 'sales', type: 'calculated', visible: false, order: 6 },
  
  // 客数・組数
  { id: 'totalCustomers', label: '総客数', category: 'customer', type: 'number', visible: true, order: 7 },
  { id: 'totalGroups', label: '総組数', category: 'customer', type: 'number', visible: true, order: 8 },
  { id: 'dinnerCustomers', label: 'ディナー客数', category: 'customer', type: 'number', visible: false, order: 9 },
  { id: 'dinnerGroups', label: 'ディナー組数', category: 'customer', type: 'number', visible: false, order: 10 },
  { id: 'lunchCustomers', label: 'ランチ客数', category: 'customer', type: 'calculated', visible: false, order: 11 },
  { id: 'ohbCustomers', label: 'OHB客数', category: 'customer', type: 'number', visible: false, order: 12 },
  
  // 単価
  { id: 'groupUnitPrice', label: '組単価', category: 'customer', type: 'calculated', visible: true, order: 13 },
  { id: 'customerUnitPrice', label: '客単価', category: 'customer', type: 'calculated', visible: false, order: 14 },
  { id: 'dinnerUnitPrice', label: 'ディナー単価', category: 'customer', type: 'calculated', visible: false, order: 15 },
  { id: 'lunchUnitPrice', label: 'ランチ単価', category: 'customer', type: 'calculated', visible: false, order: 16 },
  
  // 労働時間
  { id: 'employeeHours', label: '社員時間', category: 'labor', type: 'number', visible: true, order: 17 },
  { id: 'asHours', label: 'AS時間', category: 'labor', type: 'number', visible: true, order: 18 },
  { id: 'ohbTotalHours', label: 'OHB総時間', category: 'labor', type: 'number', visible: false, order: 19 },
  { id: 'totalHoursWithEmployees', label: '総時間', category: 'labor', type: 'calculated', visible: false, order: 20 },
  
  // 生産性
  { id: 'salesPerLaborHour', label: '人時売上高', category: 'productivity', type: 'calculated', visible: true, order: 21 },
  { id: 'laborCostRate', label: '人件費率', category: 'productivity', type: 'calculated', visible: false, order: 22 },
  { id: 'edwProductivity', label: 'EDW生産性', category: 'productivity', type: 'calculated', visible: false, order: 23 },
  { id: 'ohbProductivity', label: 'OHB生産性', category: 'productivity', type: 'calculated', visible: false, order: 24 },
  
  // その他
  { id: 'voidCount', label: 'VOID件数', category: 'other', type: 'number', visible: true, order: 25 },
  { id: 'voidAmount', label: 'VOID金額', category: 'other', type: 'number', visible: false, order: 26 },
  { id: 'cashDifference', label: '売上金過不足', category: 'other', type: 'number', visible: false, order: 27 },
  { id: 'collectionManager', label: '集計担当者', category: 'other', type: 'text', visible: false, order: 28 },
];

export const defaultCategories = [
  { id: 'sales', label: '売上詳細', order: 1 },
  { id: 'customer', label: '客数・組数', order: 2 },
  { id: 'labor', label: '労働時間', order: 3 },
  { id: 'productivity', label: '生産性', order: 4 },
  { id: 'other', label: 'その他', order: 5 },
];