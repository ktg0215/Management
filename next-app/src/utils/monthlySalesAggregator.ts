import { DailySalesData } from '../types/sales';
import { MonthlyData } from '../types/monthly-sales';
import { EDW_SALES_FIELDS } from '../types/sales';

/**
 * 日次売上データ配列を月次売上管理のデータ形式に集計変換する
 * @param dailyData 日次売上データ（1ヶ月分）
 * @param storeId 店舗ID
 * @param businessTypeId 業態ID
 * @param year 年
 * @param month 月
 * @returns MonthlyData
 */
export function aggregateDailyToMonthly(
  dailyData: DailySalesData[],
  storeId: string,
  businessTypeId: string,
  year: number,
  month: number
): Omit<MonthlyData, 'id' | 'createdAt' | 'updatedAt'> {
  // 月次データの各項目を集計
  const result: Record<string, number | string> = {};

  EDW_SALES_FIELDS.forEach(field => {
    // 数値型の項目は合計、文字列型は最終値をセット
    const values = dailyData.map(d => d[field.key]).filter(v => v !== undefined);
    if (values.length > 0 && typeof values[0] === 'number') {
      // 合計値
      const sum = values.reduce((acc: number, v) => acc + (typeof v === 'number' ? v : 0), 0);
      result[field.key] = sum;
    } else if (values.length > 0 && typeof values[0] === 'string') {
      // 文字列は最終値
      result[field.key] = values.reverse().find(v => typeof v === 'string') ?? '';
    }
    // その他型は無視
  });

  return {
    storeId,
    businessTypeId,
    year,
    month,
    data: result,
  };
} 