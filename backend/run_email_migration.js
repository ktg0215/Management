const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim(),
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('📧 emailカラムを追加中...');
    
    // emailカラムを追加
    await client.query(`
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);
    console.log('✅ emailカラムを追加しました');
    
    // 既存のデータに対して、employee_idをベースにemailを設定
    await client.query(`
      UPDATE employees 
      SET email = employee_id || '@example.com' 
      WHERE email IS NULL OR email = '';
    `);
    console.log('✅ 既存データにemailを設定しました');
    
    // インデックスを追加
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
    `);
    console.log('✅ emailインデックスを追加しました');
    
    // 管理者アカウント（employee_id = '0000'）のemailを設定
    await client.query(`
      UPDATE employees 
      SET email = 'admin@example.com' 
      WHERE employee_id = '0000' AND (email IS NULL OR email = '');
    `);
    console.log('✅ 管理者アカウントのemailを設定しました');
    
    console.log('✅ マイグレーション完了');
  } catch (err) {
    console.error('❌ マイグレーションエラー:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

