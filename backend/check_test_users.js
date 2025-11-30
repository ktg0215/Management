const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim(),
});

async function checkTestUsers() {
  const client = await pool.connect();
  try {
    console.log('📋 テストユーザーを確認中...\n');
    
    const result = await client.query(
      `SELECT employee_id, email, full_name, role, is_active, 
       CASE WHEN password_hash IS NOT NULL THEN '設定済み' ELSE '未設定' END as password_status
       FROM employees 
       WHERE email LIKE 'test_%' OR email = 'admin@example.com' 
       ORDER BY email`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ テストユーザーが見つかりませんでした。');
      console.log('   テストユーザーを作成してください: node create_test_users.js');
    } else {
      console.log(`✅ ${result.rows.length}件のユーザーが見つかりました:\n`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   名前: ${user.full_name}`);
        console.log(`   権限: ${user.role}`);
        console.log(`   アクティブ: ${user.is_active ? 'はい' : 'いいえ'}`);
        console.log(`   パスワード: ${user.password_status}`);
        console.log('');
      });
    }
    
    // パスワードハッシュの確認
    console.log('\n🔍 パスワードハッシュの詳細確認:');
    const hashResult = await client.query(
      `SELECT email, 
       LENGTH(password_hash) as hash_length,
       SUBSTRING(password_hash, 1, 10) as hash_preview
       FROM employees 
       WHERE email = 'test_super_admin@example.com'`
    );
    
    if (hashResult.rows.length > 0) {
      const user = hashResult.rows[0];
      console.log(`   メールアドレス: ${user.email}`);
      console.log(`   ハッシュ長: ${user.hash_length}文字`);
      console.log(`   ハッシュプレビュー: ${user.hash_preview}...`);
    } else {
      console.log('   test_super_admin@example.com が見つかりません');
    }
    
  } catch (err) {
    console.error('❌ エラー:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTestUsers();

