/**
 * Unit Tests for Field Aggregation Utilities
 *
 * This file demonstrates usage of the field aggregation utilities
 * and serves as both documentation and test suite.
 */

import {
  aggregateDailyToMonthly,
  getVisibleFieldsForPage,
  getAggregatableFields,
  aggregateAllFields,
  isValidAggregationMethod,
  getRecommendedAggregationMethod
} from '../fieldAggregation';
import { SalesFieldConfig } from '@/types/sales-field-config';

// Sample field configurations for testing
const sampleFields: SalesFieldConfig[] = [
  {
    id: '1',
    key: 'date',
    label: '日付',
    category: 'basic',
    type: 'text',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: false,
    isEditable: false,
    isCalculated: false,
    aggregationMethod: 'none',
    order: 1
  },
  {
    id: '2',
    key: 'revenue',
    label: '売上',
    category: 'sales',
    type: 'currency',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 2
  },
  {
    id: '3',
    key: 'customerUnitPrice',
    label: '客単価',
    category: 'unit_price',
    type: 'currency',
    unit: '円',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    isEditable: false,
    isCalculated: true,
    aggregationMethod: 'average',
    order: 3
  },
  {
    id: '4',
    key: 'dayOfWeek',
    label: '曜日',
    category: 'basic',
    type: 'text',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: false,
    isEditable: false,
    isCalculated: false,
    aggregationMethod: 'none',
    order: 4
  }
];

// Sample daily data for a week
const sampleDailyData = [
  { date: '2024-01-01', dayOfWeek: '月', revenue: 100000, customerUnitPrice: 2000 },
  { date: '2024-01-02', dayOfWeek: '火', revenue: 120000, customerUnitPrice: 2200 },
  { date: '2024-01-03', dayOfWeek: '水', revenue: 110000, customerUnitPrice: 2100 },
  { date: '2024-01-04', dayOfWeek: '木', revenue: 130000, customerUnitPrice: 2300 },
  { date: '2024-01-05', dayOfWeek: '金', revenue: 150000, customerUnitPrice: 2500 }
];

describe('Field Aggregation Utilities', () => {
  describe('aggregateDailyToMonthly', () => {
    it('should sum currency fields correctly', () => {
      const revenueField = sampleFields.find(f => f.key === 'revenue')!;
      const total = aggregateDailyToMonthly(sampleDailyData, revenueField);

      // Expected: 100000 + 120000 + 110000 + 130000 + 150000 = 610000
      expect(total).toBe(610000);
    });

    it('should average unit price fields correctly', () => {
      const unitPriceField = sampleFields.find(f => f.key === 'customerUnitPrice')!;
      const average = aggregateDailyToMonthly(sampleDailyData, unitPriceField);

      // Expected: (2000 + 2200 + 2100 + 2300 + 2500) / 5 = 2220
      expect(average).toBe(2220);
    });

    it('should return null for fields with no valid data', () => {
      const emptyData: any[] = [];
      const revenueField = sampleFields.find(f => f.key === 'revenue')!;
      const result = aggregateDailyToMonthly(emptyData, revenueField);

      expect(result).toBeNull();
    });

    it('should return null for aggregationMethod="none"', () => {
      const dateField = sampleFields.find(f => f.key === 'date')!;
      const result = aggregateDailyToMonthly(sampleDailyData, dateField);

      expect(result).toBeNull();
    });

    it('should filter out null/undefined/empty values', () => {
      const dataWithNulls = [
        { revenue: 100000 },
        { revenue: null },
        { revenue: undefined },
        { revenue: '' },
        { revenue: 200000 }
      ];

      const revenueField = sampleFields.find(f => f.key === 'revenue')!;
      const total = aggregateDailyToMonthly(dataWithNulls, revenueField);

      // Should only sum 100000 + 200000 = 300000
      expect(total).toBe(300000);
    });
  });

  describe('getVisibleFieldsForPage', () => {
    it('should return daily sales visible fields', () => {
      const dailyFields = getVisibleFieldsForPage(sampleFields, 'daily');

      expect(dailyFields.length).toBe(4);  // All fields are visible in daily
      expect(dailyFields.map(f => f.key)).toEqual(['date', 'revenue', 'customerUnitPrice', 'dayOfWeek']);
    });

    it('should return monthly sales visible fields', () => {
      const monthlyFields = getVisibleFieldsForPage(sampleFields, 'monthly');

      expect(monthlyFields.length).toBe(2);  // Only revenue and customerUnitPrice
      expect(monthlyFields.map(f => f.key)).toEqual(['revenue', 'customerUnitPrice']);
    });

    it('should return fields sorted by order', () => {
      const fields = getVisibleFieldsForPage(sampleFields, 'daily');

      for (let i = 1; i < fields.length; i++) {
        expect(fields[i].order).toBeGreaterThanOrEqual(fields[i - 1].order);
      }
    });
  });

  describe('getAggregatableFields', () => {
    it('should return only fields with aggregation methods', () => {
      const aggregatable = getAggregatableFields(sampleFields);

      expect(aggregatable.length).toBe(2);
      expect(aggregatable.map(f => f.key)).toEqual(['revenue', 'customerUnitPrice']);
    });

    it('should exclude fields with aggregationMethod="none"', () => {
      const aggregatable = getAggregatableFields(sampleFields);

      expect(aggregatable.every(f => f.aggregationMethod !== 'none')).toBe(true);
    });

    it('should only include fields visible in monthly sales', () => {
      const aggregatable = getAggregatableFields(sampleFields);

      expect(aggregatable.every(f => f.isVisibleInMonthlySales)).toBe(true);
    });
  });

  describe('aggregateAllFields', () => {
    it('should aggregate all applicable fields', () => {
      const result = aggregateAllFields(sampleDailyData, sampleFields);

      expect(result.revenue).toBe(610000);
      expect(result.customerUnitPrice).toBe(2220);
      expect(result.date).toBeUndefined();  // Not aggregatable
      expect(result.dayOfWeek).toBeUndefined();  // Not aggregatable
    });

    it('should handle empty data', () => {
      const result = aggregateAllFields([], sampleFields);

      expect(result.revenue).toBeNull();
      expect(result.customerUnitPrice).toBeNull();
    });
  });

  describe('isValidAggregationMethod', () => {
    it('should validate currency fields with sum', () => {
      const field: SalesFieldConfig = {
        id: '1',
        key: 'revenue',
        label: '売上',
        category: 'sales',
        type: 'currency',
        isVisible: true,
        isVisibleInDailySales: true,
        isVisibleInMonthlySales: true,
        isEditable: true,
        isCalculated: false,
        aggregationMethod: 'sum',
        order: 1
      };

      expect(isValidAggregationMethod(field)).toBe(true);
    });

    it('should invalidate text fields with sum', () => {
      const field: SalesFieldConfig = {
        id: '1',
        key: 'date',
        label: '日付',
        category: 'basic',
        type: 'text',
        isVisible: true,
        isVisibleInDailySales: true,
        isVisibleInMonthlySales: false,
        isEditable: false,
        isCalculated: false,
        aggregationMethod: 'sum',  // Invalid for text
        order: 1
      };

      expect(isValidAggregationMethod(field)).toBe(false);
    });

    it('should allow percentage fields with average', () => {
      const field: SalesFieldConfig = {
        id: '1',
        key: 'laborCostRate',
        label: '人件費率',
        category: 'labor',
        type: 'percentage',
        isVisible: true,
        isVisibleInDailySales: true,
        isVisibleInMonthlySales: true,
        isEditable: false,
        isCalculated: true,
        aggregationMethod: 'average',
        order: 1
      };

      expect(isValidAggregationMethod(field)).toBe(true);
    });
  });

  describe('getRecommendedAggregationMethod', () => {
    it('should recommend "none" for text fields', () => {
      const recommendation = getRecommendedAggregationMethod({
        type: 'text',
        category: 'basic'
      });

      expect(recommendation).toBe('none');
    });

    it('should recommend "sum" for currency fields', () => {
      const recommendation = getRecommendedAggregationMethod({
        type: 'currency',
        category: 'sales'
      });

      expect(recommendation).toBe('sum');
    });

    it('should recommend "average" for percentage fields', () => {
      const recommendation = getRecommendedAggregationMethod({
        type: 'percentage',
        category: 'labor'
      });

      expect(recommendation).toBe('average');
    });

    it('should recommend "average" for unit price category', () => {
      const recommendation = getRecommendedAggregationMethod({
        type: 'currency',
        category: 'unit_price'
      });

      expect(recommendation).toBe('average');
    });
  });
});

// Export for manual testing
export const testExamples = {
  sampleFields,
  sampleDailyData,

  // Example: Get monthly summary
  getMonthlySummary: () => {
    return aggregateAllFields(sampleDailyData, sampleFields);
  },

  // Example: Get fields for daily page
  getDailyPageFields: () => {
    return getVisibleFieldsForPage(sampleFields, 'daily');
  },

  // Example: Get fields for monthly page
  getMonthlyPageFields: () => {
    return getVisibleFieldsForPage(sampleFields, 'monthly');
  }
};
