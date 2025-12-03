// 管理者アカウントを確認するスクリプト

import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.trim() || '',
});

async function checkAdminUsers() {
  try {
    // 管理者アカウントを取得
    const result = await pool.query(
      `SELECT id, email, role, employee_id FROM employees 
       WHERE role IN ('admin', 'super_admin') 
       ORDER BY role, email 
       LIMIT 10`
    );
    
    console.log(`管理者アカウント: ${result.rows.length}件\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. email: ${row.email}`);
      console.log(`   role: ${row.role}`);
      console.log(`   employee_id: ${row.employee_id || 'null'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkAdminUsers();

