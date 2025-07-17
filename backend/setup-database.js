const { Pool } = require('pg');

// 環境変数を直接設定
process.env.DATABASE_URL = 'postgresql://postgres:postgres123@localhost:5432/shift_management';
process.env.JWT_SECRET = 'ktg19850215';
process.env.TZ = 'Asia/Tokyo';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupDatabase() {
  try {
    console.log('データベースのセットアップを開始します...');

    // 1. テーブル作成（存在しない場合のみ）
    console.log('1. テーブル作成中...');
    
    // companiesテーブル作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        bank_name VARCHAR(255),
        branch_name VARCHAR(255),
        account_type VARCHAR(50),
        account_number VARCHAR(50),
        category VARCHAR(100) NOT NULL,
        payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('regular','irregular','specific')),
        regular_amount INTEGER,
        specific_months INTEGER[],
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // paymentsテーブル作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id),
        month VARCHAR(7) NOT NULL,
        amount INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(company_id, month)
      );
    `);

    // activity_logsテーブル作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES employees(id) ON DELETE CASCADE,
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        business_type_id UUID REFERENCES business_types(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_name VARCHAR(255),
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // activity_logsのインデックス作成
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_store_id ON activity_logs(store_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_business_type_id ON activity_logs(business_type_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
    `);

    // shift_periodsテーブルは既に存在するため、追加のカラムのみ追加
    await pool.query(`
      ALTER TABLE shift_periods 
      ADD COLUMN IF NOT EXISTS year INTEGER,
      ADD COLUMN IF NOT EXISTS month INTEGER;
    `);

    // 新しいインデックス作成
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shift_periods_year_month ON shift_periods(year, month);
    `);

    // stores テーブルに business_type_id カラムを追加
    await pool.query(`
      ALTER TABLE stores 
      ADD COLUMN IF NOT EXISTS business_type_id UUID REFERENCES business_types(id);
    `);

    // storesのインデックス作成
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_stores_business_type_id ON stores(business_type_id);
    `);

    // pl_itemsテーブル作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pl_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pl_statement_id UUID REFERENCES pl_statements(id) ON DELETE CASCADE,
        subject_name VARCHAR(255) NOT NULL,
        estimate INTEGER DEFAULT 0,
        actual INTEGER DEFAULT 0,
        is_highlighted BOOLEAN DEFAULT false,
        is_subtotal BOOLEAN DEFAULT false,
        is_indented BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(pl_statement_id, subject_name)
      );
    `);

    // pl_itemsのインデックス作成
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pl_items_pl_statement_id ON pl_items(pl_statement_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pl_items_sort_order ON pl_items(sort_order);
    `);

    console.log('テーブル作成完了');

    // デモデータの挿入
    // 1. 業態データ
    console.log('1. 業態データを挿入中...');
    await pool.query(`
      INSERT INTO business_types (name, description) VALUES 
      ('Manager', '管理者業態'),
      ('Yakiniku', '焼肉店'),
      ('Izakaya', '居酒屋'),
      ('Ramen', 'ラーメン店'),
      ('Cafe', 'カフェ'),
      ('Fast Food', 'ファーストフード')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 業態IDを取得
    const businessTypesResult = await pool.query('SELECT id, name FROM business_types ORDER BY name');
    const businessTypes = businessTypesResult.rows;
    console.log(`${businessTypes.length}業態のデータを確認しました`);

    const yakinikyuTypeId = businessTypes.find(bt => bt.name === 'Yakiniku')?.id;
    const izakayaTypeId = businessTypes.find(bt => bt.name === 'Izakaya')?.id;
    const ramenTypeId = businessTypes.find(bt => bt.name === 'Ramen')?.id;
    const cafeTypeId = businessTypes.find(bt => bt.name === 'Cafe')?.id;

    // 2. 店舗データ
    console.log('2. 店舗データを挿入中...');
    await pool.query(`
      INSERT INTO stores (name, business_type_id) VALUES 
      ('東京本店', $1),
      ('大阪支店', $2),
      ('名古屋支店', $3),
      ('福岡支店', $4),
      ('札幌支店', $1)
      ON CONFLICT DO NOTHING;
    `, [yakinikyuTypeId, izakayaTypeId, ramenTypeId, cafeTypeId]);
    // 店舗IDを取得
    const storesResult = await pool.query('SELECT id, name FROM stores ORDER BY name');
    const stores = storesResult.rows;
    console.log(`${stores.length}店舗のデータを確認しました`);

    // 3. 従業員データ
    console.log('3. 従業員データを挿入中...');
    const tokyoStoreId = stores.find(s => s.name === '東京本店')?.id;
    const osakaStoreId = stores.find(s => s.name === '大阪支店')?.id;
    const nagoyaStoreId = stores.find(s => s.name === '名古屋支店')?.id;
    
    if (tokyoStoreId) {
      await pool.query(`
        INSERT INTO employees (employee_id, password_hash, full_name, nickname, store_id, role)
        VALUES 
        ('0000', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '総管理者', '総管理者', $1, 'super_admin'),
        ('0001', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '田中太郎', '田中', $1, 'admin'),
        ('1001', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '鈴木一郎', '鈴木', $1, 'user'),
        ('1002', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '高橋美咲', '高橋', $1, 'user'),
        ('1003', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '山田次郎', '山田', $1, 'user')
        ON CONFLICT (employee_id) DO NOTHING;
      `, [tokyoStoreId]);
    }

    if (osakaStoreId) {
      await pool.query(`
        INSERT INTO employees (employee_id, password_hash, full_name, nickname, store_id, role)
        VALUES 
        ('0002', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '佐藤花子', '佐藤', $1, 'admin'),
        ('1004', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '伊藤健太', '伊藤', $1, 'user'),
        ('1005', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '渡辺愛子', '渡辺', $1, 'user')
        ON CONFLICT (employee_id) DO NOTHING;
      `, [osakaStoreId]);
    }

    if (nagoyaStoreId) {
      await pool.query(`
        INSERT INTO employees (employee_id, password_hash, full_name, nickname, store_id, role)
        VALUES 
        ('1006', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '中村真理', '中村', $1, 'user'),
        ('1007', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '小林大輔', '小林', $1, 'user')
        ON CONFLICT (employee_id) DO NOTHING;
      `, [nagoyaStoreId]);
    }

    const employeesResult = await pool.query('SELECT id, employee_id, full_name FROM employees ORDER BY employee_id');
    const employees = employeesResult.rows;
    console.log(`${employees.length}名の従業員データを確認しました`);

    // 4. 取引先企業データ
    console.log('4. 取引先企業データを挿入中...');
    await pool.query(`
      INSERT INTO companies (name, bank_name, branch_name, account_type, account_number, category, payment_type, regular_amount, specific_months)
      VALUES 
      ('東京電力', '三菱UFJ銀行', '新宿支店', '普通', '1234567', '光熱費', 'regular', 50000, NULL),
      ('東京ガス', 'みずほ銀行', '渋谷支店', '普通', '2345678', '光熱費', 'regular', 30000, NULL),
      ('NTT東日本', '三井住友銀行', '池袋支店', '普通', '3456789', '通信費', 'regular', 15000, NULL),
      ('三井住友カード', '三井住友銀行', '本店', '普通', '4567890', '経費', 'regular', 80000, NULL),
      ('大和ハウス工業', '大和ネクスト銀行', '本店', '普通', '5678901', '地代家賃', 'regular', 200000, NULL),
      ('オフィス用品商事', 'りそな銀行', '新宿支店', '普通', '6789012', '消耗品費', 'irregular', NULL, NULL),
      ('システム開発会社', 'ゆうちょ銀行', '本店', '普通', '7890123', 'システム費', 'irregular', NULL, NULL),
      ('清掃サービス', '横浜銀行', '横浜支店', '普通', '8901234', '外注費', 'irregular', NULL, NULL),
      ('保険会社', '損保ジャパン銀行', '本店', '普通', '9012345', '保険料', 'specific', 120000, ARRAY[3,6,9,12]),
      ('税理士事務所', '城南信用金庫', '本店', '普通', '0123456', '顧問料', 'specific', 50000, ARRAY[12]),
      ('リース会社', '三菱UFJリース', '本店', '普通', '1234567', 'リース料', 'specific', 25000, ARRAY[1,4,7,10])
      ON CONFLICT DO NOTHING;
    `);

    const companiesResult = await pool.query('SELECT id, name, payment_type, regular_amount, specific_months FROM companies ORDER BY name');
    const companies = companiesResult.rows;
    console.log(`${companies.length}社の企業データを確認しました`);

    // 5. 支払い履歴データ（過去12ヶ月）
    console.log('5. 支払い履歴データを挿入中...');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    for (let i = 0; i < 12; i++) {
      let targetMonth = currentMonth - i;
      let targetYear = currentYear;
      
      if (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      
      const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      
      for (const company of companies) {
        let shouldCreatePayment = false;
        let amount = 0;
        
        if (company.payment_type === 'regular') {
          shouldCreatePayment = true;
          amount = company.regular_amount + Math.floor(Math.random() * 10000 - 5000); // ±5000の変動
        } else if (company.payment_type === 'specific' && company.specific_months) {
          shouldCreatePayment = company.specific_months.includes(targetMonth);
          amount = company.regular_amount + Math.floor(Math.random() * 5000 - 2500); // ±2500の変動
        } else if (company.payment_type === 'irregular') {
          shouldCreatePayment = Math.random() < 0.4; // 40%の確率で支払い
          amount = Math.floor(Math.random() * 100000 + 10000); // 10,000～110,000の範囲
        }
        
        if (shouldCreatePayment && amount > 0) {
          await pool.query(`
            INSERT INTO payments (company_id, month, amount)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING;
          `, [company.id, monthStr, amount]);
        }
      }
    }

    console.log('支払い履歴データの挿入が完了しました');

    // 6. シフト期間データ（過去3ヶ月、現在、未来3ヶ月）
    console.log('6. シフト期間データを挿入中...');
    
    for (let i = -3; i <= 3; i++) {
      let targetMonth = currentMonth + i;
      let targetYear = currentYear;
      
      if (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      } else if (targetMonth > 12) {
        targetMonth -= 12;
        targetYear += 1;
      }
      
      // 前半期間
      const firstHalfStart = new Date(targetYear, targetMonth - 1, 1);
      const firstHalfEnd = new Date(targetYear, targetMonth - 1, 15);
      const firstHalfDeadline = new Date(targetYear, targetMonth - 1, -10); // 前月20日
      
      // 後半期間
      const secondHalfStart = new Date(targetYear, targetMonth - 1, 16);
      const secondHalfEnd = new Date(targetYear, targetMonth, 0); // 月末
      const secondHalfDeadline = new Date(targetYear, targetMonth - 1, 5); // 当月5日
      
      // すべての店舗のシフト期間を作成
      for (const store of stores) {
        try {
          await pool.query(`
            INSERT INTO shift_periods (store_id, year, month, is_first_half, start_date, end_date, submission_deadline)
            VALUES 
            ($1, $2, $3, true, $4, $5, $6),
            ($1, $2, $3, false, $7, $8, $9)
            ON CONFLICT (store_id, start_date, end_date) DO NOTHING;
          `, [
            parseInt(store.id), targetYear, targetMonth,
            firstHalfStart.toISOString().split('T')[0],
            firstHalfEnd.toISOString().split('T')[0],
            firstHalfDeadline.toISOString().split('T')[0],
            secondHalfStart.toISOString().split('T')[0],
            secondHalfEnd.toISOString().split('T')[0],
            secondHalfDeadline.toISOString().split('T')[0]
          ]);
        } catch (error) {
          console.log(`店舗 ${store.name} のシフト期間作成をスキップ:`, error.message);
        }
      }
    }

    // 7. 損益計算書データ（過去6ヶ月）
    console.log('7. 損益計算書データを挿入中...');
    const adminEmployee = employees.find(e => e.employee_id === '0001');
    
    if (adminEmployee && stores.length > 0) {
      for (let i = 0; i < 6; i++) {
        let targetMonth = currentMonth - i;
        let targetYear = currentYear;
        
        if (targetMonth <= 0) {
          targetMonth += 12;
          targetYear -= 1;
        }
        
        // 既存のPL文を確認
        const existingPL = await pool.query(`
          SELECT id FROM pl_statements 
          WHERE store_id = $1 AND year = $2 AND month = $3
        `, [parseInt(stores[0].id), targetYear, targetMonth]);
        
        let plStatementId;
        if (existingPL.rows.length > 0) {
          plStatementId = existingPL.rows[0].id;
        } else {
          const plResult = await pool.query(`
            INSERT INTO pl_statements (store_id, year, month, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
          `, [parseInt(stores[0].id), targetYear, targetMonth, parseInt(adminEmployee.id)]);
          plStatementId = plResult.rows[0].id;
        }
        
        if (plStatementId) {
          
          // 基本的な損益項目
          const baseRevenue = 5000000 + Math.floor(Math.random() * 1000000); // 500万～600万
          const baseCost = Math.floor(baseRevenue * 0.6) + Math.floor(Math.random() * 200000); // 売上の約60%
          const grossProfit = baseRevenue - baseCost;
          
          await pool.query(`
            INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order)
            VALUES 
            ($1, '売上高', $2, $3, true, false, false, 1),
            ($1, '売上原価', $4, $5, false, false, false, 2),
            ($1, '粗利益', $6, $7, true, true, false, 3),
            ($1, 'アルバイト給与', 400000, 410000, false, false, true, 4),
            ($1, '広告宣伝費', 100000, 120000, false, false, true, 5),
            ($1, '変動費計', 500000, 530000, false, true, false, 6),
            ($1, '従業員給与', 600000, 610000, false, false, true, 7),
            ($1, '地代家賃', 200000, 200000, false, false, true, 8),
            ($1, '光熱費', 80000, 85000, false, false, true, 9),
            ($1, '固定費計', 880000, 895000, false, true, false, 10),
            ($1, '営業利益', $8, $9, true, true, false, 11)
            ON CONFLICT DO NOTHING;
          `, [
            plStatementId,
            baseRevenue, baseRevenue + Math.floor(Math.random() * 200000 - 100000),
            baseCost, baseCost + Math.floor(Math.random() * 100000 - 50000),
            grossProfit, grossProfit + Math.floor(Math.random() * 150000 - 75000),
            grossProfit - 1380000, grossProfit - 1380000 + Math.floor(Math.random() * 100000 - 50000)
          ]);
        }
      }
    }

    console.log('データベースのセットアップが完了しました！');
    console.log('');
    console.log('=== セットアップ完了 ===');
    console.log('テーブル構造とデモデータの作成が完了しました。');

  } catch (error) {
    console.error('セットアップエラー:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase(); 