const { chromium } = require('playwright');

async function debugAllPages() {
  console.log('Starting browser debugging session...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000,
    devtools: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  page.on('console', msg => {
    console.log(`[Console ${msg.type()}]: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[Page Error]: ${error.message}`);
  });
  
  const pages = [
    'http://localhost:3002/',
    'http://localhost:3002/login',
    'http://localhost:3002/register',
    'http://localhost:3002/appLayout',
    'http://localhost:3002/employee/dashboard',
    'http://localhost:3002/employee/shifts',
    'http://localhost:3002/admin/dashboard',
    'http://localhost:3002/admin/add-admin',
    'http://localhost:3002/admin/business-types',
    'http://localhost:3002/admin/companies',
    'http://localhost:3002/admin/employees',
    'http://localhost:3002/admin/monthly-sales',
    'http://localhost:3002/admin/payments',
    'http://localhost:3002/admin/pl-create',
    'http://localhost:3002/admin/sales-management',
    'http://localhost:3002/admin/shifts',
    'http://localhost:3002/admin/stores',
    'http://localhost:3002/admin/yearly-progress'
  ];
  
  for (const url of pages) {
    try {
      console.log(`\n=== Debugging: ${url} ===`);
      
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      const title = await page.title();
      console.log(`Page title: ${title}`);
      
      await page.waitForTimeout(3000);
      
      console.log('Page loaded successfully. Browser will stay open for debugging.');
      console.log('Press Ctrl+C to continue to next page or exit.');
      
      await new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', (key) => {
          if (key[0] === 3) { // Ctrl+C
            resolve();
          }
        });
      });
      
    } catch (error) {
      console.log(`Error loading ${url}: ${error.message}`);
    }
  }
  
  console.log('\nDebugging session completed. Browser will remain open.');
  console.log('Press Ctrl+C to close browser and exit.');
  
  await new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      if (key[0] === 3) { // Ctrl+C
        resolve();
      }
    });
  });
  
  await browser.close();
}

debugAllPages().catch(console.error);