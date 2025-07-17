export interface BusinessType {
  id: string;
  name: string;
  fields: Field[];
}

export interface StoreMonthlyData {
  storeId: string;
  storeName: string;
  businessTypeId: string;
  monthlyData: MonthlyData[];
}

export interface Field {
  id: string;
  name: string;
  category: FieldCategory;
  type: FieldType;
  unit?: string;
  isRequired: boolean;
  isCalculated: boolean;
  formula?: string;
  order: number;
}

export interface MonthlyData {
  id: string;
  storeId: string;
  businessTypeId: string;
  year: number;
  month: number;
  data: Record<string, number | string>;
  createdAt: Date;
  updatedAt: Date;
}

export type FieldCategory = 
  | 'sales' 
  | 'customer' 
  | 'profit' 
  | 'operations' 
  | 'inventory' 
  | 'marketing' 
  | 'staff' 
  | 'other';

export type FieldType = 'number' | 'currency' | 'percentage' | 'text' | 'count';

export interface ProfitData {
  storeId: string;
  year: number;
  month: number;
  actualProfit?: number;
  expectedProfit?: number;
  profitRate?: number;
}

export const FIELD_CATEGORIES: Record<FieldCategory, string> = {
  sales: '売上関連',
  customer: '客数・客単価',
  profit: '利益関連',
  operations: '運営関連',
  inventory: '在庫・原価',
  marketing: 'マーケティング',
  staff: '人事・労務',
  other: 'その他'
};

export const DEFAULT_FIELDS: Omit<Field, 'id'>[] = [
  // 客数・客単価
  { name: '客数（店舗）', category: 'customer', type: 'count', isRequired: true, isCalculated: false, order: 1 },
  { name: '組数（店舗）', category: 'customer', type: 'count', isRequired: true, isCalculated: false, order: 2 },
  { name: '客単価（店舗）', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 3 },
  { name: '組単価（店舗）', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 4 },
  { name: '客数（EDW）', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 5 },
  { name: '組数（EDW）', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 6 },
  { name: '客単価（EDW）', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 7 },
  { name: '組単価（EDW）', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 8 },
  { name: '客/組数（OHB）', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 9 },
  { name: '客/組単価（OHB）', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 10 },

  // 売上関連
  { name: '税抜純売上（店舗）', category: 'sales', type: 'currency', unit: '円', isRequired: true, isCalculated: false, order: 11 },
  { name: '税抜純売上（EDW）', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 12 },
  { name: '税抜純売上（OHB）', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 13 },
  { name: '対前年差額', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 14 },
  { name: '前年比（店舗）', category: 'sales', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 15 },
  { name: '前年比（EDW）', category: 'sales', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 16 },
  { name: '前年比（OHB）', category: 'sales', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 17 },
  { name: '目標売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 18 },
  { name: '目標比', category: 'sales', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 19 },
  { name: 'EDW L：売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 20 },
  { name: 'EDW D：売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 21 },
  { name: 'TOドリ売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 22 },
  { name: '物販売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 23 },
  { name: '焙煎豆売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 24 },

  // 利益関連
  { name: '償却前利益額（実績）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 25 },
  { name: '償却前利益額（見込）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 26 },
  { name: '償却前利益差異（実績）-（見込）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 27 },
  { name: '償却前利益額（目標）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 28 },
  { name: '償却前利益額（前年）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 29 },
  { name: '利益率', category: 'profit', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 30 },

  // 人事・労務
  { name: '入店人数', category: 'staff', type: 'count', unit: '人', isRequired: false, isCalculated: false, order: 31 },
  { name: '退職人数', category: 'staff', type: 'count', unit: '人', isRequired: false, isCalculated: false, order: 32 },
  { name: '在籍人数', category: 'staff', type: 'count', unit: '人', isRequired: false, isCalculated: false, order: 33 },
  { name: '代行人数', category: 'staff', type: 'count', unit: '人', isRequired: false, isCalculated: false, order: 34 },
  { name: '社員・AS総時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 35 },
  { name: 'スポットワーク総時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 36 },
  { name: '店舗総勤務時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 37 },
  { name: '生産性実績', category: 'staff', type: 'number', isRequired: false, isCalculated: true, order: 38 },
  { name: 'AS・社員人件費率', category: 'staff', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 39 },

  // 運営関連
  { name: 'クレーム件数', category: 'operations', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 40 },
  { name: 'クレーム内容', category: 'operations', type: 'text', isRequired: false, isCalculated: false, order: 41 },
  { name: 'VOID件数', category: 'operations', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 42 },
  { name: 'レジ金月間誤差', category: 'operations', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 43 },

  // 在庫・原価
  { name: '前月末棚卸し額①', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 44 },
  { name: '当月食材発注金額②', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 45 },
  { name: '当月末棚卸し額③', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 46 },
  { name: '当月末食材在庫比率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 47 },
  { name: '実原価率（①＋②－③）', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 48 },
  { name: '発注金額原価率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 49 },
  { name: '理論or目標原価率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: false, order: 50 },
  { name: '当月食材発注適正額（予算）', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 51 },
  { name: '当月食材発注金額差異（実績-予算）', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 52 },
  { name: '当月食材発注金額乖離率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 53 },
  { name: 'ベーカリーロス比率：対個数比', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: false, order: 54 },
  { name: 'ベーカリーロス比率：対売上比', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: false, order: 55 },
  { name: 'FL比率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 56 },

  // マーケティング
  { name: 'ファンくるスコア', category: 'marketing', type: 'number', isRequired: false, isCalculated: false, order: 57 },
  { name: 'Google口コミ総件数', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 58 },
  { name: 'Google口コミ純増', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 59 },
  { name: 'インスタフォロー累計：件', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 60 },
  { name: 'インスタフォロー増減：件', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 61 },
  { name: '投稿数単月：件', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 62 },
  { name: 'チラシ枚数', category: 'marketing', type: 'count', unit: '枚', isRequired: false, isCalculated: false, order: 63 },
]; 