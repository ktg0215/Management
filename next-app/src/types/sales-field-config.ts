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
export const DEFAULT_SALES_FIELDS: SalesFieldConfig[] = [
  // 基本情報
  {
    id: 'field_date',
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
    id: 'field_dayOfWeek',
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
  }
];

// カフェ業態用の全フィールド（Excelの全項目）
const CAFE_ALL_FIELDS: SalesFieldConfig[] = [
  // 目標・前年比
  {
    id: 'field_salesTarget',
    key: 'salesTarget',
    label: '売上目標',
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
  {
    id: 'field_targetCumulative',
    key: 'targetCumulative',
    label: '目標累計',
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
    order: 4
  },
  {
    id: 'field_targetRatio',
    key: 'targetRatio',
    label: '対目標比',
    category: 'sales',
    type: 'percentage',
    fieldSource: 'linked',
    unit: '%',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 5
  },
  {
    id: 'field_yearOverYear',
    key: 'yearOverYear',
    label: '前年比',
    category: 'sales',
    type: 'percentage',
    fieldSource: 'linked',
    unit: '%',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 6
  },
  {
    id: 'field_edwYearOverYear',
    key: 'edwYearOverYear',
    label: 'EDW前年比',
    category: 'sales',
    type: 'percentage',
    fieldSource: 'linked',
    unit: '%',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 7
  },
  {
    id: 'field_ohbYearOverYear',
    key: 'ohbYearOverYear',
    label: 'OHB前年比',
    category: 'sales',
    type: 'percentage',
    fieldSource: 'linked',
    unit: '%',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 8
  },
  {
    id: 'field_aggregator',
    key: 'aggregator',
    label: '集計担当者',
    category: 'basic',
    type: 'text',
    fieldSource: 'linked',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'none',
    order: 9
  },

  // 店舗売上
  {
    id: 'field_netSales',
    key: 'netSales',
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
    id: 'field_netSalesCumulative',
    key: 'netSalesCumulative',
    label: '店舗純売上累計',
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
    order: 10
  },
  {
    id: 'field_edwNetSales',
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
    id: 'field_edwNetSalesCumulative',
    key: 'edwNetSalesCumulative',
    label: 'EDW純売上累計',
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
    order: 12
  },
  {
    id: 'field_ohbNetSales',
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
    order: 13
  },
  {
    id: 'field_ohbNetSalesCumulative',
    key: 'ohbNetSalesCumulative',
    label: 'OHB純売上累計',
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
    order: 14
  },

  // 客数・組数
  {
    id: 'field_totalGroups',
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
    order: 15
  },
  {
    id: 'field_totalCustomers',
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
    order: 16
  },
  {
    id: 'field_groupUnitPrice',
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
    order: 17
  },
  {
    id: 'field_customerUnitPrice',
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
    order: 18
  },

  // 人件費関連
  {
    id: 'field_katougi',
    key: 'katougi',
    label: '加藤木',
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
    order: 19
  },
  {
    id: 'field_ishimori',
    key: 'ishimori',
    label: '石森',
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
    order: 20
  },
  {
    id: 'field_osawa',
    key: 'osawa',
    label: '大澤',
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
    order: 21
  },
  {
    id: 'field_washizuka',
    key: 'washizuka',
    label: '鷲塚',
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
    order: 22
  },
  {
    id: 'field_employeeHours',
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
    order: 23
  },
  {
    id: 'field_asHours',
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
    order: 24
  },
  {
    id: 'field_salesPerHour',
    key: 'salesPerHour',
    label: '人時売上高',
    category: 'labor',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 25
  },
  {
    id: 'field_laborCost',
    key: 'laborCost',
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
    order: 26
  },
  {
    id: 'field_laborCostRate',
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
    order: 27
  },

  // EDW営業明細
  {
    id: 'field_lunchSales',
    key: 'lunchSales',
    label: 'L：売上',
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
    order: 28
  },
  {
    id: 'field_dinnerSales',
    key: 'dinnerSales',
    label: 'D：売上',
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
    order: 29
  },
  {
    id: 'field_lunchCustomers',
    key: 'lunchCustomers',
    label: 'L：客数',
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
    order: 30
  },
  {
    id: 'field_dinnerCustomers',
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
    order: 31
  },
  {
    id: 'field_lunchGroups',
    key: 'lunchGroups',
    label: 'L：組数',
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
    order: 32
  },
  {
    id: 'field_dinnerGroups',
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
    order: 33
  },
  {
    id: 'field_edwCustomerUnitPrice',
    key: 'edwCustomerUnitPrice',
    label: 'EDW客単価',
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
    order: 34
  },
  {
    id: 'field_lunchUnitPrice',
    key: 'lunchUnitPrice',
    label: 'L：単価',
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
    order: 35
  },
  {
    id: 'field_dinnerUnitPrice',
    key: 'dinnerUnitPrice',
    label: 'D：単価',
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
    order: 36
  },

  // OHB
  {
    id: 'field_ohbSales',
    key: 'ohbSales',
    label: 'OHB売上',
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
    order: 37
  },
  {
    id: 'field_ohbCustomers',
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
    order: 38
  },
  {
    id: 'field_ohbGroups',
    key: 'ohbGroups',
    label: 'OHB組数',
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
    order: 39
  },
  {
    id: 'field_ohbCustomerUnitPrice',
    key: 'ohbCustomerUnitPrice',
    label: 'OHB客単価',
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
    order: 40
  },

  // VOID関連
  {
    id: 'field_voidCount',
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
    order: 41
  },
  {
    id: 'field_voidAmount',
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
    order: 42
  },
  {
    id: 'field_salesDiscrepancy',
    key: 'salesDiscrepancy',
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
    order: 43
  },

  // 生産性
  {
    id: 'field_totalHours',
    key: 'totalHours',
    label: '総時間',
    category: 'productivity',
    type: 'number',
    fieldSource: 'linked',
    unit: '時間',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 44
  },
  {
    id: 'field_edwBaitHours',
    key: 'edwBaitHours',
    label: 'EDWバイト時間',
    category: 'productivity',
    type: 'number',
    fieldSource: 'linked',
    unit: '時間',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 45
  },
  {
    id: 'field_ohbBaitHours',
    key: 'ohbBaitHours',
    label: 'OHBバイト時間',
    category: 'productivity',
    type: 'number',
    fieldSource: 'linked',
    unit: '時間',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 46
  },
  {
    id: 'field_edwProductivity',
    key: 'edwProductivity',
    label: 'EDW生産性',
    category: 'productivity',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円/時',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 47
  },
  {
    id: 'field_ohbProductivity',
    key: 'ohbProductivity',
    label: 'OHB生産性',
    category: 'productivity',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円/時',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 48
  },
  {
    id: 'field_totalProductivity',
    key: 'totalProductivity',
    label: '総生産性',
    category: 'productivity',
    type: 'currency',
    fieldSource: 'linked',
    unit: '円/時',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 49
  },

  // OHB予約
  {
    id: 'field_reservationCount',
    key: 'reservationCount',
    label: '予約件数',
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
    order: 50
  },
  {
    id: 'field_plain',
    key: 'plain',
    label: 'プレーン',
    category: 'other',
    type: 'count',
    fieldSource: 'linked',
    unit: '個',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 51
  },
  {
    id: 'field_junsei',
    key: 'junsei',
    label: '純生',
    category: 'other',
    type: 'count',
    fieldSource: 'linked',
    unit: '個',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 52
  },
  {
    id: 'field_seasonal',
    key: 'seasonal',
    label: '季節',
    category: 'other',
    type: 'count',
    fieldSource: 'linked',
    unit: '個',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 53
  },

  // アンケート
  {
    id: 'field_surveyCount',
    key: 'surveyCount',
    label: '取得枚数',
    category: 'other',
    type: 'count',
    fieldSource: 'linked',
    unit: '枚',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 54
  },
  {
    id: 'field_surveyRate',
    key: 'surveyRate',
    label: '取得率',
    category: 'other',
    type: 'percentage',
    fieldSource: 'linked',
    unit: '%',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 55
  }
];

// デフォルトフィールド設定を取得する関数
export const getDefaultFieldConfigs = (businessType: string = 'cafe'): SalesFieldConfig[] => {
  // 現時点ではカフェ業態のみサポート
  // 将来的に他の業態を追加する場合は、ここで分岐
  switch (businessType) {
    case 'cafe':
      return [...DEFAULT_SALES_FIELDS, ...CAFE_ALL_FIELDS];
    default:
      return DEFAULT_SALES_FIELDS;
  }
};

// フィールド設定のバリデーション
export const validateFieldConfig = (field: Partial<SalesFieldConfig>): string[] => {
  const errors: string[] = [];

  if (!field.id) errors.push('IDは必須です');
  if (!field.key) errors.push('キーは必須です');
  if (!field.label) errors.push('ラベルは必須です');
  if (!field.category) errors.push('カテゴリーは必須です');
  if (!field.type) errors.push('タイプは必須です');
  if (!field.fieldSource) errors.push('フィールドソースは必須です');
  if (field.order === undefined || field.order < 0) errors.push('表示順序は0以上の数値である必要があります');

  // フィールドソースごとの検証
  if (field.fieldSource === 'dailyOnly' && field.isVisibleInMonthlySales) {
    errors.push('日次専用項目は月次売上管理で表示できません');
  }
  if (field.fieldSource === 'monthlyOnly' && field.isVisibleInDailySales) {
    errors.push('月次専用項目は日次売上管理で表示できません');
  }
  if (field.fieldSource === 'linked' && field.aggregationMethod === 'none') {
    errors.push('連携項目には集計方法を設定する必要があります');
  }

  return errors;
};

// フィールドの並び順を正規化
export const normalizeFieldOrder = (fields: SalesFieldConfig[]): SalesFieldConfig[] => {
  return fields
    .sort((a, b) => a.order - b.order)
    .map((field, index) => ({
      ...field,
      order: index + 1
    }));
};
