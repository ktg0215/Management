import { DailySalesData } from '../types/sales';

export const calculateDerivedValues = (data: DailySalesData): DailySalesData => {
  const result = { ...data };

  // EDW売上計算 (店舗純売上 - OHB純売上)
  if (data.storeNetSales !== undefined && data.ohbNetSales !== undefined) {
    result.edwNetSales = data.storeNetSales - data.ohbNetSales;
  }

  // 社員時間計算 (社員1 + 社員2 + 社員3 + 社員4)
  if (data.employee1 !== undefined || data.employee2 !== undefined || data.employee3 !== undefined || data.employee4 !== undefined) {
    result.employeeHours = (data.employee1 || 0) + (data.employee2 || 0) + (data.employee3 || 0) + (data.employee4 || 0);
  }

  // EDW客数計算 (総客数 - OHB客数)
  if (data.totalCustomers !== undefined && data.ohbCustomers !== undefined) {
    result.edwCustomerCount = data.totalCustomers - data.ohbCustomers;
  }

  // EDW組数計算 (総組数 - OHB組数)
  if (data.totalGroups !== undefined && data.ohbGroups !== undefined) {
    result.edwGroupCount = data.totalGroups - data.ohbGroups;
  }

  // 組単価計算
  if (data.storeNetSales !== undefined && data.totalGroups !== undefined && data.totalGroups > 0) {
    result.groupUnitPrice = data.storeNetSales / data.totalGroups;
  }

  // 客単価計算
  if (data.storeNetSales !== undefined && data.totalCustomers !== undefined && data.totalCustomers > 0) {
    result.customerUnitPrice = data.storeNetSales / data.totalCustomers;
  }

  // ランチ売上計算 (店舗純売上 - ディナー売上)
  if (data.storeNetSales !== undefined && data.dinnerSales !== undefined) {
    result.lunchSales = data.storeNetSales - data.dinnerSales;
  }

  // ランチ客数計算 (総客数 - ディナー客数)
  if (data.totalCustomers !== undefined && data.dinnerCustomers !== undefined) {
    result.lunchCustomers = data.totalCustomers - data.dinnerCustomers;
  }

  // ランチ組数計算 (総組数 - ディナー組数)
  if (data.totalGroups !== undefined && data.dinnerGroups !== undefined) {
    result.lunchGroups = data.totalGroups - data.dinnerGroups;
  }

  // ランチ単価計算
  if (result.lunchSales !== undefined && result.lunchCustomers !== undefined && result.lunchCustomers > 0) {
    result.lunchUnitPrice = result.lunchSales / result.lunchCustomers;
  }

  // ディナー単価計算
  if (data.dinnerSales !== undefined && data.dinnerCustomers !== undefined && data.dinnerCustomers > 0) {
    result.dinnerUnitPrice = data.dinnerSales / data.dinnerCustomers;
  }

  // EDW客単価計算
  if (result.edwNetSales !== undefined && result.edwCustomerCount !== undefined && result.edwCustomerCount > 0) {
    result.edwCustomerUnitPrice = result.edwNetSales / result.edwCustomerCount;
  }

  // OHB客単価計算
  if (data.ohbNetSales !== undefined && data.ohbCustomers !== undefined && data.ohbCustomers > 0) {
    result.ohbCustomerUnitPrice = data.ohbNetSales / data.ohbCustomers;
  }

  // 総労働時間計算
  if (result.employeeHours !== undefined && data.asHours !== undefined) {
    result.totalHoursWithEmployees = result.employeeHours + data.asHours;
  }

  // EDW総時間計算
  if (result.totalHoursWithEmployees !== undefined && data.ohbTotalHours !== undefined) {
    result.edwTotalHours = result.totalHoursWithEmployees - data.ohbTotalHours;
  }

  // 人時売上高計算
  if (data.storeNetSales !== undefined && result.totalHoursWithEmployees !== undefined && result.totalHoursWithEmployees > 0) {
    result.salesPerLaborHour = data.storeNetSales / result.totalHoursWithEmployees;
  }

  // 人件費率計算
  if (data.laborCostAmount !== undefined && data.storeNetSales !== undefined && data.storeNetSales > 0) {
    result.laborCostRate = (data.laborCostAmount / data.storeNetSales) * 100;
  }

  // 生産性計算
  if (result.edwNetSales !== undefined && result.edwTotalHours !== undefined && result.edwTotalHours > 0) {
    result.edwProductivity = result.edwNetSales / result.edwTotalHours;
  }

  if (data.ohbNetSales !== undefined && data.ohbTotalHours !== undefined && data.ohbTotalHours > 0) {
    result.ohbProductivity = data.ohbNetSales / data.ohbTotalHours;
  }

  if (data.storeNetSales !== undefined && result.totalHoursWithEmployees !== undefined && result.totalHoursWithEmployees > 0) {
    result.totalProductivity = data.storeNetSales / result.totalHoursWithEmployees;
  }

  return result;
};

export const calculateCumulativeValues = (
  dailyData: { [date: string]: DailySalesData },
  year: number,
  month: number
): { [date: string]: DailySalesData } => {
  const result = { ...dailyData };
  const sortedDates = Object.keys(dailyData).sort();
  
  let storeNetSalesCumulative = 0;
  let edwNetSalesCumulative = 0;
  let ohbNetSalesCumulative = 0;
  let salesTargetCumulative = 0;

  for (const date of sortedDates) {
    const data = result[date];
    
    if (data.storeNetSales !== undefined) {
      storeNetSalesCumulative += data.storeNetSales;
      data.storeNetSalesCumulative = storeNetSalesCumulative;
    }

    if (data.edwNetSales !== undefined) {
      edwNetSalesCumulative += data.edwNetSales;
      data.edwNetSalesCumulative = edwNetSalesCumulative;
    }

    if (data.ohbNetSales !== undefined) {
      ohbNetSalesCumulative += data.ohbNetSales;
      data.ohbNetSalesCumulative = ohbNetSalesCumulative;
    }

    if (data.salesTarget !== undefined) {
      salesTargetCumulative += data.salesTarget;
      data.targetCumulative = salesTargetCumulative;
    }

    // 対目標比計算
    if (data.salesTarget !== undefined && data.salesTarget > 0) {
      data.targetAchievementRate = ((data.storeNetSales || 0) / data.salesTarget) * 100;
    }

    // 前年比計算（前年データがある場合）
    // 注: 前年データの取得ロジックは別途実装が必要
    if (data.storeNetSales !== undefined) {
      // 仮の前年データ（実際の実装では前年データを取得する必要があります）
      const lastYearSales = data.storeNetSales * 0.95; // 仮の値
      data.yearOnYear = lastYearSales > 0 ? ((data.storeNetSales / lastYearSales) - 1) * 100 : 0;
    }

    // EDW前年比計算
    if (data.edwNetSales !== undefined) {
      const lastYearEdwSales = data.edwNetSales * 0.95; // 仮の値
      data.edwYearOnYear = lastYearEdwSales > 0 ? ((data.edwNetSales / lastYearEdwSales) - 1) * 100 : 0;
    }

    // OHB前年比計算
    if (data.ohbNetSales !== undefined) {
      const lastYearOhbSales = data.ohbNetSales * 0.95; // 仮の値
      data.ohbYearOnYear = lastYearOhbSales > 0 ? ((data.ohbNetSales / lastYearOhbSales) - 1) * 100 : 0;
    }
  }

  return result;
}; 