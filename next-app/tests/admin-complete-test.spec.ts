import { test, expect } from '@playwright/test';

test.describe('Complete Admin System Test', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console logging for debugging
    page.on('console', msg => {
      console.log(`[Console ${msg.type()}]: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.log(`[Page Error]: ${error.message}`);
    });
  });

  test('Complete admin login and page access test', async ({ page }) => {
    console.log('=== Starting Complete Admin Test ===');
    
    // Step 1: Navigate to home page to check if admin setup is needed
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check if we need to create an admin account first
    const currentUrl = page.url();
    console.log(`Current URL after navigation: ${currentUrl}`);
    
    // Step 2: Try to access admin dashboard directly
    console.log('\n=== Checking admin dashboard access ===');
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const adminUrl = page.url();
    console.log(`Admin dashboard URL: ${adminUrl}`);
    
    // If redirected to login, perform login
    if (adminUrl.includes('/login')) {
      console.log('\n=== Attempting admin login ===');
      
      // Try common admin credentials
      const adminCredentials = [
        { email: 'admin@example.com', password: 'admin123' },
        { email: 'admin', password: 'admin123' },
        { email: 'super_admin', password: 'admin123' },
        { email: '001', password: 'admin123' }  // Employee ID format
      ];
      
      let loginSuccessful = false;
      
      for (const creds of adminCredentials) {
        console.log(`Trying credentials: ${creds.email}`);
        
        // Clear any existing form data
        await page.fill('input[type="email"], input[name="employeeId"], input[placeholder*="ID"]', '');
        await page.fill('input[type="password"]', '');
        
        // Fill login form
        const emailInput = page.locator('input[type="email"], input[name="employeeId"], input[placeholder*="ID"]').first();
        const passwordInput = page.locator('input[type="password"]').first();
        
        await emailInput.fill(creds.email);
        await passwordInput.fill(creds.password);
        
        // Submit login
        const submitButton = page.locator('button[type="submit"], button:has-text("ログイン")').first();
        await submitButton.click();
        
        // Wait for response
        await page.waitForTimeout(3000);
        
        const postLoginUrl = page.url();
        
        if (!postLoginUrl.includes('/login')) {
          console.log(`✅ Login successful with: ${creds.email}`);
          loginSuccessful = true;
          break;
        } else {
          console.log(`❌ Login failed with: ${creds.email}`);
        }
      }
      
      if (!loginSuccessful) {
        console.log('❌ Could not login with any credentials. Creating admin account...');
        
        // Navigate to admin creation if available
        await page.goto('/admin/add-admin');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // If still on login page, we can't proceed
        if (page.url().includes('/login')) {
          console.log('❌ Admin creation not accessible. Test cannot proceed.');
          return;
        }
      }
    }
    
    // Step 3: Test all admin pages with sidebar verification
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
    
    console.log('\n=== Testing all admin pages ===');
    
    for (const pagePath of adminPages) {
      console.log(`\n--- Testing page: ${pagePath} ---`);
      
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Verify we're on the correct page
      const currentPageUrl = page.url();
      const isOnCorrectPage = currentPageUrl.includes(pagePath) && !currentPageUrl.includes('/login');
      
      if (isOnCorrectPage) {
        console.log(`✅ Successfully loaded: ${pagePath}`);
        
        // Check for sidebar presence
        const sidebarSelectors = [
          '[data-testid="sidebar"]',
          '.sidebar',
          'nav',
          'aside',
          '[class*="sidebar"]',
          '[class*="nav"]'
        ];
        
        let sidebarFound = false;
        for (const selector of sidebarSelectors) {
          const sidebarElement = page.locator(selector);
          const count = await sidebarElement.count();
          if (count > 0) {
            const isVisible = await sidebarElement.first().isVisible();
            if (isVisible) {
              console.log(`✅ Sidebar found with selector: ${selector}`);
              sidebarFound = true;
              break;
            }
          }
        }
        
        if (!sidebarFound) {
          console.log(`⚠ No visible sidebar found on ${pagePath}`);
          
          // Take screenshot for debugging
          await page.screenshot({ 
            path: `test-results/no-sidebar-${pagePath.replace(/\//g, '-')}.png`,
            fullPage: true 
          });
        }
        
        // Check for any errors on the page
        const jsErrors: string[] = [];
        page.on('pageerror', error => {
          jsErrors.push(error.message);
        });
        
        if (jsErrors.length > 0) {
          console.log(`⚠ JavaScript errors on ${pagePath}:`, jsErrors);
        }
        
        // Verify page content is loaded
        const hasContent = await page.locator('main, .main, [role="main"]').count() > 0;
        if (hasContent) {
          console.log(`✅ Page content loaded on ${pagePath}`);
        } else {
          console.log(`⚠ No main content found on ${pagePath}`);
        }
        
      } else {
        console.log(`❌ Failed to access: ${pagePath} (redirected to: ${currentPageUrl})`);
      }
      
      // Take screenshot for visual verification
      await page.screenshot({ 
        path: `test-results/admin-page-${pagePath.replace(/\//g, '-')}.png`,
        fullPage: true 
      });
    }
    
    console.log('\n=== Admin test completed ===');
  });
});