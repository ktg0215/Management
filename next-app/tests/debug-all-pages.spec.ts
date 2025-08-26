import { test, expect } from '@playwright/test';

const pages = [
  '/',
  '/login',
  '/register',
  '/appLayout',
  '/employee/dashboard',
  '/employee/shifts',
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

test.describe('All Pages Debug Session', () => {
  for (const page of pages) {
    test(`Debug page: ${page}`, async ({ page: browserPage }) => {
      console.log(`\n=== Debugging page: ${page} ===`);
      
      await browserPage.goto(page, { waitUntil: 'networkidle' });
      
      await browserPage.waitForTimeout(2000);
      
      const title = await browserPage.title();
      console.log(`Page title: ${title}`);
      
      await expect(browserPage).toHaveURL(new RegExp(`.*${page.replace('/', '\\/')}`));
      
      const errors = [];
      browserPage.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
          console.log(`Console error: ${msg.text()}`);
        }
      });
      
      browserPage.on('pageerror', error => {
        errors.push(error.message);
        console.log(`Page error: ${error.message}`);
      });
      
      await browserPage.waitForTimeout(3000);
      
      const screenshot = await browserPage.screenshot({ fullPage: true });
      console.log(`Screenshot taken for ${page}`);
      
      console.log(`=== Finished debugging page: ${page} ===\n`);
      
      await browserPage.waitForTimeout(1000);
    });
  }
});