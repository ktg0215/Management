import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  // 認証ファイルをクリーンアップ
  const authFilePath = path.join(__dirname, 'auth.json');
  
  try {
    if (fs.existsSync(authFilePath)) {
      fs.unlinkSync(authFilePath);
      console.log('✅ Global teardown completed: Auth file cleaned up');
    }
  } catch (error) {
    console.log('⚠️ Global teardown warning:', error);
  }
}

export default globalTeardown;