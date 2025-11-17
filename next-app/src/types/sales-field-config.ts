// 売上管理の業態別フィールド設定用の型定義

export type AggregationMethod = 'sum' | 'average' | 'none';

/**
 * フィールドの使用箇所を定義
 * - 'linked': 日次と月次で共有され、日次データが自動集計される
 * - 'dailyOnly': 日次売上管理でのみ表示
 * - 'monthlyOnly': 月次売上管理でのみ表示（手動入力）
 */
export type FieldSource = 'linked' | 'dailyOnly' | 'monthlyOnly';

export interface SalesFieldConfig {
  id: string;
  key: string;  // データキー (例: 'revenue', 'cost', 'profit')
  label: string;  // 表示ラベル (例: '売上', '原価', '利益')
  category: SalesFieldCategory;
  type: SalesFieldType;
  unit?: string;  // 単位 (例: '円', '%')
  fieldSource: FieldSource;  // フィールドの使用箇所 ('linked': 日次月次共有, 'dailyOnly': 日次のみ, 'monthlyOnly': 月次のみ)
  isVisible: boolean;  // 表示/非表示 (後方互換性のため維持、isVisibleInDailySalesと同期)
  isVisibleInDailySales: boolean;  // 日次売上管理での表示/非表示
  isVisibleInMonthlySales: boolean;  // 月次売上管理での表示/非表示
  isEditable: boolean;  // 編集可能/不可
  isCalculated: boolean;  // 自動計算項目
  aggregationMethod: AggregationMethod;  // 日次→月次集計方法
  order: number;  // 表示順序
}

export interface BusinessTypeSalesConfig {
  businessTypeId: string;
  businessTypeName: string;
  fields: SalesFieldConfig[];
}

export type SalesFieldCategory =
  | 'basic'        // 基本情報 (日付、曜日など)
  | 'sales'        // 売上
  | 'cost'         // 原価
  | 'profit'       // 利益
  | 'customer'     // 客数・組数
  | 'unit_price'   // 単価
  | 'labor'        // 人件費
  | 'productivity' // 生産性
  | 'other';       // その他

export type SalesFieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'count';

export const SALES_FIELD_CATEGORIES: Record<SalesFieldCategory, string> = {
  basic: '基本情報',
  sales: '売上',
  cost: '原価',
  profit: '利益',
  customer: '客数・組数',
  unit_price: '単価',
  labor: '人件費',
  productivity: '生産性',
  other: 'その他'
};

export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  linked: '連携項目（日次→月次自動集計）',
  dailyOnly: '日次専用項目',
  monthlyOnly: '月次専用項目'
};

// デフォルトフィールド設定 (全業態共通の基本項目)
export const DEFAULT_SALES_FIELDS: Omit<SalesFieldConfig, 'id'>[] = [
  // 基本情報
  {
    key: 'date',
    label: '日付',
    category: 'basic',
    type: 'text',
    fieldSource: 'dailyOnly',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: false,
    isEditable: false,
    isCalculated: false,
    aggregationMethod: 'none',
    order: 1
  },
  {
    key: 'dayOfWeek',
    label: '曜日',
    category: 'basic',
    type: 'text',
    fieldSource: 'dailyOnly',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: false,
    isEditable: false,
    isCalculated: false,
    aggregationMethod: 'none',
    order: 2
  },

  // 売上
  {
    key: 'revenue',
    label: '売上',
    category: 'sales',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 3
  },

  // 原価
  {
    key: 'cost',
    label: '原価',
    category: 'cost',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 4
  },

  // 利益
  {
    key: 'profit',
    label: '利益',
    category: 'profit',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'sum',
    order: 5
  },

  // カフェ売上
  {
    key: 'cafeRevenue',
    label: 'カフェ売上',
    category: 'sales',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 6
  },

  // カフェ原価
  {
    key: 'cafeCost',
    label: 'カフェ原価',
    category: 'cost',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 7
  },

  // カフェ利益
  {
    key: 'cafeProfit',
    label: 'カフェ利益',
    category: 'profit',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'sum',
    order: 8
  },
];

// EDW業態用のフィールド設定例
export const EDW_SALES_FIELD_CONFIG: Omit<SalesFieldConfig, 'id'>[] = [
  // 基本情報
  {
    key: 'date',
    label: '日付',
    category: 'basic',
    type: 'text',
    fieldSource: 'dailyOnly',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: false,
    isEditable: false,
    isCalculated: false,
    aggregationMethod: 'none',
    order: 1
  },
  {
    key: 'dayOfWeek',
    label: '曜日',
    category: 'basic',
    type: 'text',
    fieldSource: 'dailyOnly',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: false,
    isEditable: false,
    isCalculated: false,
    aggregationMethod: 'none',
    order: 2
  },
  {
    key: 'collectionManager',
    label: '集計担当者',
    category: 'basic',
    type: 'text',
    fieldSource: 'dailyOnly',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: false,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'none',
    order: 3
  },

  // 売上
  {
    key: 'storeNetSales',
    label: '店舗純売上',
    category: 'sales',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 10
  },
  {
    key: 'edwNetSales',
    label: 'EDW純売上',
    category: 'sales',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 11
  },
  {
    key: 'ohbNetSales',
    label: 'OHB純売上',
    category: 'sales',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 12
  },
  {
    key: 'totalSales',
    label: '総売上',
    category: 'sales',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'sum',
    order: 13
  },

  // 客数・組数
  {
    key: 'totalCustomers',
    label: '客数（計）',
    category: 'customer',
    type: 'count',
    fieldSource: 'linked',
    unit: '人',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 20
  },
  {
    key: 'totalGroups',
    label: '組数（計）',
    category: 'customer',
    type: 'count',
    fieldSource: 'linked',
    unit: '組',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 21
  },
  {
    key: 'dinnerCustomers',
    label: 'D：客数',
    category: 'customer',
    type: 'count',
    fieldSource: 'linked',
    unit: '人',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 22
  },
  {
    key: 'dinnerGroups',
    label: 'D：組数',
    category: 'customer',
    type: 'count',
    fieldSource: 'linked',
    unit: '組',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 23
  },
  {
    key: 'ohbCustomers',
    label: 'OHB客数',
    category: 'customer',
    type: 'count',
    fieldSource: 'linked',
    unit: '人',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 24
  },

  // 単価
  {
    key: 'customerUnitPrice',
    label: '客単価',
    category: 'unit_price',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 30
  },
  {
    key: 'groupUnitPrice',
    label: '組単価',
    category: 'unit_price',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 31
  },

  // 人件費
  {
    key: 'employeeHours',
    label: '社員時間',
    category: 'labor',
    type: 'number',
    fieldSource: 'linked',
    unit: '時間',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 40
  },
  {
    key: 'asHours',
    label: 'AS時間',
    category: 'labor',
    type: 'number',
    fieldSource: 'linked',
    unit: '時間',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 41
  },
  {
    key: 'ohbTotalHours',
    label: 'OHB総時間',
    category: 'labor',
    type: 'number',
    fieldSource: 'linked',
    unit: '時間',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 42
  },
  {
    key: 'laborCostAmount',
    label: '人件費額',
    category: 'labor',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 43
  },
  {
    key: 'laborCostRate',
    label: '人件費率',
    category: 'labor',
    type: 'percentage',
    fieldSource: 'linked',
    unit: '%',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 44
  },

  // 生産性
  {
    key: 'salesPerLaborHour',
    label: '人時売上高',
    category: 'productivity',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 50
  },
  {
    key: 'edwProductivity',
    label: 'EDW生産性',
    category: 'productivity',
    type: 'number',
    fieldSource: 'linked',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 51
  },
  {
    key: 'ohbProductivity',
    label: 'OHB生産性',
    category: 'productivity',
    type: 'number',
    fieldSource: 'linked',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 52
  },

  // その他
  {
    key: 'voidCount',
    label: 'VOID件数',
    category: 'other',
    type: 'count',
    fieldSource: 'linked',
    unit: '件',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 60
  },
  {
    key: 'voidAmount',
    label: 'VOID金額',
    category: 'other',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 61
  },
  {
    key: 'cashDifference',
    label: '売上金過不足',
    category: 'other',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 62
  },
];
