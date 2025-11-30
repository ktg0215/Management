const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim(),
});

async function resetPassword() {
  const client = await pool.connect();
  try {
    console.log('🔐 テストユーザーのパスワードをリセット中...\n');
    
    const testUsers = [
      { email: 'test_super_admin@example.com', password: 'super1234' },
      { email: 'test_admin_1@example.com', password: 'admin1234' },
      { email: 'test_user_1@example.com', password: 'test1234' },
      { email: 'test_user_2@example.com', password: 'test1234' },
    ];
    
    for (const user of testUsers) {
      // パスワードハッシュを生成
      const passwordHash = await bcrypt.hash(user.password, 10);
      
      // データベースを更新
      const result = await client.query(
        'UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING email, full_name, role',
        [passwordHash, user.email]
      );
      
      if (result.rows.length > 0) {
        console.log(`✅ ${user.email} のパスワードをリセットしました`);
        console.log(`   パスワード: ${user.password}`);
        console.log(`   名前: ${result.rows[0].full_name}`);
        console.log(`   権限: ${result.rows[0].role}\n`);
      } else {
        console.log(`⚠️ ${user.email} が見つかりませんでした\n`);
      }
    }
    
    console.log('✅ パスワードリセット完了');
  } catch (err) {
    console.error('❌ エラー:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetPassword();

