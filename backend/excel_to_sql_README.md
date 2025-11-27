# Excel to SQL Converter

## Overview

This script converts Excel sales data from the management spreadsheet into SQL INSERT statements that can be executed directly against the PostgreSQL database.

## Files

- `excel_to_sql.js` - Main conversion script
- `import_sales.sql` - Generated SQL output file (auto-generated)

## Source Data

**Excel File:** `C:\job\project\計数管理表2024【EDW富山】.xlsx`

**Sheets Processed:**
- 23年度 (FY2023: June 2023 - May 2024)
- 24年度 (FY2024: June 2024 - May 2025)

## Column Mapping

### 23年度 Sheet
| Column | Field Name | Description |
|--------|------------|-------------|
| 0 | date | Date (Excel serial number) |
| 6 | netSales | Net sales (純売上) |
| 8 | edwNetSales | EDW net sales (EDW純売上) |
| 10 | ohbNetSales | OHB net sales (OHB純売上) |
| 12 | totalGroups | Total groups (組数) |
| 13 | totalCustomers | Total customers (客数) |
| 23 | laborCost | Labor cost (人件費額) |

### 24年度 Sheet
| Column | Field Name | Description |
|--------|------------|-------------|
| 0 | date | Date (Excel serial number) |
| 9 | netSales | Store net sales (店舗純売上) |
| 11 | edwNetSales | EDW net sales (EDW純売上) |
| 13 | ohbNetSales | OHB net sales (OHB純売上) |
| 15 | totalGroups | Total groups (組数) |
| 16 | totalCustomers | Total customers (客数) |
| 26 | laborCost | Labor cost (人件費額) |

## Usage

### Step 1: Generate SQL File

```bash
cd C:\job\project\backend
node excel_to_sql.js
```

**Expected Output:**
```
=== Excel to SQL 変換開始 ===
ファイル読み込み: C:\job\project\計数管理表2024【EDW富山】.xlsx
シート "23年度" を読み込みました
  総行数: 1000
  処理した行数: 366
シート "24年度" を読み込みました
  総行数: 1000
  処理した行数: 364

月別データ集計完了:
  2023-06 (2023年度): 30日分
  2023-07 (2023年度): 31日分
  ...
  2025-05 (2024年度): 31日分

=== SQL生成完了 ===
出力ファイル: C:\job\project\backend\import_sales.sql
総月数: 24
総SQLステートメント数: 121
ファイルサイズ: 240.02 KB
```

### Step 2: Execute SQL File

```bash
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f import_sales.sql
```

**Alternative (if psql is not in PATH):**
```bash
docker exec -i management-db psql -U postgres -d shift_management < import_sales.sql
```

## Generated SQL Structure

The script generates SQL statements for two tables:

### 1. sales_data Table
```sql
INSERT INTO sales_data (store_id, year, month, daily_data, created_at, updated_at)
VALUES (1, 2023, 6, '{"1":{...}, "2":{...}, ...}'::jsonb, NOW(), NOW())
ON CONFLICT (store_id, year, month)
DO UPDATE SET daily_data = EXCLUDED.daily_data, updated_at = NOW();
```

### 2. monthly_sales Table
Same structure as sales_data - maintains data synchronization.

## Data Format

Daily data is stored as JSONB with the following structure:

```json
{
  "1": {
    "date": "2023-06-01",
    "dayOfWeek": "木",
    "netSales": 594263,
    "edwNetSales": 376442,
    "ohbNetSales": 217821,
    "totalGroups": 227,
    "totalCustomers": 330,
    "laborCost": 102588
  },
  "2": { ... },
  ...
}
```

**Key:** Day of month (1-31)
**Value:** Daily sales data object

## Verification Queries

The generated SQL file includes verification queries at the end:

```sql
-- Check sales_data records
SELECT id, store_id, year, month, jsonb_object_keys(daily_data) as day
FROM sales_data WHERE store_id = 1 ORDER BY year, month;

-- Check monthly_sales records
SELECT id, store_id, year, month, jsonb_object_keys(daily_data) as day
FROM monthly_sales WHERE store_id = 1 ORDER BY year, month;

-- Count total records
SELECT
  's:' || COUNT(*) as sales_data_count,
  'm:' || (SELECT COUNT(*) FROM monthly_sales WHERE store_id = 1) as monthly_sales_count
FROM sales_data WHERE store_id = 1;
```

## Data Processing Rules

1. **Date Range:** Only data within fiscal year ranges is processed (June to May)
2. **Numeric Values:** Rounded to 2 decimal places
3. **Empty Data:** Days with no data beyond date and dayOfWeek are skipped
4. **UPSERT:** Existing records are updated, new records are inserted
5. **Store ID:** All data is associated with store_id = 1 (EDW富山二口店)

## Fiscal Year Definitions

- **FY2023:** June 1, 2023 - May 31, 2024
- **FY2024:** June 1, 2024 - May 31, 2025

## Troubleshooting

### Error: Excel file not found
- Ensure the Excel file exists at `C:\job\project\計数管理表2024【EDW富山】.xlsx`
- Check file path in the script if the location has changed

### Error: No data processed
- Verify the sheet names are correct ('23年度', '24年度')
- Check that data starts at row 3 (0-indexed)
- Verify column indices match the actual Excel structure

### Error: psql command not found
- Use Docker exec method instead
- Or install PostgreSQL client tools

### Error: Database connection failed
- Ensure PostgreSQL is running: `docker ps | grep management-db`
- Verify database credentials in the command

## Customization

To process additional fiscal years, add new sheet configurations to the `sheetConfigs` array:

```javascript
{
  name: '25年度',
  fiscalYear: 2025,
  startYear: 2025,
  startMonth: 6,
  endYear: 2026,
  endMonth: 5,
  dataStartRow: 3,
  columnMapping: {
    0: 'date',
    9: 'netSales',
    11: 'edwNetSales',
    13: 'ohbNetSales',
    15: 'totalGroups',
    16: 'totalCustomers',
    26: 'laborCost'
  }
}
```

## Notes

- The script uses UPSERT (INSERT ... ON CONFLICT DO UPDATE) to safely re-run without duplicating data
- All operations are wrapped in a transaction (BEGIN...COMMIT)
- The store_id is hardcoded as 1 for EDW富山二口店
- Generated SQL file is safe to execute multiple times
