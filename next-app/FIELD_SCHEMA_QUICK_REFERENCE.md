# Field Schema Quick Reference

## New Field Properties

```typescript
interface SalesFieldConfig {
  // ... existing properties ...

  isVisible: boolean;                 // ← Backward compat (= isVisibleInDailySales)
  isVisibleInDailySales: boolean;    // ← NEW: Show in daily page
  isVisibleInMonthlySales: boolean;  // ← NEW: Show in monthly page
  aggregationMethod: AggregationMethod; // ← NEW: 'sum' | 'average' | 'none'
}
```

## Common Operations

### Get fields for a page

```typescript
import { getVisibleFieldsForPage } from '@/utils/fieldAggregation';

const dailyFields = getVisibleFieldsForPage(fields, 'daily');
const monthlyFields = getVisibleFieldsForPage(fields, 'monthly');
```

### Aggregate daily data to monthly

```typescript
import { aggregateAllFields } from '@/utils/fieldAggregation';

const monthlySummary = aggregateAllFields(dailyData, fields);
// Returns: { revenue: 330000, cost: 95000, ... }
```

### Migrate old fields

```typescript
import { migrateAndEnsureCompatibility } from '@/utils/fieldConfigMigration';

const result = migrateAndEnsureCompatibility(oldFields);
const newFields = result.migratedFields;
```

## Aggregation Method Rules

| Field Type | Category | Recommended Method |
|-----------|----------|-------------------|
| text | basic | `'none'` |
| currency | sales, cost, profit | `'sum'` |
| currency | unit_price | `'average'` |
| count | customer | `'sum'` |
| number | labor | `'sum'` |
| percentage | any | `'average'` |

## Visibility Rules (Auto-Migration)

| Field Category/Type | Daily | Monthly |
|--------------------|-------|---------|
| basic (date, dayOfWeek) | ✓ | ✗ |
| text (any) | ✓ | ✗ |
| currency | ✓ | ✓ |
| count | ✓ | ✓ |
| number | ✓ | ✓ |
| percentage | ✓ | ✓ |

## Example Field Definitions

### Basic Field (Date)
```typescript
{
  key: 'date',
  type: 'text',
  category: 'basic',
  isVisibleInDailySales: true,
  isVisibleInMonthlySales: false,
  aggregationMethod: 'none'
}
```

### Sum Field (Revenue)
```typescript
{
  key: 'revenue',
  type: 'currency',
  category: 'sales',
  isVisibleInDailySales: true,
  isVisibleInMonthlySales: true,
  aggregationMethod: 'sum'
}
```

### Average Field (Unit Price)
```typescript
{
  key: 'customerUnitPrice',
  type: 'currency',
  category: 'unit_price',
  isVisibleInDailySales: true,
  isVisibleInMonthlySales: true,
  aggregationMethod: 'average'
}
```

## Files

- **Types**: `next-app/src/types/sales-field-config.ts`
- **Aggregation**: `next-app/src/utils/fieldAggregation.ts`
- **Migration**: `next-app/src/utils/fieldConfigMigration.ts`
- **Tests**: `next-app/src/utils/__tests__/fieldAggregation.test.ts`
- **Examples**: `next-app/src/utils/__examples__/fieldMigrationExample.ts`
- **Full Docs**: `next-app/FIELD_SCHEMA_DOCUMENTATION.md`
