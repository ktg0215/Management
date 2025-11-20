-- データベース初期化スクリプト
-- すべての基本テーブルを作成

-- 拡張機能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 業態テーブル
CREATE TABLE IF NOT EXISTS business_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 店舗テーブル
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    business_type_id INTEGER REFERENCES business_types(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 従業員テーブル (ユーザー)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    nickname VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    store_id INTEGER REFERENCES stores(id),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- アクティビティログテーブル
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES employees(id),
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_name VARCHAR(200),
    description TEXT,
    store_id INTEGER REFERENCES stores(id),
    business_type_id INTEGER REFERENCES business_types(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 会社マスタ
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    store_id INTEGER REFERENCES stores(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 支払いテーブル
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    month VARCHAR(7) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    store_id INTEGER REFERENCES stores(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 売上データテーブル
CREATE TABLE IF NOT EXISTS sales_data (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    daily_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES employees(id),
    updated_by INTEGER REFERENCES employees(id),
    UNIQUE(store_id, year, month)
);

-- P&Lテーブル
CREATE TABLE IF NOT EXISTS pl_data (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES employees(id),
    updated_by INTEGER REFERENCES employees(id),
    UNIQUE(store_id, year, month)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_store_id ON employees(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_business_type_id ON stores(business_type_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_store_year_month ON sales_data(store_id, year, month);
CREATE INDEX IF NOT EXISTS idx_sales_data_created_at ON sales_data(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- 初期データ
-- 業態タイプ
INSERT INTO business_types (name, description) VALUES
    ('カフェ', 'カフェ・喫茶店業態'),
    ('レストラン', 'レストラン業態'),
    ('ベーカリー', 'パン・ベーカリー業態')
ON CONFLICT (name) DO NOTHING;

-- テスト店舗
INSERT INTO stores (name, address, business_type_id)
VALUES ('EDW富山二口店', '富山県', 1)
ON CONFLICT DO NOTHING;

-- 管理者ユーザー (パスワード: admin123)
INSERT INTO employees (employee_id, full_name, nickname, password_hash, store_id, role)
SELECT 'admin', '管理者', 'Admin',
       '$2b$10$YourHashedPasswordHere',
       (SELECT id FROM stores WHERE name = 'EDW富山二口店'),
       'super_admin'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE employee_id = 'admin');

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE 'データベース初期化完了';
END $$;
