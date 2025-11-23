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

export interface StoreFieldVisibility {
  storeId: string;
  visibleFieldIds: string[];
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
  // 基本情報
  { name: '日付', category: 'other', type: 'text', isRequired: true, isCalculated: false, order: 1 },
  { name: '曜日', category: 'other', type: 'text', isRequired: true, isCalculated: false, order: 2 },

  // 売上・目標関連
  { name: '売上目標', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 3 },
  { name: '目標累計', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 4 },
  { name: '対目標比', category: 'sales', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 5 },
  { name: '前年比', category: 'sales', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 6 },
  { name: 'EDW前年比', category: 'sales', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 7 },
  { name: 'OHB前年比', category: 'sales', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 8 },
  { name: '集計担当者', category: 'other', type: 'text', isRequired: false, isCalculated: false, order: 9 },

  // 店舗純売上
  { name: '店舗純売上', category: 'sales', type: 'currency', unit: '円', isRequired: true, isCalculated: false, order: 10 },
  { name: '店舗純売上累計', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 11 },

  // EDW純売上
  { name: 'EDW純売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 12 },
  { name: 'EDW純売上累計', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 13 },

  // OHB純売上
  { name: 'OHB純売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 14 },
  { name: 'Uber', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 15 },
  { name: 'OHB純売上累計', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 16 },

  // 客数・組数（計）
  { name: '組数（計）', category: 'customer', type: 'count', isRequired: true, isCalculated: false, order: 17 },
  { name: '客数（計）', category: 'customer', type: 'count', isRequired: true, isCalculated: false, order: 18 },
  { name: '組単価', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 19 },
  { name: '客単価', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 20 },

  // 人時・人件費
  { name: '社員時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 21 },
  { name: 'AS時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 22 },
  { name: '人時売上高', category: 'staff', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 23 },
  { name: '人件費額', category: 'staff', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 24 },
  { name: '人件費率', category: 'staff', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 25 },

  // L/D売上
  { name: 'L：売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 26 },
  { name: 'D：売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 27 },
  { name: 'L：客数', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 28 },
  { name: 'D：客数', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 29 },
  { name: 'L：組数', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 30 },
  { name: 'D：組数', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 31 },
  { name: 'L：単価', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 32 },
  { name: 'D：単価', category: 'customer', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 33 },

  // その他売上データ
  { name: '売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 34 },
  { name: '客数', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 35 },
  { name: '組数', category: 'customer', type: 'count', isRequired: false, isCalculated: false, order: 36 },

  // VOID・過不足
  { name: 'VOID件数', category: 'operations', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 37 },
  { name: 'VOID金額', category: 'operations', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 38 },
  { name: '売上金過不足', category: 'operations', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 39 },

  // 総時間・生産性
  { name: '総時間社員込', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 40 },
  { name: 'EDW総時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 41 },
  { name: 'OHB総時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 42 },
  { name: 'EDW生産性', category: 'staff', type: 'number', isRequired: false, isCalculated: true, order: 43 },
  { name: 'OHB生産性', category: 'staff', type: 'number', isRequired: false, isCalculated: true, order: 44 },
  { name: '総生産性', category: 'staff', type: 'number', isRequired: false, isCalculated: true, order: 45 },

  // 以下は既存の項目を維持（月次集計用）
  // 利益関連
  { name: '償却前利益額（実績）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 46 },
  { name: '償却前利益額（見込）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 47 },
  { name: '償却前利益差異（実績）-（見込）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 48 },
  { name: '償却前利益額（目標）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 49 },
  { name: '償却前利益額（前年）', category: 'profit', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 50 },
  { name: '利益率', category: 'profit', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 51 },

  // 人事・労務（月次集計用）
  { name: '入店人数', category: 'staff', type: 'count', unit: '人', isRequired: false, isCalculated: false, order: 52 },
  { name: '退職人数', category: 'staff', type: 'count', unit: '人', isRequired: false, isCalculated: false, order: 53 },
  { name: '在籍人数', category: 'staff', type: 'count', unit: '人', isRequired: false, isCalculated: false, order: 54 },
  { name: '代行人数', category: 'staff', type: 'count', unit: '人', isRequired: false, isCalculated: false, order: 55 },
  { name: '社員・AS総時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 56 },
  { name: 'スポットワーク総時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 57 },
  { name: '店舗総勤務時間', category: 'staff', type: 'number', unit: '時間', isRequired: false, isCalculated: false, order: 58 },
  { name: '生産性実績', category: 'staff', type: 'number', isRequired: false, isCalculated: true, order: 59 },
  { name: 'AS・社員人件費率', category: 'staff', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 60 },

  // 運営関連
  { name: 'クレーム件数', category: 'operations', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 61 },
  { name: 'クレーム内容', category: 'operations', type: 'text', isRequired: false, isCalculated: false, order: 62 },
  { name: 'レジ金月間誤差', category: 'operations', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 63 },

  // 在庫・原価
  { name: '前月末棚卸し額①', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 64 },
  { name: '当月食材発注金額②', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 65 },
  { name: '当月末棚卸し額③', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 66 },
  { name: '当月末食材在庫比率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 67 },
  { name: '実原価率（①＋②－③）', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 68 },
  { name: '発注金額原価率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 69 },
  { name: '理論or目標原価率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: false, order: 70 },
  { name: '当月食材発注適正額（予算）', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 71 },
  { name: '当月食材発注金額差異（実績-予算）', category: 'inventory', type: 'currency', unit: '円', isRequired: false, isCalculated: true, order: 72 },
  { name: '当月食材発注金額乖離率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 73 },
  { name: 'ベーカリーロス比率：対個数比', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: false, order: 74 },
  { name: 'ベーカリーロス比率：対売上比', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: false, order: 75 },
  { name: 'FL比率', category: 'inventory', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 76 },

  // マーケティング
  { name: 'ファンくるスコア', category: 'marketing', type: 'number', isRequired: false, isCalculated: false, order: 77 },
  { name: 'Google口コミ総件数', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 78 },
  { name: 'Google口コミ純増', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 79 },
  { name: 'インスタフォロー累計：件', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 80 },
  { name: 'インスタフォロー増減：件', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 81 },
  { name: '投稿数単月：件', category: 'marketing', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 82 },
  { name: 'チラシ枚数', category: 'marketing', type: 'count', unit: '枚', isRequired: false, isCalculated: false, order: 83 },

  // その他の売上データ（EDW/OHB詳細）
  { name: 'TOドリ売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 84 },
  { name: '物販売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 85 },
  { name: '焙煎豆売上', category: 'sales', type: 'currency', unit: '円', isRequired: false, isCalculated: false, order: 86 },

  // OHB予約関連
  { name: '予約件数', category: 'sales', type: 'count', unit: '件', isRequired: false, isCalculated: false, order: 87 },
  { name: 'プレーン', category: 'sales', type: 'count', unit: '個', isRequired: false, isCalculated: false, order: 88 },
  { name: '純生', category: 'sales', type: 'count', unit: '個', isRequired: false, isCalculated: false, order: 89 },
  { name: '季節', category: 'sales', type: 'count', unit: '個', isRequired: false, isCalculated: false, order: 90 },

  // アンケート関連
  { name: 'アンケート取得枚数', category: 'marketing', type: 'count', unit: '枚', isRequired: false, isCalculated: false, order: 91 },
  { name: 'アンケート取得率', category: 'marketing', type: 'percentage', unit: '%', isRequired: false, isCalculated: true, order: 92 },
];
