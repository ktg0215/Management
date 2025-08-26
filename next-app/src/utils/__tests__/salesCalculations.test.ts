import { calculateCumulativeValues, calculateDerivedValues } from '../salesCalculations';
import { EDWDailySalesData } from '../../types/sales';

describe('salesCalculations', () => {
  describe('calculateCumulativeValues', () => {
    const mockDailyData = {
      '2024-01-01': {
        date: '2024-01-01',
        storeNetSales: 100000,
        totalSales: 110000,
      } as EDWDailySalesData,
      '2024-01-02': {
        date: '2024-01-02',
        storeNetSales: 120000,
        totalSales: 130000,
      } as EDWDailySalesData,
      '2024-01-03': {
        date: '2024-01-03',
        storeNetSales: 90000,
        totalSales: 100000,
      } as EDWDailySalesData,
    };

    test('should calculate cumulative values correctly for store net sales', () => {
      const result = calculateCumulativeValues(mockDailyData, 2024, 1);
      
      expect(result['2024-01-01'].storeNetSalesCumulative).toBe(100000);
      expect(result['2024-01-02'].storeNetSalesCumulative).toBe(220000);
      expect(result['2024-01-03'].storeNetSalesCumulative).toBe(310000);
    });

    test('should calculate cumulative values correctly for total sales', () => {
      const result = calculateCumulativeValues(mockDailyData, 2024, 1);
      
      expect(result['2024-01-01'].totalSalesCumulative).toBe(110000);
      expect(result['2024-01-02'].totalSalesCumulative).toBe(240000);
      expect(result['2024-01-03'].totalSalesCumulative).toBe(340000);
    });

    test('should handle undefined values gracefully', () => {
      const dataWithUndefined = {
        '2024-01-01': {
          date: '2024-01-01',
          storeNetSales: 100000,
          totalSales: undefined,
        } as EDWDailySalesData,
        '2024-01-02': {
          date: '2024-01-02',
          storeNetSales: undefined,
          totalSales: 130000,
        } as EDWDailySalesData,
      };

      const result = calculateCumulativeValues(dataWithUndefined, 2024, 1);
      
      expect(result['2024-01-01'].storeNetSalesCumulative).toBe(100000);
      expect(result['2024-01-01'].totalSalesCumulative).toBe(0);
      expect(result['2024-01-02'].storeNetSalesCumulative).toBe(100000);
      expect(result['2024-01-02'].totalSalesCumulative).toBe(130000);
    });

    test('should handle empty data object', () => {
      const result = calculateCumulativeValues({}, 2024, 1);
      expect(result).toEqual({});
    });
  });

  describe('calculateDerivedValues', () => {
    test('should calculate derived values correctly', () => {
      const inputData: Partial<EDWDailySalesData> = {
        totalSales: 110000,
        salesTax: 10000,
        storeNetSales: undefined, // 自動計算されるべき
      };

      const result = calculateDerivedValues(inputData);

      // 店舗売上高 = 総売上 - 消費税
      expect(result.storeNetSales).toBe(100000);
    });

    test('should preserve manual input values', () => {
      const inputData: Partial<EDWDailySalesData> = {
        totalSales: 110000,
        salesTax: 10000,
        storeNetSales: 95000, // 手動入力値
      };

      const result = calculateDerivedValues(inputData);

      // 手動入力値が優先されるべき
      expect(result.storeNetSales).toBe(95000);
    });

    test('should handle missing required fields gracefully', () => {
      const inputData: Partial<EDWDailySalesData> = {
        totalSales: 110000,
        // salesTax が未定義
      };

      const result = calculateDerivedValues(inputData);

      // 計算に必要な値がない場合は undefined になる
      expect(result.storeNetSales).toBeUndefined();
      expect(result.totalSales).toBe(110000);
    });
  });
});