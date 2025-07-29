import { DailySalesData, MonthlyData } from '../types/sales';
import { formatDate, getDayOfWeek } from './dateUtils';
import { calculateDerivedValues, calculateCumulativeValues } from './calculations';

// デモデータ生成用のランダム値生成関数
const randomBetween = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomFloat = (min: number, max: number, decimals: number = 1): number => {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
};

// 曜日に基づく売上係数（土日は高め、平日は標準）
const getDayMultiplier = (dayOfWeek: string): number => {
  switch (dayOfWeek) {
    case '土': return 1.4;
    case '日': return 1.3;
    case '金': return 1.2;
    case '木': return 1.1;
    default: return 1.0;
  }
};

// 月の進行に基づく係数（月末に向けて少し上昇）
const getProgressMultiplier = (day: number, totalDays: number): number => {
  return 0.9 + (day / totalDays) * 0.2;
};

export const generateDemoData = (year: number, month: number): MonthlyData => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyData: { [date: string]: DailySalesData } = {};
  
  // 基準値設定
  const baseSales = 450000; // 基準売上
  const baseCustomers = 180; // 基準客数
  const baseGroups = 85; // 基準組数

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDate(year, month, day);
    const dayOfWeek = getDayOfWeek(year, month, day);
    const dayMultiplier = getDayMultiplier(dayOfWeek);
    const progressMultiplier = getProgressMultiplier(day, daysInMonth);
    const totalMultiplier = dayMultiplier * progressMultiplier;

    // 一部の日は未入力として残す（約20%）
    const shouldHaveData = Math.random() > 0.2;
    
    if (shouldHaveData) {
      // 売上データ生成
      const storeNetSales = Math.round(baseSales * totalMultiplier * randomFloat(0.8, 1.2));
      const ohbNetSales = Math.round(storeNetSales * randomFloat(0.15, 0.25));
      const totalCustomers = Math.round(baseCustomers * totalMultiplier * randomFloat(0.8, 1.2));
      const totalGroups = Math.round(baseGroups * totalMultiplier * randomFloat(0.8, 1.2));
      
      // ディナー関連（全体の60-70%）
      const dinnerRatio = randomFloat(0.6, 0.7);
      const dinnerSales = Math.round(storeNetSales * dinnerRatio);
      const dinnerCustomers = Math.round(totalCustomers * dinnerRatio);
      const dinnerGroups = Math.round(totalGroups * dinnerRatio);
      
      // OHB客数（全体の15-25%）
      const ohbCustomers = Math.round(totalCustomers * randomFloat(0.15, 0.25));
      
      // 勤怠データ
      const employeeHours = randomFloat(8, 12);
      const asHours = randomFloat(25, 40);
      const ohbTotalHours = randomFloat(6, 10);
      const laborCostAmount = Math.round((employeeHours * 2500 + asHours * 1200) * randomFloat(0.9, 1.1));
      
      // その他データ
      const voidCount = randomBetween(0, 3);
      const voidAmount = voidCount > 0 ? randomBetween(1000, 8000) : 0;
      const cashDifference = randomBetween(-500, 500);
      
      // 集計担当者（ランダムに選択）
      const managers = ['田中', '佐藤', '鈴木', '高橋', '渡辺', '伊藤', '山田'];
      const collectionManager = managers[randomBetween(0, managers.length - 1)];

      // 基本データを設定
      const baseData: Partial<DailySalesData> = {
        date: dateKey,
        dayOfWeek,
        collectionManager,
        storeNetSales,
        ohbNetSales,
        totalGroups,
        totalCustomers,
        dinnerSales,
        dinnerCustomers,
        dinnerGroups,
        ohbCustomers,
        employeeHours,
        asHours,
        ohbTotalHours,
        laborCostAmount,
        voidCount,
        voidAmount,
        cashDifference,
      };

      // 計算値を含む完全なデータを生成
      dailyData[dateKey] = calculateDerivedValues(baseData);
    } else {
      // 未入力の日
      dailyData[dateKey] = {
        date: dateKey,
        dayOfWeek,
      };
    }
  }

  // 累計値を計算
  const dailyDataWithCumulatives = calculateCumulativeValues(dailyData, year, month);

  return {
    year,
    month,
    dailyData: dailyDataWithCumulatives,
  };
};
