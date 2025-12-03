// 管理者パスワードをリセットするスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function resetAdminPassword() {
  try {
    const email = '0000@example.com';
    const newPassword = 'admin123';
    
    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // パスワードを更新
    const result = await pool.query(
      'UPDATE employees SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`パスワードをリセットしました: ${email}`);
      console.log(`新しいパスワード: ${newPassword}`);
    } else {
      console.log(`ユーザーが見つかりません: ${email}`);
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();

