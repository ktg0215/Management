const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim(),
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('📧 storesテーブルに住所・緯度・経度フィールドを追加中...');

    // マイグレーションファイルを読み込んで実行
    const migrationPath = path.join(__dirname, 'migrations', 'add_store_address_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    await client.query(migrationSQL);
    console.log('✅ マイグレーション完了');

    await client.query('COMMIT');
    console.log('✅ コミット完了');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ マイグレーション中にエラーが発生しました:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

