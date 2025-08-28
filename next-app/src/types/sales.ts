export interface DailySalesData {
  date: string;
  dayOfWeek: string;
  isHoliday?: boolean;
  
  // EDW業態用の目標・実績項目
  salesTarget?: number;
  targetCumulative?: number;
  targetAchievementRate?: number;
  yearOnYear?: number;
  edwYearOnYear?: number;
  ohbYearOnYear?: number;
  
  // 入力項目
  collectionManager?: string;
  storeNetSales?: number;
  ohbNetSales?: number;
  totalGroups?: number;
  totalCustomers?: number;
  dinnerSales?: number;
  dinnerCustomers?: number;
  dinnerGroups?: number;
  ohbCustomers?: number;
  employeeHours?: number;
  asHours?: number;
  ohbTotalHours?: number;
  laborCostAmount?: number;
  voidCount?: number;
  voidAmount?: number;
  cashDifference?: number;
  
  // EDW業態用の社員項目
  employee1?: number;
  employee2?: number;
  employee3?: number;
  employee4?: number;
  
  // 計算項目
  storeNetSalesCumulative?: number;
  edwNetSales?: number;
  edwNetSalesCumulative?: number;
  ohbNetSalesCumulative?: number;
  groupUnitPrice?: number;
  customerUnitPrice?: number;
  lunchSales?: number;
  lunchCustomers?: number;
  lunchGroups?: number;
  lunchUnitPrice?: number;
  dinnerUnitPrice?: number;
  edwCustomerUnitPrice?: number;
  ohbCustomerUnitPrice?: number;
  salesPerLaborHour?: number;
  laborCostRate?: number;
  totalHoursWithEmployees?: number;
  edwTotalHours?: number;
  edwProductivity?: number;
  ohbProductivity?: number;
  totalProductivity?: number;
  
  // EDW業態用の追加計算項目
  edwCustomerCount?: number;
  edwGroupCount?: number;
  ohbGroups?: number;
}

export interface MonthlyData {
  year: number;
  month: number;
  dailyData: { [date: string]: DailySalesData };
}

export interface SalesFormData {
  collectionManager: string;
  storeNetSales: number;
  ohbNetSales: number;
  totalGroups: number;
  totalCustomers: number;
  dinnerSales: number;
  dinnerCustomers: number;
  dinnerGroups: number;
  ohbCustomers: number;
  employeeHours: number;
  asHours: number;
  ohbTotalHours: number;
  laborCostAmount: number;
  voidCount: number;
  voidAmount: number;
  cashDifference: number;
} 

// EDW業態 固定売上管理項目リスト
export const EDW_SALES_FIELDS = [
  // 目標・実績
  { key: 'salesTarget', label: '売上目標', type: 'manual', category: '目標・実績' },
  { key: 'targetCumulative', label: '目標累計', type: 'auto', category: '目標・実績' },
  { key: 'targetAchievementRate', label: '対目標比', type: 'auto', category: '目標・実績' },
  { key: 'yearOnYear', label: '前年比', type: 'auto', category: '目標・実績' },
  { key: 'edwYearOnYear', label: 'EDW前年比', type: 'auto', category: '目標・実績' },
  { key: 'ohbYearOnYear', label: 'OHB前年比', type: 'auto', category: '目標・実績' },
  
  // 基本情報
  { key: 'collectionManager', label: '集計担当者', type: 'manual', category: '基本情報' },
  
  // 売上
  { key: 'storeNetSales', label: '店舗純売上', type: 'manual', category: '売上' },
  { key: 'storeNetSalesCumulative', label: '店舗純売上累計', type: 'auto', category: '売上' },
  { key: 'edwNetSales', label: 'EDW純売上', type: 'auto', category: '売上' },
  { key: 'edwNetSalesCumulative', label: 'EDW純売上累計', type: 'auto', category: '売上' },
  { key: 'ohbNetSales', label: 'OHB純売上', type: 'manual', category: '売上' },
  { key: 'ohbNetSalesCumulative', label: 'OHB純売上累計', type: 'auto', category: '売上' },
  
  // 客数・組数
  { key: 'totalGroups', label: '組数（計）', type: 'manual', category: '客数・組数' },
  { key: 'totalCustomers', label: '客数（計）', type: 'manual', category: '客数・組数' },
  { key: 'groupUnitPrice', label: '組単価', type: 'auto', category: '客数・組数' },
  { key: 'customerUnitPrice', label: '客単価', type: 'auto', category: '客数・組数' },
  
  // 人件費
  { key: 'employee1', label: '社員１', type: 'manual', category: '人件費' },
  { key: 'employee2', label: '社員２', type: 'manual', category: '人件費' },
  { key: 'employee3', label: '社員３', type: 'manual', category: '人件費' },
  { key: 'employee4', label: '社員４', type: 'manual', category: '人件費' },
  { key: 'employeeHours', label: '社員時間', type: 'auto', category: '人件費' },
  { key: 'asHours', label: 'AS時間', type: 'manual', category: '人件費' },
  { key: 'salesPerLaborHour', label: '人時売上高', type: 'auto', category: '人件費' },
  { key: 'laborCostAmount', label: '人件費額', type: 'manual', category: '人件費' },
  { key: 'laborCostRate', label: '人件費率', type: 'auto', category: '人件費' },
  
  // EDW詳細
  { key: 'edwCustomerCount', label: 'EDW客数', type: 'auto', category: 'EDW詳細' },
  { key: 'edwGroupCount', label: 'EDW組数', type: 'auto', category: 'EDW詳細' },
  { key: 'lunchSales', label: 'L：売上', type: 'auto', category: 'EDW詳細' },
  { key: 'dinnerSales', label: 'D：売上', type: 'manual', category: 'EDW詳細' },
  { key: 'lunchCustomers', label: 'L：客数', type: 'auto', category: 'EDW詳細' },
  { key: 'dinnerCustomers', label: 'D：客数', type: 'manual', category: 'EDW詳細' },
  { key: 'lunchGroups', label: 'L：組数', type: 'auto', category: 'EDW詳細' },
  { key: 'dinnerGroups', label: 'D：組数', type: 'manual', category: 'EDW詳細' },
  { key: 'edwCustomerUnitPrice', label: 'EDW客単価', type: 'auto', category: 'EDW詳細' },
  { key: 'lunchUnitPrice', label: 'L：単価', type: 'auto', category: 'EDW詳細' },
  { key: 'dinnerUnitPrice', label: 'D：単価', type: 'auto', category: 'EDW詳細' },
  
  // OHB詳細
  { key: 'ohbCustomers', label: 'OHB客数', type: 'manual', category: 'OHB詳細' },
  { key: 'ohbCustomerUnitPrice', label: 'OHB客単価', type: 'auto', category: 'OHB詳細' },
  { key: 'ohbTotalHours', label: 'OHB総時間', type: 'manual', category: 'OHB詳細' },
  { key: 'ohbProductivity', label: 'OHB生産性', type: 'auto', category: 'OHB詳細' },
  
  // その他
  { key: 'voidCount', label: 'VOID件数', type: 'manual', category: 'その他' },
  { key: 'voidAmount', label: 'VOID金額', type: 'manual', category: 'その他' },
  { key: 'cashDifference', label: '売上金過不足', type: 'manual', category: 'その他' },
  { key: 'totalHoursWithEmployees', label: '総時間社員込', type: 'auto', category: 'その他' },
  { key: 'edwTotalHours', label: 'EDＷ総時間', type: 'auto', category: 'その他' },
  { key: 'edwProductivity', label: 'EDW生産性', type: 'auto', category: 'その他' },
  { key: 'totalProductivity', label: '総生産性', type: 'auto', category: 'その他' },
] as const;

// EDW業態 日次売上データ型
export interface EDWDailySalesData {
  salesTarget?: number;
  targetCumulative?: number;
  targetAchievementRate?: number;
  yearOnYear?: number;
  edwYearOnYear?: number;
  ohbYearOnYear?: number;
  collectionManager?: string;
  storeNetSales?: number;
  storeNetSalesCumulative?: number;
  edwNetSales?: number;
  edwNetSalesCumulative?: number;
  ohbNetSales?: number;
  ohbNetSalesCumulative?: number;
  totalGroups?: number;
  totalCustomers?: number;
  groupUnitPrice?: number;
  customerUnitPrice?: number;
  employee1?: number;
  employee2?: number;
  employee3?: number;
  employee4?: number;
  employeeHours?: number;
  asHours?: number;
  salesPerLaborHour?: number;
  laborCostAmount?: number;
  laborCostRate?: number;
  edwCustomerCount?: number;
  edwGroupCount?: number;
  lunchSales?: number;
  dinnerSales?: number;
  lunchCustomers?: number;
  dinnerCustomers?: number;
  lunchGroups?: number;
  dinnerGroups?: number;
  edwCustomerUnitPrice?: number;
  lunchUnitPrice?: number;
  dinnerUnitPrice?: number;
  ohbCustomers?: number;
  ohbGroups?: number;
  ohbCustomerUnitPrice?: number;
  voidCount?: number;
  voidAmount?: number;
  cashDifference?: number;
  totalHoursWithEmployees?: number;
  edwTotalHours?: number;
  ohbTotalHours?: number;
  edwProductivity?: number;
  ohbProductivity?: number;
  totalProductivity?: number;
} 