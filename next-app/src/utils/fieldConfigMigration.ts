/**
 * Field Configuration Migration Utilities
 *
 * This module provides utilities for migrating old field configurations
 * (with only isVisible) to new field configurations (with isVisibleInDailySales
 * and isVisibleInMonthlySales).
 */

import {
  SalesFieldConfig,
  AggregationMethod,
  SalesFieldType,
  SalesFieldCategory
} from '@/types/sales-field-config';
import { getRecommendedAggregationMethod } from './fieldAggregation';

/**
 * Old field configuration interface (before migration)
 */
export interface LegacySalesFieldConfig {
  id: string;
  key: string;
  label: string;
  category: SalesFieldCategory;
  type: SalesFieldType;
  unit?: string;
  isVisible: boolean;  // Only one visibility flag in old schema
  isEditable: boolean;
  isCalculated: boolean;
  order: number;
}

/**
 * Migration result with warnings
 */
export interface MigrationResult {
  migratedFields: SalesFieldConfig[];
  warnings: string[];
}

/**
 * Determine if a field should be visible in monthly sales based on its properties
 *
 * Rules:
 * - Basic fields (date, dayOfWeek, text fields in basic category) -> false
 * - Numeric fields (currency, number, count) -> true
 * - Percentage fields -> true
 * - Text fields in other categories -> false (e.g., collectionManager)
 *
 * @param field - Legacy field configuration
 * @returns true if field should be visible in monthly sales by default
 */
function shouldShowInMonthlySales(field: LegacySalesFieldConfig): boolean {
  // Basic category fields should not be shown in monthly sales
  if (field.category === 'basic') {
    return false;
  }

  // Text fields (except basic) typically should not be in monthly view
  if (field.type === 'text') {
    return false;
  }

  // Numeric fields should be shown in monthly sales
  if (['currency', 'number', 'count', 'percentage'].includes(field.type)) {
    return true;
  }

  return false;
}

/**
 * Determine aggregation method based on field type and category
 *
 * @param field - Legacy field configuration
 * @returns Recommended aggregation method
 */
function determineAggregationMethod(field: LegacySalesFieldConfig): AggregationMethod {
  return getRecommendedAggregationMethod({
    type: field.type,
    category: field.category
  });
}

/**
 * Migrate a single legacy field configuration to new schema
 *
 * @param legacyField - Old field configuration
 * @returns Migrated field configuration
 *
 * @example
 * ```typescript
 * const oldField = {
 *   id: '1',
 *   key: 'revenue',
 *   label: '売上',
 *   category: 'sales',
 *   type: 'currency',
 *   unit: '円',
 *   isVisible: true,
 *   isEditable: true,
 *   isCalculated: false,
 *   order: 1
 * };
 *
 * const newField = migrateSingleField(oldField);
 * // Returns:
 * // {
 * //   ...oldField,
 * //   isVisibleInDailySales: true,
 * //   isVisibleInMonthlySales: true,
 * //   aggregationMethod: 'sum'
 * // }
 * ```
 */
export function migrateSingleField(
  legacyField: LegacySalesFieldConfig
): SalesFieldConfig {
  const isVisibleInMonthlySales = legacyField.isVisible && shouldShowInMonthlySales(legacyField);
  const aggregationMethod = determineAggregationMethod(legacyField);

  return {
    ...legacyField,
    isVisibleInDailySales: legacyField.isVisible,  // isVisible maps to daily sales visibility
    isVisibleInMonthlySales,
    aggregationMethod
  };
}

/**
 * Migrate multiple legacy field configurations to new schema
 *
 * @param legacyFields - Array of old field configurations
 * @returns Migration result with migrated fields and warnings
 *
 * @example
 * ```typescript
 * const oldFields = [
 *   { id: '1', key: 'date', type: 'text', category: 'basic', isVisible: true, ... },
 *   { id: '2', key: 'revenue', type: 'currency', category: 'sales', isVisible: true, ... }
 * ];
 *
 * const result = migrateFieldConfigurations(oldFields);
 * // result.migratedFields: [
 * //   { ...date field, isVisibleInDailySales: true, isVisibleInMonthlySales: false },
 * //   { ...revenue field, isVisibleInDailySales: true, isVisibleInMonthlySales: true }
 * // ]
 * // result.warnings: []
 * ```
 */
export function migrateFieldConfigurations(
  legacyFields: LegacySalesFieldConfig[]
): MigrationResult {
  const warnings: string[] = [];
  const migratedFields: SalesFieldConfig[] = [];

  for (const legacyField of legacyFields) {
    try {
      const migratedField = migrateSingleField(legacyField);
      migratedFields.push(migratedField);

      // Add warning if field visibility changed
      if (migratedField.isVisible && !migratedField.isVisibleInMonthlySales) {
        warnings.push(
          `Field "${legacyField.label}" (${legacyField.key}) is visible in daily sales but hidden in monthly sales`
        );
      }
    } catch (error) {
      warnings.push(
        `Failed to migrate field "${legacyField.label}" (${legacyField.key}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    migratedFields,
    warnings
  };
}

/**
 * Check if a field configuration needs migration
 *
 * @param field - Field configuration to check
 * @returns true if field is using old schema and needs migration
 */
export function needsMigration(field: any): field is LegacySalesFieldConfig {
  return (
    field &&
    'isVisible' in field &&
    !('isVisibleInDailySales' in field) &&
    !('isVisibleInMonthlySales' in field) &&
    !('aggregationMethod' in field)
  );
}

/**
 * Ensure backward compatibility by syncing isVisible with isVisibleInDailySales
 *
 * @param field - Field configuration
 * @returns Field with isVisible synced to isVisibleInDailySales
 *
 * @example
 * ```typescript
 * const field = {
 *   key: 'revenue',
 *   isVisible: false,  // Old value
 *   isVisibleInDailySales: true,  // New value
 *   isVisibleInMonthlySales: true,
 *   ...
 * };
 *
 * const synced = ensureBackwardCompatibility(field);
 * // synced.isVisible === true (synced with isVisibleInDailySales)
 * ```
 */
export function ensureBackwardCompatibility(
  field: SalesFieldConfig
): SalesFieldConfig {
  return {
    ...field,
    isVisible: field.isVisibleInDailySales  // Always sync isVisible to isVisibleInDailySales
  };
}

/**
 * Batch migrate and ensure backward compatibility for all fields
 *
 * @param fields - Array of field configurations (can be mixed legacy and new)
 * @returns Fully migrated and backward-compatible fields
 *
 * @example
 * ```typescript
 * const mixedFields = [
 *   { id: '1', key: 'date', isVisible: true },  // Legacy
 *   { id: '2', key: 'revenue', isVisible: true, isVisibleInDailySales: true, isVisibleInMonthlySales: true, aggregationMethod: 'sum' }  // New
 * ];
 *
 * const result = migrateAndEnsureCompatibility(mixedFields);
 * // All fields will be in new schema with backward compatibility
 * ```
 */
export function migrateAndEnsureCompatibility(
  fields: (LegacySalesFieldConfig | SalesFieldConfig)[]
): MigrationResult {
  const warnings: string[] = [];
  const migratedFields: SalesFieldConfig[] = [];

  for (const field of fields) {
    if (needsMigration(field)) {
      // Field needs migration
      try {
        const migrated = migrateSingleField(field);
        const compatible = ensureBackwardCompatibility(migrated);
        migratedFields.push(compatible);
      } catch (error) {
        warnings.push(
          `Failed to migrate field "${field.label}" (${field.key}): ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      // Field is already in new schema, just ensure backward compatibility
      const compatible = ensureBackwardCompatibility(field as SalesFieldConfig);
      migratedFields.push(compatible);
    }
  }

  return {
    migratedFields,
    warnings
  };
}

/**
 * Create migration report for logging or display
 *
 * @param result - Migration result
 * @returns Formatted migration report string
 */
export function createMigrationReport(result: MigrationResult): string {
  const lines: string[] = [
    '=== Field Configuration Migration Report ===',
    `Total fields migrated: ${result.migratedFields.length}`,
    ''
  ];

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    result.warnings.forEach((warning, index) => {
      lines.push(`  ${index + 1}. ${warning}`);
    });
    lines.push('');
  } else {
    lines.push('No warnings. Migration completed successfully.');
    lines.push('');
  }

  // Field visibility summary
  const dailyVisibleCount = result.migratedFields.filter(f => f.isVisibleInDailySales).length;
  const monthlyVisibleCount = result.migratedFields.filter(f => f.isVisibleInMonthlySales).length;
  const aggregatableCount = result.migratedFields.filter(f => f.aggregationMethod !== 'none').length;

  lines.push('Summary:');
  lines.push(`  - Fields visible in daily sales: ${dailyVisibleCount}`);
  lines.push(`  - Fields visible in monthly sales: ${monthlyVisibleCount}`);
  lines.push(`  - Fields with aggregation: ${aggregatableCount}`);
  lines.push('');

  // Aggregation method breakdown
  const aggregationCounts = result.migratedFields.reduce((acc, field) => {
    acc[field.aggregationMethod] = (acc[field.aggregationMethod] || 0) + 1;
    return acc;
  }, {} as Record<AggregationMethod, number>);

  lines.push('Aggregation Methods:');
  Object.entries(aggregationCounts).forEach(([method, count]) => {
    lines.push(`  - ${method}: ${count} fields`);
  });

  return lines.join('\n');
}
