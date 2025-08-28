-- Advanced Performance Indexes for Sales Management System
-- This migration adds comprehensive indexes for optimal query performance

-- Sales Data Indexes
-- Composite index for common sales data queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_data_store_year_month 
ON sales_data (store_id, year, month);

-- Index for date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_data_date_range 
ON sales_data (year, month, store_id) INCLUDE (daily_data, updated_at);

-- Partial index for recent sales data (last 2 years)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_data_recent 
ON sales_data (store_id, year DESC, month DESC) 
WHERE year >= EXTRACT(YEAR FROM CURRENT_DATE) - 2;

-- Stores and Business Types Indexes
-- Index for store-business type joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_business_type_active 
ON stores (business_type_id, id) 
WHERE created_at IS NOT NULL;

-- Index for business type lookups with store count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_types_with_stores 
ON business_types (id) 
INCLUDE (name, description);

-- Employee and Authentication Indexes
-- Unique index for employee authentication
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_employee_id_active 
ON employees (employee_id) 
WHERE is_active = true;

-- Index for role-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_store_role 
ON employees (store_id, role, is_active) 
INCLUDE (full_name, employee_id);

-- Payment Management Indexes
-- Composite index for payment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_company_month 
ON payments (company_id, month, store_id);

-- Index for payment reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_store_month_amount 
ON payments (store_id, month) 
INCLUDE (company_id, amount, created_at);

-- Company Management Indexes
-- Index for company-store relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_store_visible 
ON companies (store_id, is_visible) 
INCLUDE (name, category, payment_type);

-- Index for payment type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_payment_type 
ON companies (payment_type, store_id) 
WHERE is_visible = true;

-- Activity Logs Indexes
-- Composite index for activity log queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_user_store_date 
ON activity_logs (user_id, store_id, created_at DESC);

-- Index for business type activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_business_type_date 
ON activity_logs (business_type_id, created_at DESC) 
INCLUDE (action_type, resource_type);

-- Partial index for recent activity (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_recent 
ON activity_logs (created_at DESC, store_id) 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- PL (Profit & Loss) Indexes
-- Composite index for PL statements
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pl_statements_store_year_month 
ON pl_statements (store_id, year, month);

-- Index for PL items with sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pl_items_statement_order 
ON pl_items (pl_statement_id, sort_order, created_at);

-- Shift Management Indexes (if tables exist)
DO $$
BEGIN
    -- Check if shift tables exist and create indexes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shift_periods') THEN
        -- Index for shift periods by store
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_periods_store_dates 
        ON shift_periods (store_id, start_date DESC, end_date DESC);
        
        -- Partial index for active shift periods
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_periods_active 
        ON shift_periods (store_id, end_date) 
        WHERE end_date >= CURRENT_DATE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shift_submissions') THEN
        -- Index for shift submissions
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_submissions_period_employee 
        ON shift_submissions (period_id, employee_id, status);
        
        -- Index for submission date queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_submissions_created 
        ON shift_submissions (created_at DESC) 
        INCLUDE (period_id, employee_id, status);
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shift_entries') THEN
        -- Index for shift entries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_entries_submission_date 
        ON shift_entries (submission_id, work_date);
    END IF;
END
$$;

-- Functional Indexes for JSON Data
-- Index for searching daily sales data (if using JSONB)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_data_daily_total 
ON sales_data USING GIN ((daily_data));

-- Expression index for calculating monthly totals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_data_monthly_total 
ON sales_data (store_id, year, month, 
    (SELECT SUM((value->>'sales')::numeric) 
     FROM jsonb_each(daily_data) 
     WHERE value->>'sales' IS NOT NULL AND value->>'sales' != ''));

-- Statistics Update
-- Update table statistics for better query planning
ANALYZE sales_data;
ANALYZE stores;
ANALYZE business_types;
ANALYZE employees;
ANALYZE payments;
ANALYZE companies;
ANALYZE activity_logs;

-- Add comments for documentation
COMMENT ON INDEX idx_sales_data_store_year_month IS 'Primary index for sales data queries by store, year, and month';
COMMENT ON INDEX idx_sales_data_date_range IS 'Covering index for date range sales queries with included columns';
COMMENT ON INDEX idx_sales_data_recent IS 'Partial index for recent sales data to improve query performance';
COMMENT ON INDEX idx_employees_employee_id_active IS 'Unique index for active employee authentication';
COMMENT ON INDEX idx_payments_company_month IS 'Composite index for payment management queries';
COMMENT ON INDEX idx_activity_logs_recent IS 'Partial index for recent activity logs within 30 days';

-- Create custom statistics for better query planning
DO $$
BEGIN
    -- Create extended statistics for correlated columns
    IF NOT EXISTS (
        SELECT 1 FROM pg_statistic_ext 
        WHERE stxname = 'stats_sales_data_store_date'
    ) THEN
        CREATE STATISTICS stats_sales_data_store_date 
        ON store_id, year, month FROM sales_data;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_statistic_ext 
        WHERE stxname = 'stats_employees_store_role'
    ) THEN
        CREATE STATISTICS stats_employees_store_role 
        ON store_id, role, is_active FROM employees;
    END IF;
END
$$;

-- Create maintenance functions for index management
CREATE OR REPLACE FUNCTION maintain_sales_indexes()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Reindex sales data indexes monthly
    REINDEX INDEX CONCURRENTLY idx_sales_data_store_year_month;
    REINDEX INDEX CONCURRENTLY idx_sales_data_date_range;
    
    -- Update statistics
    ANALYZE sales_data;
    ANALYZE activity_logs;
    
    -- Log maintenance completion
    INSERT INTO activity_logs (
        user_id, action_type, resource_type, resource_name, description
    ) VALUES (
        (SELECT id FROM employees WHERE role = 'super_admin' LIMIT 1),
        'maintenance',
        'database',
        'indexes',
        'Automated index maintenance completed'
    );
END
$$;

-- Performance monitoring view
CREATE OR REPLACE VIEW v_index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    ROUND(
        CASE 
            WHEN idx_scan = 0 THEN 0 
            ELSE (idx_tup_read::numeric / idx_scan) 
        END, 2
    ) as avg_tuples_per_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC, idx_tup_read DESC;

-- Query performance monitoring view
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    query,
    calls,
    total_exec_time,
    ROUND(mean_exec_time::numeric, 2) as avg_exec_time_ms,
    ROUND((100 * total_exec_time / sum(total_exec_time) OVER())::numeric, 2) as percent_total_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries slower than 100ms
ORDER BY total_exec_time DESC
LIMIT 20;

COMMENT ON FUNCTION maintain_sales_indexes() IS 'Automated index maintenance function for sales management system';
COMMENT ON VIEW v_index_usage_stats IS 'Index usage statistics for performance monitoring';
COMMENT ON VIEW v_slow_queries IS 'View of slow queries for performance optimization';

-- Grant permissions for monitoring views
GRANT SELECT ON v_index_usage_stats TO PUBLIC;
GRANT SELECT ON v_slow_queries TO PUBLIC;