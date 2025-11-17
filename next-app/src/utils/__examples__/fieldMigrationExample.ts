/**
 * Field Configuration Migration Examples
 *
 * This file demonstrates how to use the migration utilities to upgrade
 * from old field configurations to the new unified schema.
 */

import {
  migrateSingleField,
  migrateFieldConfigurations,
  needsMigration,
  ensureBackwardCompatibility,
  migrateAndEnsureCompatibility,
  createMigrationReport,
  type LegacySalesFieldConfig
} from '../fieldConfigMigration';
import type { SalesFieldConfig } from '@/types/sales-field-config';

// ============================================================================
// Example 1: Migrating a Single Field
// ============================================================================

export function example1_MigrateSingleField() {
  console.log('=== Example 1: Migrate Single Field ===\n');

  // Old field configuration (before migration)
  const legacyField: LegacySalesFieldConfig = {
    id: '1',
    key: 'revenue',
    label: '売上',
    category: 'sales',
    type: 'currency',
    unit: '円',
    isVisible: true,  // Only one visibility flag
    isEditable: true,
    isCalculated: false,
    order: 1
  };

  console.log('Old field:', legacyField);

  // Migrate to new schema
  const newField = migrateSingleField(legacyField);

  console.log('\nNew field:', newField);
  console.log('\nChanges:');
  console.log(`  - isVisibleInDailySales: ${newField.isVisibleInDailySales} (from isVisible)`);
  console.log(`  - isVisibleInMonthlySales: ${newField.isVisibleInMonthlySales} (auto-determined)`);
  console.log(`  - aggregationMethod: ${newField.aggregationMethod} (auto-determined)`);

  return newField;
}

// ============================================================================
// Example 2: Migrating Multiple Fields
// ============================================================================

export function example2_MigrateMultipleFields() {
  console.log('\n=== Example 2: Migrate Multiple Fields ===\n');

  const legacyFields: LegacySalesFieldConfig[] = [
    {
      id: '1',
      key: 'date',
      label: '日付',
      category: 'basic',
      type: 'text',
      isVisible: true,
      isEditable: false,
      isCalculated: false,
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
      isEditable: true,
      isCalculated: false,
      order: 2
    },
    {
      id: '3',
      key: 'customerCount',
      label: '客数',
      category: 'customer',
      type: 'count',
      unit: '人',
      isVisible: true,
      isEditable: true,
      isCalculated: false,
      order: 3
    },
    {
      id: '4',
      key: 'customerUnitPrice',
      label: '客単価',
      category: 'unit_price',
      type: 'currency',
      unit: '円',
      isVisible: true,
      isEditable: false,
      isCalculated: true,
      order: 4
    }
  ];

  console.log(`Migrating ${legacyFields.length} fields...`);

  const result = migrateFieldConfigurations(legacyFields);

  console.log('\nMigration Report:');
  console.log(createMigrationReport(result));

  console.log('\nDetailed Results:');
  result.migratedFields.forEach(field => {
    console.log(`\n${field.label} (${field.key}):`);
    console.log(`  - Daily visible: ${field.isVisibleInDailySales}`);
    console.log(`  - Monthly visible: ${field.isVisibleInMonthlySales}`);
    console.log(`  - Aggregation: ${field.aggregationMethod}`);
  });

  return result;
}

// ============================================================================
// Example 3: Checking if Migration is Needed
// ============================================================================

export function example3_CheckMigrationNeeded() {
  console.log('\n=== Example 3: Check if Migration is Needed ===\n');

  const legacyField: any = {
    id: '1',
    key: 'revenue',
    isVisible: true,
    // Missing: isVisibleInDailySales, isVisibleInMonthlySales, aggregationMethod
  };

  const newField: any = {
    id: '2',
    key: 'cost',
    isVisible: true,
    isVisibleInDailySales: true,
    isVisibleInMonthlySales: true,
    aggregationMethod: 'sum'
  };

  console.log('Legacy field needs migration:', needsMigration(legacyField));
  console.log('New field needs migration:', needsMigration(newField));

  return {
    legacyNeedsMigration: needsMigration(legacyField),
    newNeedsMigration: needsMigration(newField)
  };
}

// ============================================================================
// Example 4: Ensuring Backward Compatibility
// ============================================================================

export function example4_EnsureBackwardCompatibility() {
  console.log('\n=== Example 4: Ensure Backward Compatibility ===\n');

  // Field where isVisible is out of sync
  const field: SalesFieldConfig = {
    id: '1',
    key: 'revenue',
    label: '売上',
    category: 'sales',
    type: 'currency',
    unit: '円',
    isVisible: false,  // OLD value
    isVisibleInDailySales: true,  // NEW value (should take precedence)
    isVisibleInMonthlySales: true,
    isEditable: true,
    isCalculated: false,
    aggregationMethod: 'sum',
    order: 1
  };

  console.log('Before sync:');
  console.log(`  - isVisible: ${field.isVisible}`);
  console.log(`  - isVisibleInDailySales: ${field.isVisibleInDailySales}`);

  const synced = ensureBackwardCompatibility(field);

  console.log('\nAfter sync:');
  console.log(`  - isVisible: ${synced.isVisible} (synced to isVisibleInDailySales)`);
  console.log(`  - isVisibleInDailySales: ${synced.isVisibleInDailySales}`);

  return synced;
}

// ============================================================================
// Example 5: Batch Migration with Mixed Fields
// ============================================================================

export function example5_BatchMigrationWithMixedFields() {
  console.log('\n=== Example 5: Batch Migration with Mixed Fields ===\n');

  // Mix of legacy and new fields
  const mixedFields: (LegacySalesFieldConfig | SalesFieldConfig)[] = [
    // Legacy field
    {
      id: '1',
      key: 'revenue',
      label: '売上',
      category: 'sales',
      type: 'currency',
      unit: '円',
      isVisible: true,
      isEditable: true,
      isCalculated: false,
      order: 1
    } as LegacySalesFieldConfig,

    // Already migrated field
    {
      id: '2',
      key: 'cost',
      label: '原価',
      category: 'cost',
      type: 'currency',
      unit: '円',
      isVisible: true,
      isVisibleInDailySales: true,
      isVisibleInMonthlySales: true,
      isEditable: true,
      isCalculated: false,
      aggregationMethod: 'sum',
      order: 2
    } as SalesFieldConfig,

    // Another legacy field
    {
      id: '3',
      key: 'date',
      label: '日付',
      category: 'basic',
      type: 'text',
      isVisible: true,
      isEditable: false,
      isCalculated: false,
      order: 3
    } as LegacySalesFieldConfig
  ];

  console.log(`Processing ${mixedFields.length} fields (mixed legacy and new)...`);

  const result = migrateAndEnsureCompatibility(mixedFields);

  console.log('\n' + createMigrationReport(result));

  return result;
}

// ============================================================================
// Example 6: Real-World Usage in a Component
// ============================================================================

export function example6_RealWorldUsage() {
  console.log('\n=== Example 6: Real-World Usage Pattern ===\n');

  // Simulating loading field config from localStorage or API
  const loadedFields: any[] = [
    { id: '1', key: 'revenue', isVisible: true, category: 'sales', type: 'currency', unit: '円', isEditable: true, isCalculated: false, order: 1, label: '売上' },
    { id: '2', key: 'cost', isVisible: true, category: 'cost', type: 'currency', unit: '円', isEditable: true, isCalculated: false, order: 2, label: '原価' }
  ];

  console.log('Step 1: Load fields from storage');
  console.log('Fields loaded:', loadedFields.length);

  console.log('\nStep 2: Check if migration is needed');
  const needMigration = loadedFields.some(f => needsMigration(f));
  console.log('Migration needed:', needMigration);

  console.log('\nStep 3: Migrate if needed');
  let fields: SalesFieldConfig[];

  if (needMigration) {
    console.log('Performing migration...');
    const result = migrateAndEnsureCompatibility(loadedFields);

    if (result.warnings.length > 0) {
      console.log('\nMigration warnings:');
      result.warnings.forEach(w => console.log(`  - ${w}`));
    }

    fields = result.migratedFields;
    console.log(`\nMigration complete: ${fields.length} fields ready`);
  } else {
    console.log('No migration needed, ensuring backward compatibility...');
    fields = loadedFields.map(ensureBackwardCompatibility);
  }

  console.log('\nStep 4: Use migrated fields');
  console.log('Daily visible fields:', fields.filter(f => f.isVisibleInDailySales).length);
  console.log('Monthly visible fields:', fields.filter(f => f.isVisibleInMonthlySales).length);
  console.log('Aggregatable fields:', fields.filter(f => f.aggregationMethod !== 'none').length);

  return fields;
}

// ============================================================================
// Example 7: Generate Migration Report
// ============================================================================

export function example7_GenerateMigrationReport() {
  console.log('\n=== Example 7: Generate Migration Report ===\n');

  const legacyFields: LegacySalesFieldConfig[] = [
    { id: '1', key: 'date', label: '日付', category: 'basic', type: 'text', isVisible: true, isEditable: false, isCalculated: false, order: 1 },
    { id: '2', key: 'revenue', label: '売上', category: 'sales', type: 'currency', unit: '円', isVisible: true, isEditable: true, isCalculated: false, order: 2 },
    { id: '3', key: 'cost', label: '原価', category: 'cost', type: 'currency', unit: '円', isVisible: true, isEditable: true, isCalculated: false, order: 3 },
    { id: '4', key: 'customerCount', label: '客数', category: 'customer', type: 'count', unit: '人', isVisible: true, isEditable: true, isCalculated: false, order: 4 },
    { id: '5', key: 'customerUnitPrice', label: '客単価', category: 'unit_price', type: 'currency', unit: '円', isVisible: true, isEditable: false, isCalculated: true, order: 5 },
  ];

  const result = migrateFieldConfigurations(legacyFields);
  const report = createMigrationReport(result);

  console.log(report);

  return report;
}

// ============================================================================
// Run all examples
// ============================================================================

export function runAllExamples() {
  example1_MigrateSingleField();
  example2_MigrateMultipleFields();
  example3_CheckMigrationNeeded();
  example4_EnsureBackwardCompatibility();
  example5_BatchMigrationWithMixedFields();
  example6_RealWorldUsage();
  example7_GenerateMigrationReport();
}

// Uncomment to run examples:
// runAllExamples();
