import { MonthlyData, DailySalesData } from '../types/sales';
import { getDaysInMonth, getDayOfWeek, formatDate } from './salesUtils';
import { calculateDerivedValues, calculateCumulativeValues } from './salesCalculations';
import { EDW_SALES_FIELDS } from '../types/sales';

const getRandomInRange = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomDecimal = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

// より現実的な売上データを生成する関数
export const generateDemoData = (year: number, month: number): MonthlyData => {
  const daysInMonth = getDaysInMonth(year, month);
  const dailyData: { [date: string]: DailySalesData } = {};

  // 月の進行に応じた売上変動を考慮
  const monthProgress = (day: number) => {
    const progress = day / daysInMonth;
    // 月初と月末は売上が高くなる傾向
    if (progress <= 0.1 || progress >= 0.9) return 1.1;
    if (progress <= 0.2 || progress >= 0.8) return 1.05;
    return 1.0;
  };

  // 曜日別の売上倍率
  const getDayMultiplier = (dayOfWeek: string) => {
    switch (dayOfWeek) {
      case '月': return 0.9;
      case '火': return 0.95;
      case '水': return 0.9;
      case '木': return 1.0;
      case '金': return 1.1;
      case '土': return 1.3;
      case '日': return 1.2;
      default: return 1.0;
    }
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDate(year, month, day);
    const dayOfWeek = getDayOfWeek(year, month, day);
    
    // 基本売上データ（より現実的な値に調整）
    const baseSales = 180000; // 基本売上
    const dayMultiplier = getDayMultiplier(dayOfWeek);
    const progressMultiplier = monthProgress(day);
    const totalMultiplier = dayMultiplier * progressMultiplier;
    
    const storeNetSales = Math.round(baseSales * totalMultiplier * getRandomDecimal(0.85, 1.15));
    const ohbNetSales = Math.round(storeNetSales * getRandomDecimal(0.12, 0.18));
    const totalGroups = getRandomInRange(45, 95);
    const totalCustomers = getRandomInRange(90, 180);
    
    // ディナー関連（より現実的な比率）
    const dinnerSalesRatio = getRandomDecimal(0.55, 0.65);
    const dinnerSales = Math.round(storeNetSales * dinnerSalesRatio);
    const dinnerCustomers = Math.round(totalCustomers * dinnerSalesRatio);
    const dinnerGroups = Math.round(totalGroups * dinnerSalesRatio);
    
    // ランチ関連
    const lunchSales = storeNetSales - dinnerSales - ohbNetSales;
    const lunchCustomers = Math.round(totalCustomers * getRandomDecimal(0.25, 0.35));
    const lunchGroups = Math.round(totalGroups * getRandomDecimal(0.25, 0.35));
    
    const ohbCustomers = getRandomInRange(18, 35);
    const ohbGroups = getRandomInRange(15, 30); // OHB組数を追加
    const employeeHours = getRandomDecimal(14, 22);
    const asHours = getRandomDecimal(25, 45);
    const ohbTotalHours = getRandomDecimal(10, 18);
    
    // 人件費（より現実的な計算）
    const laborCostAmount = Math.round(
      (employeeHours * 2800 + asHours * 1300 + ohbTotalHours * 1500) * 
      getRandomDecimal(0.9, 1.1)
    );
    
    const voidCount = getRandomInRange(0, 4);
    const voidAmount = voidCount > 0 ? voidCount * getRandomInRange(800, 2500) : 0;
    const cashDifference = getRandomInRange(-800, 800);

    // 集計担当者（より多くのバリエーション）
    const managers = ['田中', '佐藤', '鈴木', '高橋', '中村', '渡辺', '伊藤', '山田', '小林', '加藤'];
    const collectionManager = managers[getRandomInRange(0, managers.length - 1)];

    // 売上目標（月の目標を設定）
    const salesTarget = Math.round(baseSales * daysInMonth * 1.05);

    // EDW_SALES_FIELDSの全項目を初期化
    const edwBase: any = {};
    EDW_SALES_FIELDS.forEach(field => {
      edwBase[field.key] = undefined;
    });

    // デモ用に全項目に値をセット
    edwBase['date'] = dateKey;
    edwBase['dayOfWeek'] = dayOfWeek;
    edwBase['salesTarget'] = salesTarget;
    edwBase['collectionManager'] = collectionManager;
    edwBase['storeNetSales'] = storeNetSales;
    edwBase['ohbNetSales'] = ohbNetSales;
    edwBase['totalGroups'] = totalGroups;
    edwBase['totalCustomers'] = totalCustomers;
    edwBase['dinnerSales'] = dinnerSales;
    edwBase['dinnerCustomers'] = dinnerCustomers;
    edwBase['dinnerGroups'] = dinnerGroups;
    edwBase['lunchSales'] = lunchSales;
    edwBase['lunchCustomers'] = lunchCustomers;
    edwBase['lunchGroups'] = lunchGroups;
    edwBase['ohbCustomers'] = ohbCustomers;
    edwBase['ohbGroups'] = ohbGroups; // OHB組数を追加
    edwBase['employee1'] = getRandomDecimal(6, 10);
    edwBase['employee2'] = getRandomDecimal(4, 8);
    edwBase['employee3'] = getRandomDecimal(2, 6);
    edwBase['employee4'] = getRandomDecimal(0, 4);
    edwBase['employeeHours'] = employeeHours;
    edwBase['asHours'] = asHours;
    edwBase['ohbTotalHours'] = ohbTotalHours;
    edwBase['laborCostAmount'] = laborCostAmount;
    edwBase['voidCount'] = voidCount;
    edwBase['voidAmount'] = voidAmount;
    edwBase['cashDifference'] = cashDifference;

    // 単価計算
    edwBase['edwCustomerUnitPrice'] = Math.round((dinnerSales + lunchSales) / (dinnerCustomers + lunchCustomers));
    edwBase['lunchUnitPrice'] = Math.round(lunchSales / lunchCustomers);
    edwBase['dinnerUnitPrice'] = Math.round(dinnerSales / dinnerCustomers);

    // 計算項目を追加
    dailyData[dateKey] = calculateDerivedValues(edwBase);
  }

  // 累計値を計算
  const dailyDataWithCumulatives = calculateCumulativeValues(dailyData, year, month);

  return {
    year,
    month,
    dailyData: dailyDataWithCumulatives,
  };
};

// 複数月のデモデータを生成する関数
export const generateMultiMonthDemoData = (startYear: number, startMonth: number, months: number = 3) => {
  const allData: { [key: string]: MonthlyData } = {};
  
  for (let i = 0; i < months; i++) {
    let year = startYear;
    let month = startMonth + i;
    
    // 月の調整
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    
    const monthlyData = generateDemoData(year, month);
    const key = `salesData_${year}_${month}`;
    allData[key] = monthlyData;
  }
  
  return allData;
}; 