# Unified Field Schema Documentation

This document describes the unified field schema system that links daily sales fields with monthly sales fields, enabling flexible per-page visibility control and automatic data aggregation.

## Table of Contents

1. [Overview](#overview)
2. [Type Definitions](#type-definitions)
3. [Key Features](#key-features)
4. [Usage Examples](#usage-examples)
5. [Migration Guide](#migration-guide)
6. [API Reference](#api-reference)
7. [Best Practices](#best-practices)

---

## Overview

### Problem Statement

Previously, sales fields were defined separately for daily and monthly views, leading to:
- Code duplication
- Inconsistency between views
- Manual synchronization required
- No clear relationship between daily and monthly data

### Solution

The unified field schema provides:
- **Single source of truth**: Define each field once
- **Per-page visibility**: Control which page shows each field
- **Automatic aggregation**: Monthly data calculated from daily data
- **Backward compatibility**: Existing code continues to work

---

## Type Definitions

### SalesFieldConfig Interface

```typescript
export interface SalesFieldConfig {
  id: string;
  key: string;
  label: string;
  category: SalesFieldCategory;
  type: SalesFieldType;
  unit?: string;

  // Visibility flags
  isVisible: boolean;                    // Backward compatibility (synced with isVisibleInDailySales)
  isVisibleInDailySales: boolean;       // Show in daily sales page
  isVisibleInMonthlySales: boolean;     // Show in monthly sales page

  // Edit and calculation flags
  isEditable: boolean;
  isCalculated: boolean;

  // Aggregation
  aggregationMethod: AggregationMethod;  // How to aggregate to monthly

  order: number;
}
```

### AggregationMethod Type

```typescript
export type AggregationMethod = 'sum' | 'average' | 'none';
```

- **sum**: Add all daily values (e.g., revenue, cost)
- **average**: Calculate mean of daily values (e.g., customer unit price)
- **none**: Don't aggregate (e.g., date, text fields)

---

## Key Features

### 1. Unified Field Definition

Define fields once, use everywhere:

```typescript
const revenueField: SalesFieldConfig = {
  id: '1',
  key: 'revenue',
  label: '売上',
  category: 'sales',
  type: 'currency',
  unit: '円',
  isVisible: true,
  isVisibleInDailySales: true,      // Show in daily page
  isVisibleInMonthlySales: true,    // Show in monthly page
  isEditable: true,
  isCalculated: false,
  aggregationMethod: 'sum',          // Sum daily revenues
  order: 1
};
```

### 2. Per-Page Visibility Control

Control visibility independently for each page:

```typescript
// Date field: Only in daily view
const dateField: SalesFieldConfig = {
  key: 'date',
  label: '日付',
  isVisibleInDailySales: true,     // ✓ Show
  isVisibleInMonthlySales: false,  // ✗ Hide
  aggregationMethod: 'none',
  // ...
};

// Revenue field: Both views
const revenueField: SalesFieldConfig = {
  key: 'revenue',
  label: '売上',
  isVisibleInDailySales: true,     // ✓ Show
  isVisibleInMonthlySales: true,   // ✓ Show
  aggregationMethod: 'sum',
  // ...
};
```

### 3. Automatic Data Aggregation

Monthly data calculated automatically from daily data:

```typescript
import { aggregateDailyToMonthly } from '@/utils/fieldAggregation';

// Daily data
const dailyData = [
  { revenue: 100000, customerUnitPrice: 2000 },
  { revenue: 120000, customerUnitPrice: 2200 },
  { revenue: 110000, customerUnitPrice: 2100 }
];

// Aggregate revenue (sum)
const revenueField = { key: 'revenue', aggregationMethod: 'sum' };
const totalRevenue = aggregateDailyToMonthly(dailyData, revenueField);
// Result: 330000

// Aggregate customer unit price (average)
const unitPriceField = { key: 'customerUnitPrice', aggregationMethod: 'average' };
const avgUnitPrice = aggregateDailyToMonthly(dailyData, unitPriceField);
// Result: 2100
```

### 4. Backward Compatibility

Existing `isVisible` field maintained for compatibility:

```typescript
// Old code continues to work
if (field.isVisible) {
  // Show field
}

// isVisible is always synced with isVisibleInDailySales
field.isVisible === field.isVisibleInDailySales  // Always true
```

---

## Usage Examples

### Get Visible Fields for Daily Page

```typescript
import { getVisibleFieldsForPage } from '@/utils/fieldAggregation';

const dailyFields = getVisibleFieldsForPage(allFields, 'daily');
// Returns: Fields where isVisibleInDailySales = true
```

### Get Visible Fields for Monthly Page

```typescript
const monthlyFields = getVisibleFieldsForPage(allFields, 'monthly');
// Returns: Fields where isVisibleInMonthlySales = true
```

### Aggregate All Fields

```typescript
import { aggregateAllFields } from '@/utils/fieldAggregation';

const monthlySummary = aggregateAllFields(dailyDataArray, fields);
// Returns: { revenue: 330000, cost: 95000, customerUnitPrice: 2100, ... }
```

### Get Recommended Aggregation Method

```typescript
import { getRecommendedAggregationMethod } from '@/utils/fieldAggregation';

const recommendation = getRecommendedAggregationMethod({
  type: 'currency',
  category: 'sales'
});
// Returns: 'sum'

const recommendation2 = getRecommendedAggregationMethod({
  type: 'percentage',
  category: 'labor'
});
// Returns: 'average'
```

---

## Migration Guide

### Migrating from Old Schema

If you have existing field configurations with only `isVisible`, use the migration utilities:

```typescript
import { migrateAndEnsureCompatibility } from '@/utils/fieldConfigMigration';

// Old fields (only isVisible)
const oldFields = [
  { id: '1', key: 'revenue', isVisible: true, /* ... */ }
];

// Migrate to new schema
const result = migrateAndEnsureCompatibility(oldFields);

// Use migrated fields
const newFields = result.migratedFields;

// Check for warnings
if (result.warnings.length > 0) {
  console.warn('Migration warnings:', result.warnings);
}
```

### Migration Rules

The migration automatically applies these rules:

1. **isVisible → isVisibleInDailySales**
   - Always mapped 1:1

2. **isVisibleInMonthlySales**
   - `false` for basic fields (date, dayOfWeek)
   - `false` for text fields
   - `true` for numeric fields (currency, count, number, percentage)

3. **aggregationMethod**
   - `'none'` for text and basic fields
   - `'sum'` for currency, number, count
   - `'average'` for percentage and unit_price category

### Check if Migration Needed

```typescript
import { needsMigration } from '@/utils/fieldConfigMigration';

if (needsMigration(field)) {
  // Field is in old schema, migrate it
  const migrated = migrateSingleField(field);
}
```

---

## API Reference

### Field Aggregation Utilities

Located in: `next-app/src/utils/fieldAggregation.ts`

#### aggregateDailyToMonthly

```typescript
function aggregateDailyToMonthly(
  dailyData: Record<string, any>[],
  field: SalesFieldConfig
): number | null
```

Calculate monthly aggregated value from daily data.

#### getVisibleFieldsForPage

```typescript
function getVisibleFieldsForPage(
  fields: SalesFieldConfig[],
  page: 'daily' | 'monthly'
): SalesFieldConfig[]
```

Get all fields visible for a specific page, sorted by order.

#### getAggregatableFields

```typescript
function getAggregatableFields(
  fields: SalesFieldConfig[]
): SalesFieldConfig[]
```

Get fields that should be aggregated (visible in monthly + aggregation method ≠ 'none').

#### aggregateAllFields

```typescript
function aggregateAllFields(
  dailyData: Record<string, any>[],
  fields: SalesFieldConfig[]
): Record<string, number | null>
```

Aggregate all applicable fields from daily data.

#### isValidAggregationMethod

```typescript
function isValidAggregationMethod(
  field: SalesFieldConfig
): boolean
```

Check if field's aggregation method is compatible with its type.

#### getRecommendedAggregationMethod

```typescript
function getRecommendedAggregationMethod(
  field: Pick<SalesFieldConfig, 'type' | 'category'>
): AggregationMethod
```

Get recommended aggregation method based on field type/category.

### Migration Utilities

Located in: `next-app/src/utils/fieldConfigMigration.ts`

#### migrateSingleField

```typescript
function migrateSingleField(
  legacyField: LegacySalesFieldConfig
): SalesFieldConfig
```

Migrate a single legacy field to new schema.

#### migrateFieldConfigurations

```typescript
function migrateFieldConfigurations(
  legacyFields: LegacySalesFieldConfig[]
): MigrationResult
```

Migrate multiple legacy fields with warnings.

#### needsMigration

```typescript
function needsMigration(
  field: any
): field is LegacySalesFieldConfig
```

Check if field needs migration.

#### ensureBackwardCompatibility

```typescript
function ensureBackwardCompatibility(
  field: SalesFieldConfig
): SalesFieldConfig
```

Sync `isVisible` with `isVisibleInDailySales` for backward compatibility.

#### migrateAndEnsureCompatibility

```typescript
function migrateAndEnsureCompatibility(
  fields: (LegacySalesFieldConfig | SalesFieldConfig)[]
): MigrationResult
```

Batch migrate and ensure backward compatibility.

#### createMigrationReport

```typescript
function createMigrationReport(
  result: MigrationResult
): string
```

Generate formatted migration report.

---

## Best Practices

### 1. Field Configuration

```typescript
// ✓ GOOD: Consistent with field type
{
  key: 'revenue',
  type: 'currency',
  aggregationMethod: 'sum'  // Currency → sum
}

// ✗ BAD: Text field with aggregation
{
  key: 'date',
  type: 'text',
  aggregationMethod: 'sum'  // Doesn't make sense
}
```

### 2. Visibility Settings

```typescript
// ✓ GOOD: Basic fields hidden in monthly view
{
  key: 'date',
  category: 'basic',
  isVisibleInDailySales: true,
  isVisibleInMonthlySales: false  // Dates don't make sense monthly
}

// ✓ GOOD: Numeric fields visible in both views
{
  key: 'revenue',
  type: 'currency',
  isVisibleInDailySales: true,
  isVisibleInMonthlySales: true  // Aggregate to monthly
}
```

### 3. Aggregation Methods

| Field Type | Recommended Method | Example |
|------------|-------------------|---------|
| currency (sales, cost) | `sum` | 売上, 原価 |
| count | `sum` | 客数, 組数 |
| number (hours) | `sum` | 社員時間 |
| percentage | `average` | 人件費率 |
| unit_price | `average` | 客単価 |
| text | `none` | 日付, 曜日 |

### 4. Migration Strategy

```typescript
// 1. Load fields
const loadedFields = await loadFieldsFromStorage();

// 2. Check if migration needed
if (loadedFields.some(needsMigration)) {
  // 3. Migrate
  const result = migrateAndEnsureCompatibility(loadedFields);

  // 4. Log warnings
  if (result.warnings.length > 0) {
    console.warn('Migration warnings:', result.warnings);
  }

  // 5. Save migrated fields
  await saveFieldsToStorage(result.migratedFields);

  // 6. Use migrated fields
  setFields(result.migratedFields);
} else {
  // Already migrated, ensure compatibility
  setFields(loadedFields.map(ensureBackwardCompatibility));
}
```

### 5. Testing

Always test aggregation logic with edge cases:

```typescript
// Test with null/undefined values
const dataWithNulls = [
  { revenue: 100000 },
  { revenue: null },
  { revenue: undefined },
  { revenue: 200000 }
];

const total = aggregateDailyToMonthly(dataWithNulls, revenueField);
// Should return: 300000 (ignores null/undefined)

// Test with empty data
const emptyData = [];
const result = aggregateDailyToMonthly(emptyData, revenueField);
// Should return: null
```

---

## File Structure

```
next-app/src/
├── types/
│   └── sales-field-config.ts          # Type definitions
├── utils/
│   ├── fieldAggregation.ts            # Aggregation utilities
│   ├── fieldConfigMigration.ts        # Migration utilities
│   ├── __tests__/
│   │   └── fieldAggregation.test.ts   # Unit tests
│   └── __examples__/
│       └── fieldMigrationExample.ts   # Usage examples
└── components/
    └── sales/
        ├── DynamicSalesTable.tsx       # Uses getVisibleFieldsForPage
        └── DynamicSalesForm.tsx        # Uses field configs
```

---

## Changelog

### v1.0.0 (2024-11-16)

Initial implementation:
- Added `isVisibleInDailySales` and `isVisibleInMonthlySales` fields
- Added `aggregationMethod` field
- Created aggregation utilities
- Created migration utilities
- Maintained backward compatibility with `isVisible`
- Updated DEFAULT_SALES_FIELDS and EDW_SALES_FIELD_CONFIG

---

## Support

For questions or issues:
1. Check the examples in `__examples__/fieldMigrationExample.ts`
2. Review unit tests in `__tests__/fieldAggregation.test.ts`
3. Refer to this documentation
4. Consult the API reference section above
