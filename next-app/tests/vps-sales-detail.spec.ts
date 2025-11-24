import { test, expect } from '@playwright/test';

const VPS_URL = 'https://edwtoyama.com/bb';

test('VPS Sales Page Detail Test', async ({ page }) => {
  // Collect console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[error] ${msg.text()}`);
    }
  });

  // Collect failed network requests
  const failedRequests: { url: string; status: number }[] = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  console.log('=== Step 1: Login ===');
  await page.goto(`${VPS_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

  // Login with admin credentials
  await page.locator('input').first().fill('0000');
  await page.locator('input[type="password"]').fill('admin123');
  await page.locator('button[type="submit"]').click();

  // Wait for login
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
  console.log('Login successful');

  console.log('=== Step 2: Navigate to Monthly Sales ===');
  await page.goto(`${VPS_URL}/admin/monthly-sales`, { waitUntil: 'networkidle', timeout: 15000 });

  await page.screenshot({ path: 'vps-sales-01-monthly-sales.png', fullPage: true });

  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);

  // Check page content
  const pageContent = await page.content();
  const hasData = pageContent.includes('売上') || pageContent.includes('月次');
  console.log(`Page has sales data: ${hasData}`);

  // Check for tables and data
  const tables = await page.locator('table').count();
  const inputs = await page.locator('input').count();
  const selects = await page.locator('select').count();

  console.log(`Tables: ${tables}, Inputs: ${inputs}, Selects: ${selects}`);

  console.log('=== Step 3: Check Dashboard ===');
  await page.goto(`${VPS_URL}/admin/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: 'vps-sales-02-dashboard.png', fullPage: true });

  console.log('\n=== Summary ===');
  console.log(`Console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(err => console.log(err));
  }

  console.log(`\nFailed requests: ${failedRequests.length}`);
  if (failedRequests.length > 0) {
    failedRequests.forEach(req => console.log(`${req.url} - ${req.status}`));
  }

  console.log('\n=== Test Complete ===');
});
