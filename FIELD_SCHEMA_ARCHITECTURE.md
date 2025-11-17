# Unified Field Schema Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Unified Field Schema System                 │
└─────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
          ┌──────▼──────┐          ┌──────▼──────┐
          │  Daily Page │          │Monthly Page │
          │  売上管理   │          │月次売上管理  │
          └──────┬──────┘          └──────┬──────┘
                 │                         │
        ┌────────┴────────┐       ┌────────┴────────┐
        │ Visible Fields  │       │ Visible Fields  │
        │ (isVisibleIn    │       │ (isVisibleIn    │
        │  DailySales)    │       │  MonthlySales)  │
        └────────┬────────┘       └────────┬────────┘
                 │                         │
                 │                 ┌───────▼────────┐
                 │                 │  Aggregation   │
                 │                 │  (sum/average) │
                 │                 └───────┬────────┘
                 │                         │
                 └────────────┬────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ SalesFieldConfig  │
                    │  (Single Source   │
                    │   of Truth)       │
                    └───────────────────┘
```

## Data Flow

### Daily to Monthly Aggregation

```
Daily Sales Data                Monthly Summary
┌─────────────┐                ┌──────────────┐
│ 2024-01-01  │                │              │
│ revenue: 10K│ ──┐            │              │
└─────────────┘   │            │              │
                  │            │              │
┌─────────────┐   │            │              │
│ 2024-01-02  │   │    SUM     │  January     │
│ revenue: 12K│ ──┼───────────▶│  revenue:    │
└─────────────┘   │            │  610K        │
                  │            │              │
┌─────────────┐   │            │              │
│    ...      │ ──┘            │              │
└─────────────┘                └──────────────┘

Daily Unit Prices              Monthly Average
┌─────────────┐                ┌──────────────┐
│ 2024-01-01  │                │              │
│ unitPrice:  │ ──┐            │              │
│ 2000        │   │            │              │
└─────────────┘   │            │              │
                  │  AVERAGE   │  January     │
┌─────────────┐   │            │  avgPrice:   │
│ 2024-01-02  │   ┼───────────▶│  2220        │
│ unitPrice:  │   │            │              │
│ 2200        │   │            │              │
└─────────────┘   │            └──────────────┘
┌─────────────┐   │
│    ...      │ ──┘
└─────────────┘
```

## Field Configuration Structure

```
┌──────────────────────────────────────────────────────┐
│              SalesFieldConfig                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Basic Properties                            │   │
│  │  - id: string                               │   │
│  │  - key: string                              │   │
│  │  - label: string                            │   │
│  │  - category: SalesFieldCategory             │   │
│  │  - type: SalesFieldType                     │   │
│  │  - unit?: string                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Visibility Control (NEW)                    │   │
│  │  - isVisible: boolean (backward compat)     │   │
│  │  - isVisibleInDailySales: boolean          │◀──┼── Daily Page Filter
│  │  - isVisibleInMonthlySales: boolean        │◀──┼── Monthly Page Filter
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Edit & Calculation                          │   │
│  │  - isEditable: boolean                      │   │
│  │  - isCalculated: boolean                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Aggregation (NEW)                           │   │
│  │  - aggregationMethod: AggregationMethod     │◀──┼── Determines how to
│  │    • 'sum'                                  │   │   aggregate to monthly
│  │    • 'average'                              │   │
│  │    • 'none'                                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Display Order                               │   │
│  │  - order: number                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Field Lifecycle

```
┌──────────────┐
│ Define Field │
│   (Once)     │
└──────┬───────┘
       │
       ▼
┌──────────────┐       ┌─────────────────┐
│ Storage      │◀─────▶│ Migration Check │
│ (Database/   │       │ needsMigration()│
│  Local)      │       └────────┬────────┘
└──────┬───────┘                │
       │                        ▼
       │                ┌───────────────┐
       │                │ Auto-migrate  │
       │                │ if needed     │
       │                └───────┬───────┘
       │                        │
       ▼                        ▼
┌──────────────────────────────────┐
│ Application Runtime              │
├──────────────────────────────────┤
│                                  │
│  Daily Page              Monthly Page
│  ┌──────────┐           ┌──────────┐
│  │ Filter   │           │ Filter   │
│  │ Fields   │           │ Fields   │
│  └────┬─────┘           └────┬─────┘
│       │                      │
│       ▼                      ▼
│  ┌──────────┐           ┌──────────┐
│  │ Display  │           │Aggregate │
│  │ Daily    │           │& Display │
│  │ Data     │           │ Monthly  │
│  └──────────┘           └──────────┘
│                                  │
└──────────────────────────────────┘
```

## Component Integration

```
┌────────────────────────────────────────────────────────┐
│         Sales Management System                        │
└────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Daily     │  │  Monthly    │  │   Field     │
│   Sales     │  │   Sales     │  │   Config    │
│   Table     │  │   Summary   │  │   Editor    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       │                │                │
       ▼                ▼                ▼
┌─────────────────────────────────────────────────┐
│      getVisibleFieldsForPage(fields, page)      │
├─────────────────────────────────────────────────┤
│  • Filters fields by page visibility            │
│  • Returns sorted by order                      │
│  • Used by all display components               │
└─────────────────────────────────────────────────┘
       │                │                │
       │                ▼                │
       │    ┌───────────────────┐       │
       │    │ aggregateAllFields│       │
       │    │  (dailyData)      │       │
       │    └───────────────────┘       │
       │                                 │
       └─────────────┬───────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  SalesFieldConfig[]   │
         │  (from store/DB)      │
         └───────────────────────┘
```

## Aggregation Logic Flow

```
Daily Data Array            Field Config            Result
───────────────────        ─────────────────       ────────
[                          {
  { revenue: 100000 },       key: 'revenue',        610000
  { revenue: 120000 },       aggregationMethod:       ▲
  { revenue: 110000 },       'sum'                    │
  { revenue: 130000 },     }                          │
  { revenue: 150000 }                                 │
]                           ─────────────────        │
                                   │                 │
                                   │                 │
                         aggregateDailyToMonthly()───┘
                                   │
                          ┌────────▼─────────┐
                          │ 1. Filter nulls  │
                          │ 2. Convert to #  │
                          │ 3. Apply method  │
                          │    • sum: Σ      │
                          │    • avg: Σ/n    │
                          │    • none: null  │
                          └──────────────────┘
```

## Migration Process

```
Old Schema                              New Schema
─────────────                          ─────────────
{                                      {
  id: '1',                               id: '1',
  key: 'revenue',                        key: 'revenue',
  isVisible: true,   ──────┐            isVisible: true,
}                          │            isVisibleInDailySales: true, ◀─┐
                           │            isVisibleInMonthlySales: true,  │
                           │            aggregationMethod: 'sum'        │
                           │                                            │
                           └─────────── Migration Logic ────────────────┘

                                        Rules:
                                        ─────
                                        1. isVisible → isVisibleInDailySales
                                        2. Auto-determine monthly visibility:
                                           • text/basic → false
                                           • numeric → true
                                        3. Auto-determine aggregation:
                                           • text → 'none'
                                           • currency/count → 'sum'
                                           • percentage → 'average'
```

## File Organization

```
next-app/
├── src/
│   ├── types/
│   │   └── sales-field-config.ts ◀──────── Type Definitions
│   │
│   ├── utils/
│   │   ├── fieldAggregation.ts ◀─────────── Aggregation Utilities
│   │   ├── fieldConfigMigration.ts ◀────── Migration Utilities
│   │   │
│   │   ├── __tests__/
│   │   │   └── fieldAggregation.test.ts ◀─ Unit Tests
│   │   │
│   │   └── __examples__/
│   │       └── fieldMigrationExample.ts ◀── Usage Examples
│   │
│   ├── components/
│   │   └── sales/
│   │       ├── DynamicSalesTable.tsx ◀───── Daily View
│   │       ├── DynamicSalesForm.tsx ◀────── Data Entry
│   │       └── SalesFieldConfiguration.tsx ◀ Config UI
│   │
│   └── app/
│       └── admin/
│           └── sales-management/
│               └── page.tsx ◀──────────────── Main Page
│
├── FIELD_SCHEMA_DOCUMENTATION.md ◀────────── Full Docs
├── FIELD_SCHEMA_QUICK_REFERENCE.md ◀──────── Quick Ref
└── UNIFIED_FIELD_SCHEMA_SUMMARY.md ◀──────── Summary

Root:
└── FIELD_SCHEMA_ARCHITECTURE.md ◀─────────── This File
```

## API Surface

```
┌──────────────────────────────────────────────────────┐
│         Field Aggregation API                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  aggregateDailyToMonthly(data, field) → number|null │
│  getVisibleFieldsForPage(fields, page) → Field[]    │
│  getAggregatableFields(fields) → Field[]            │
│  aggregateAllFields(data, fields) → Record          │
│  isValidAggregationMethod(field) → boolean          │
│  getRecommendedAggregationMethod(field) → Method    │
│                                                      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│         Migration API                                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│  needsMigration(field) → boolean                    │
│  migrateSingleField(field) → SalesFieldConfig       │
│  migrateFieldConfigurations(fields) → MigrationResult
│  ensureBackwardCompatibility(field) → Field         │
│  migrateAndEnsureCompatibility(fields) → Result     │
│  createMigrationReport(result) → string             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Type Hierarchy

```
AggregationMethod = 'sum' | 'average' | 'none'
         │
         │
SalesFieldCategory
 ├─ 'basic'
 ├─ 'sales'
 ├─ 'cost'
 ├─ 'profit'
 ├─ 'customer'
 ├─ 'unit_price'
 ├─ 'labor'
 ├─ 'productivity'
 └─ 'other'

SalesFieldType
 ├─ 'text'
 ├─ 'number'
 ├─ 'currency'
 ├─ 'percentage'
 └─ 'count'

SalesFieldConfig
 ├─ id: string
 ├─ key: string
 ├─ label: string
 ├─ category: SalesFieldCategory
 ├─ type: SalesFieldType
 ├─ unit?: string
 ├─ isVisible: boolean
 ├─ isVisibleInDailySales: boolean
 ├─ isVisibleInMonthlySales: boolean
 ├─ isEditable: boolean
 ├─ isCalculated: boolean
 ├─ aggregationMethod: AggregationMethod
 └─ order: number

BusinessTypeSalesConfig
 ├─ businessTypeId: string
 ├─ businessTypeName: string
 └─ fields: SalesFieldConfig[]
```

## Summary

This architecture provides:
- ✓ Single source of truth for field definitions
- ✓ Flexible per-page visibility control
- ✓ Automatic data aggregation
- ✓ Type-safe implementation
- ✓ Backward compatibility
- ✓ Easy migration path
- ✓ Comprehensive utilities
- ✓ Clear separation of concerns
