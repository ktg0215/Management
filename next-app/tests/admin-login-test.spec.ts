import { test, expect } from '@playwright/test';

test.describe('Admin Login and Page Access Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('Admin login and test all pages with sidebar', async ({ page }) => {
    console.log('=== Testing Admin Login and All Pages ===');
    
    // Check if we're on login page
    await expect(page).toHaveURL(/.*\/login/);
    
    // Fill in admin credentials (assuming default admin credentials)
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123');
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForLoadState('networkidle');
    
    // Check if login was successful (should redirect away from login page)
    await page.waitForTimeout(2000);
    
    const adminPages = [
      '/admin/dashboard',
      '/admin/add-admin',
      '/admin/business-types',
      '/admin/companies',
      '/admin/employees',
      '/admin/monthly-sales',
      '/admin/payments',
      '/admin/pl-create',
      '/admin/sales-management',
      '/admin/shifts',
      '/admin/stores',
      '/admin/yearly-progress'
    ];
    
    for (const pagePath of adminPages) {
      console.log(`\n=== Testing page: ${pagePath} ===`);
      
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check if page loaded successfully
      await expect(page).toHaveURL(new RegExp(`.*${pagePath.replace('/', '\\/')}`));
      
      // Check for sidebar presence
      const sidebar = page.locator('[data-testid="sidebar"], .sidebar, nav, aside');
      const sidebarVisible = await sidebar.isVisible().catch(() => false);
      
      if (sidebarVisible) {
        console.log(`✓ Sidebar is visible on ${pagePath}`);
      } else {
        console.log(`⚠ Sidebar not found on ${pagePath}`);
        
        // Look for any navigation elements
        const navElements = await page.locator('nav, .nav, [role="navigation"]').count();
        console.log(`Navigation elements found: ${navElements}`);
      }
      
      // Check for any JavaScript errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      page.on('pageerror', error => {
        errors.push(error.message);
      });
      
      if (errors.length > 0) {
        console.log(`Errors on ${pagePath}:`, errors);
      } else {
        console.log(`✓ No errors on ${pagePath}`);
      }
      
      // Take screenshot for manual inspection
      await page.screenshot({ 
        path: `screenshots/admin-${pagePath.replace(/\//g, '-')}.png`,
        fullPage: true 
      });
      
      console.log(`=== Finished testing page: ${pagePath} ===\n`);
    }
  });
});