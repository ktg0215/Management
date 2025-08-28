const { chromium } = require('playwright');

async function simpleVisualTest() {
  console.log('=== Simple Visual Test Started ===');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Test admin pages with sidebar
  const testPages = [
    'http://localhost:3002/admin/dashboard',
    'http://localhost:3002/admin/add-admin',
    'http://localhost:3002/admin/business-types'
  ];
  
  for (const url of testPages) {
    try {
      console.log(`\n=== Testing: ${url} ===`);
      
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(3000);
      
      // Check for sidebar
      const sidebar = await page.locator('aside, .sidebar, [data-testid="sidebar"]').first();
      const isVisible = await sidebar.isVisible().catch(() => false);
      
      if (isVisible) {
        console.log(`✅ Sidebar IS VISIBLE on ${url}`);
        
        // Check sidebar content
        const navItems = await page.locator('aside nav a, aside .nav a, .sidebar nav a').count();
        console.log(`Navigation items in sidebar: ${navItems}`);
        
        // Get sidebar dimensions
        const sidebarBox = await sidebar.boundingBox().catch(() => null);
        if (sidebarBox) {
          console.log(`Sidebar dimensions: ${sidebarBox.width}x${sidebarBox.height}`);
        }
      } else {
        console.log(`❌ Sidebar NOT VISIBLE on ${url}`);
      }
      
      // Check main content positioning
      const main = await page.locator('main').first();
      const mainBox = await main.boundingBox().catch(() => null);
      if (mainBox) {
        console.log(`Main content position: x=${mainBox.x}, width=${mainBox.width}`);
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/visual-test-${url.split('/').pop()}.png`,
        fullPage: true 
      });
      
      console.log(`Screenshot saved for ${url}`);
      
    } catch (error) {
      console.log(`Error testing ${url}: ${error.message}`);
    }
  }
  
  console.log('\n=== Test completed. Keeping browser open for 10 seconds ===');
  await page.waitForTimeout(10000);
  
  await browser.close();
  console.log('=== Browser closed ===');
}

simpleVisualTest().catch(console.error);