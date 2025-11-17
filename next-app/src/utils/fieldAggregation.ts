/**
 * Field Aggregation Utilities
 *
 * This module provides utilities for aggregating daily sales data into monthly summaries
 * based on field configurations defined in SalesFieldConfig.
 */

import { SalesFieldConfig, AggregationMethod } from '@/types/sales-field-config';

/**
 * Calculate monthly aggregated value from daily data based on field's aggregation method
 *
 * @param dailyData - Array of daily records containing sales data
 * @param field - Field configuration specifying how to aggregate
 * @returns Aggregated value (sum or average) or null if no valid data
 *
 * @example
 * ```typescript
 * const dailySales = [
 *   { revenue: 10000, customerCount: 50 },
 *   { revenue: 12000, customerCount: 60 },
 *   { revenue: 11000, customerCount: 55 }
 * ];
 *
 * const revenueField = {
 *   key: 'revenue',
 *   aggregationMethod: 'sum'
 * };
 *
 * const totalRevenue = aggregateDailyToMonthly(dailySales, revenueField);
 * // Returns: 33000
 * ```
 */
export function aggregateDailyToMonthly(
  dailyData: Record<string, any>[],
  field: SalesFieldConfig
): number | null {
  if (!dailyData || dailyData.length === 0) {
    return null;
  }

  // Filter out records where the field value is undefined, null, or empty string
  const validValues = dailyData
    .map(record => record[field.key])
    .filter(value =>
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !isNaN(Number(value))
    )
    .map(value => Number(value));

  if (validValues.length === 0) {
    return null;
  }

  switch (field.aggregationMethod) {
    case 'sum':
      return validValues.reduce((sum, value) => sum + value, 0);

    case 'average':
      const sum = validValues.reduce((total, value) => total + value, 0);
      return sum / validValues.length;

    case 'none':
    default:
      return null;
  }
}

/**
 * Get all fields that are visible for a specific page
 *
 * @param fields - Array of field configurations
 * @param page - Target page ('daily' or 'monthly')
 * @returns Filtered array of fields visible on the specified page, sorted by order
 *
 * @example
 * ```typescript
 * const fields = [
 *   { key: 'date', isVisibleInDailySales: true, isVisibleInMonthlySales: false, order: 1 },
 *   { key: 'revenue', isVisibleInDailySales: true, isVisibleInMonthlySales: true, order: 2 }
 * ];
 *
 * const monthlyFields = getVisibleFieldsForPage(fields, 'monthly');
 * // Returns: [{ key: 'revenue', ... }]
 * ```
 */
export function getVisibleFieldsForPage(
  fields: SalesFieldConfig[],
  page: 'daily' | 'monthly'
): SalesFieldConfig[] {
  return fields
    .filter(field => {
      if (field.fieldSource === 'dailyOnly') return page === 'daily';
      if (field.fieldSource === 'monthlyOnly') return page === 'monthly';
      if (field.fieldSource === 'linked') {
        return page === 'daily' ? field.isVisibleInDailySales : field.isVisibleInMonthlySales;
      }
      return false;
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all fields that should be aggregated for monthly sales
 * (fields visible in monthly sales with aggregation method other than 'none')
 *
 * @param fields - Array of field configurations
 * @returns Filtered array of fields that should be aggregated
 *
 * @example
 * ```typescript
 * const fields = [
 *   { key: 'date', isVisibleInMonthlySales: false, aggregationMethod: 'none' },
 *   { key: 'revenue', isVisibleInMonthlySales: true, aggregationMethod: 'sum' },
 *   { key: 'customerUnitPrice', isVisibleInMonthlySales: true, aggregationMethod: 'average' }
 * ];
 *
 * const aggregatableFields = getAggregatableFields(fields);
 * // Returns: [{ key: 'revenue', ... }, { key: 'customerUnitPrice', ... }]
 * ```
 */
export function getAggregatableFields(
  fields: SalesFieldConfig[]
): SalesFieldConfig[] {
  return fields
    .filter(field =>
      field.fieldSource === 'linked' &&
      field.aggregationMethod !== 'none'
    )
    .sort((a, b) => a.order - b.order);
}

/**
 * Aggregate all fields from daily data to monthly summary
 *
 * @param dailyData - Array of daily records
 * @param fields - Array of field configurations
 * @returns Object containing aggregated values for each field
 *
 * @example
 * ```typescript
 * const dailyData = [
 *   { date: '2024-01-01', revenue: 10000, cost: 3000 },
 *   { date: '2024-01-02', revenue: 12000, cost: 3500 }
 * ];
 *
 * const fields = [
 *   { key: 'revenue', aggregationMethod: 'sum', isVisibleInMonthlySales: true },
 *   { key: 'cost', aggregationMethod: 'sum', isVisibleInMonthlySales: true }
 * ];
 *
 * const monthlySummary = aggregateAllFields(dailyData, fields);
 * // Returns: { revenue: 22000, cost: 6500 }
 * ```
 */
export function aggregateAllFields(
  dailyData: Record<string, any>[],
  fields: SalesFieldConfig[]
): Record<string, number | null> {
  const aggregatableFields = getAggregatableFields(fields);
  const result: Record<string, number | null> = {};

  for (const field of aggregatableFields) {
    result[field.key] = aggregateDailyToMonthly(dailyData, field);
  }

  return result;
}

/**
 * Check if a field's aggregation method is compatible with its type
 *
 * @param field - Field configuration to validate
 * @returns true if aggregation method is appropriate for the field type
 *
 * @example
 * ```typescript
 * const currencyField = { type: 'currency', aggregationMethod: 'sum' };
 * isValidAggregationMethod(currencyField); // true
 *
 * const textField = { type: 'text', aggregationMethod: 'sum' };
 * isValidAggregationMethod(textField); // false (text shouldn't be aggregated)
 * ```
 */
export function isValidAggregationMethod(field: SalesFieldConfig): boolean {
  const { type, aggregationMethod } = field;

  // Text fields should not be aggregated
  if (type === 'text' && aggregationMethod !== 'none') {
    return false;
  }

  // Numeric types can use any aggregation method
  if (['currency', 'number', 'count'].includes(type)) {
    return ['sum', 'average', 'none'].includes(aggregationMethod);
  }

  // Percentage fields typically use average
  if (type === 'percentage') {
    return ['average', 'none'].includes(aggregationMethod);
  }

  return true;
}

/**
 * Get recommended aggregation method based on field type
 *
 * @param field - Field configuration
 * @returns Recommended aggregation method for the field type
 *
 * @example
 * ```typescript
 * const currencyField = { type: 'currency' };
 * getRecommendedAggregationMethod(currencyField); // 'sum'
 *
 * const percentageField = { type: 'percentage' };
 * getRecommendedAggregationMethod(percentageField); // 'average'
 * ```
 */
export function getRecommendedAggregationMethod(
  field: Pick<SalesFieldConfig, 'type' | 'category'>
): AggregationMethod {
  const { type, category } = field;

  // Text and basic fields should not be aggregated
  if (type === 'text' || category === 'basic') {
    return 'none';
  }

  // Percentage and unit price fields should use average
  if (type === 'percentage' || category === 'unit_price') {
    return 'average';
  }

  // Currency, number, and count fields should use sum
  if (['currency', 'number', 'count'].includes(type)) {
    return 'sum';
  }

  return 'none';
}
