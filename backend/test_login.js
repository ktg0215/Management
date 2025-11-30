const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim(),
});

async function testLogin() {
  const client = await pool.connect();
  try {
    console.log('🔐 ログインテストを実行中...\n');
    
    const testUser = {
      email: 'test_super_admin@example.com',
      password: 'super1234'
    };
    
    // ユーザーを取得
    const userResult = await client.query(
      'SELECT id, employee_id, email, password_hash, role, is_active FROM employees WHERE email = $1',
      [testUser.email]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ ユーザーが見つかりませんでした');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ ユーザーが見つかりました:');
    console.log(`   メールアドレス: ${user.email}`);
    console.log(`   名前: ${user.employee_id}`);
    console.log(`   権限: ${user.role}`);
    console.log(`   アクティブ: ${user.is_active ? 'はい' : 'いいえ'}`);
    console.log(`   パスワードハッシュ: ${user.password_hash ? '設定済み' : '未設定'}`);
    
    if (!user.password_hash) {
      console.log('\n❌ パスワードハッシュが設定されていません');
      return;
    }
    
    // パスワードを検証
    console.log('\n🔍 パスワード検証中...');
    const isMatch = await bcrypt.compare(testUser.password, user.password_hash);
    
    if (isMatch) {
      console.log('✅ パスワードが一致しました！ログイン可能です。');
    } else {
      console.log('❌ パスワードが一致しませんでした');
      console.log('   パスワードをリセットしてください: node reset_test_user_password.js');
    }
    
  } catch (err) {
    console.error('❌ エラー:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

testLogin();

