import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  // デモ用の認証情報でログインし、認証状態を保存
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto(`${baseURL}/login`);
    
    // ログイン処理（デモ用のアカウントがあることを前提）
    await page.fill('[data-testid="employee-id"]', 'admin');
    await page.fill('[data-testid="password"]', 'admin');
    await page.click('[data-testid="login-button"]');
    
    // ダッシュボードに遷移するまで待機
    await page.waitForURL(`${baseURL}/admin/dashboard`, { timeout: 30000 });
    
    // 認証状態をファイルに保存
    await page.context().storageState({ path: 'tests/auth.json' });
    
    console.log('✅ Global setup completed: Authentication state saved');
  } catch (error) {
    console.log('⚠️ Global setup warning: Could not establish auth state:', error);
    // 認証に失敗した場合でもテストを続行
  } finally {
    await browser.close();
  }
}

export default globalSetup;