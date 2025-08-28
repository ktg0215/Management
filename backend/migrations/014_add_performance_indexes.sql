-- Performance optimization indexes
BEGIN;

-- Employee table indexes
CREATE INDEX IF NOT EXISTS idx_employees_employee_id_active ON employees(employee_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_employees_store_role ON employees(store_id, role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role) WHERE is_active = true;

-- Stores table indexes
CREATE INDEX IF NOT EXISTS idx_stores_business_type ON stores(business_type_id);
CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name);

-- Activity logs indexes (with partial indexes for better performance)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_store_created ON activity_logs(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_business_type_created ON activity_logs(business_type_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource_type ON activity_logs(resource_type, created_at DESC);

-- Sales data indexes
CREATE INDEX IF NOT EXISTS idx_sales_data_store_date ON sales_data(store_id, year, month);
CREATE INDEX IF NOT EXISTS idx_sales_data_created_by ON sales_data(created_by);

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_company_month ON payments(company_id, month);
CREATE INDEX IF NOT EXISTS idx_payments_store_month ON payments(store_id, month);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Companies table indexes
CREATE INDEX IF NOT EXISTS idx_companies_store_visible ON companies(store_id) WHERE is_visible = true;
CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(category);
CREATE INDEX IF NOT EXISTS idx_companies_payment_type ON companies(payment_type);

-- PL statements indexes
CREATE INDEX IF NOT EXISTS idx_pl_statements_created_by ON pl_statements(created_by);
CREATE INDEX IF NOT EXISTS idx_pl_statements_created_at ON pl_statements(created_at DESC);

-- PL items indexes
CREATE INDEX IF NOT EXISTS idx_pl_items_sort_order ON pl_items(pl_statement_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pl_items_subject_name ON pl_items(subject_name);

-- Shift tables indexes
CREATE INDEX IF NOT EXISTS idx_shift_periods_store_dates ON shift_periods(store_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_period_employee ON shift_submissions(period_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_status ON shift_submissions(status);
CREATE INDEX IF NOT EXISTS idx_shift_entries_submission_date ON shift_entries(submission_id, work_date);

-- Business types index
CREATE INDEX IF NOT EXISTS idx_business_types_name ON business_types(name);

-- Add constraint for better query optimization
ALTER TABLE payments ADD CONSTRAINT check_positive_amount CHECK (amount >= 0);
ALTER TABLE pl_items ADD CONSTRAINT check_pl_amounts CHECK (estimate >= 0 AND actual >= 0);

COMMIT;