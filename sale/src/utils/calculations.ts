import { DailySalesData } from '../types/sales';

export const calculateDerivedValues = (data: Partial<DailySalesData>): DailySalesData => {
  const result: DailySalesData = {
    ...data,
    date: data.date || '',
    dayOfWeek: data.dayOfWeek || '',
  };

  // EDW純売上 = 店舗純売上 - OHB純売上
  result.edwNetSales = (result.storeNetSales || 0) - (result.ohbNetSales || 0);

  // ランチ売上 = EDW純売上 - ディナー売上
  result.lunchSales = (result.edwNetSales || 0) - (result.dinnerSales || 0);

  // ランチ客数 = 総客数 - ディナー客数 - OHB客数
  result.lunchCustomers = (result.totalCustomers || 0) - (result.dinnerCustomers || 0) - (result.ohbCustomers || 0);

  // ランチ組数 = 総組数 - ディナー組数
  result.lunchGroups = (result.totalGroups || 0) - (result.dinnerGroups || 0);

  // 組単価 = 店舗純売上 ÷ 組数
  if (result.totalGroups && result.totalGroups > 0) {
    result.groupUnitPrice = (result.storeNetSales || 0) / result.totalGroups;
  }

  // 客単価 = 店舗純売上 ÷ 客数
  if (result.totalCustomers && result.totalCustomers > 0) {
    result.customerUnitPrice = (result.storeNetSales || 0) / result.totalCustomers;
  }

  // ランチ単価
  if (result.lunchCustomers && result.lunchCustomers > 0) {
    result.lunchUnitPrice = (result.lunchSales || 0) / result.lunchCustomers;
  }

  // ディナー単価
  if (result.dinnerCustomers && result.dinnerCustomers > 0) {
    result.dinnerUnitPrice = (result.dinnerSales || 0) / result.dinnerCustomers;
  }

  // EDW客単価
  const edwCustomers = (result.totalCustomers || 0) - (result.ohbCustomers || 0);
  if (edwCustomers > 0) {
    result.edwCustomerUnitPrice = (result.edwNetSales || 0) / edwCustomers;
  }

  // OHB客単価
  if (result.ohbCustomers && result.ohbCustomers > 0) {
    result.ohbCustomerUnitPrice = (result.ohbNetSales || 0) / result.ohbCustomers;
  }

  // 総時間（社員込）= AS時間 + 社員時間
  result.totalHoursWithEmployees = (result.asHours || 0) + (result.employeeHours || 0);

  // EDW総時間 = 総時間 - OHB総時間
  result.edwTotalHours = (result.totalHoursWithEmployees || 0) - (result.ohbTotalHours || 0);

  // 人時売上高 = 店舗純売上 ÷ 総時間
  if (result.totalHoursWithEmployees && result.totalHoursWithEmployees > 0) {
    result.salesPerLaborHour = (result.storeNetSales || 0) / result.totalHoursWithEmployees;
  }

  // 人件費率 = (人件費額 ÷ 店舗純売上) × 100
  if (result.storeNetSales && result.storeNetSales > 0) {
    result.laborCostRate = ((result.laborCostAmount || 0) / result.storeNetSales) * 100;
  }

  // EDW生産性
  if (result.edwTotalHours && result.edwTotalHours > 0) {
    result.edwProductivity = (result.edwNetSales || 0) / result.edwTotalHours;
  }

  // OHB生産性
  if (result.ohbTotalHours && result.ohbTotalHours > 0) {
    result.ohbProductivity = (result.ohbNetSales || 0) / result.ohbTotalHours;
  }

  // 総合生産性
  if (result.totalHoursWithEmployees && result.totalHoursWithEmployees > 0) {
    result.totalProductivity = (result.storeNetSales || 0) / result.totalHoursWithEmployees;
  }

  return result;
};

export const calculateCumulativeValues = (
  dailyData: { [date: string]: DailySalesData },
  year: number,
  month: number
): { [date: string]: DailySalesData } => {
  const result = { ...dailyData };
  let storeNetSalesCumulative = 0;
  let edwNetSalesCumulative = 0;
  let ohbNetSalesCumulative = 0;

  // 日付順にソートして累計計算
  const sortedDates = Object.keys(result).sort();
  
  for (const dateKey of sortedDates) {
    const data = result[dateKey];
    if (data.storeNetSales !== undefined) {
      storeNetSalesCumulative += data.storeNetSales;
      edwNetSalesCumulative += data.edwNetSales || 0;
      ohbNetSalesCumulative += data.ohbNetSales || 0;
      
      result[dateKey] = {
        ...data,
        storeNetSalesCumulative,
        edwNetSalesCumulative,
        ohbNetSalesCumulative,
      };
    }
  }

  return result;
};