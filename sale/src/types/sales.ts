export interface DailySalesData {
  date: string;
  dayOfWeek: string;
  isHoliday?: boolean;
  
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