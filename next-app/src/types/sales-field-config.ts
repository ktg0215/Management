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
  },

  // 売上
  {
    id: 'field_revenue',
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
    id: 'field_cost',
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
    id: 'field_profit',
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
  }
];

// カフェ業態用の追加フィールド
const CAFE_ADDITIONAL_FIELDS: SalesFieldConfig[] = [
  // 客数・組数
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
    order: 20
  },
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
    order: 21
  },

  // 単価
  {
    id: 'field_averageSpending',
    key: 'averageSpending',
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

  // 人件費
  {
    id: 'field_laborCost',
    key: 'laborCost',
    label: '人件費',
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
    order: 40
  }
];

// デフォルトフィールド設定を取得する関数
export const getDefaultFieldConfigs = (businessType: string = 'cafe'): SalesFieldConfig[] => {
  // 現時点ではカフェ業態のみサポート
  // 将来的に他の業態を追加する場合は、ここで分岐
  switch (businessType) {
    case 'cafe':
      return [...DEFAULT_SALES_FIELDS, ...CAFE_ADDITIONAL_FIELDS];
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