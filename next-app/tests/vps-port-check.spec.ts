import { test, expect } from '@playwright/test';

const VPS_IP = '160.251.207.87';

// Common ports to check
const ports = [
  { port: 80, protocol: 'http' },
  { port: 443, protocol: 'https' },
  { port: 3000, protocol: 'http' },
  { port: 3001, protocol: 'http' },
  { port: 3002, protocol: 'http' },
  { port: 8080, protocol: 'http' },
];

test('Check VPS ports for Next.js application', async ({ page }) => {
  console.log('=== Checking VPS ports for Next.js application ===\n');

  for (const { port, protocol } of ports) {
    const url = `${protocol}://${VPS_IP}:${port}`;
    console.log(`Checking: ${url}`);

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      const finalUrl = page.url();
      const status = response?.status() || 'unknown';
      const content = await page.content();
      const hasNextJs = content.includes('__NEXT') || content.includes('_next');
      const hasReact = content.includes('react') || content.includes('React');

      console.log(`  Status: ${status}`);
      console.log(`  Final URL: ${finalUrl}`);
      console.log(`  Has Next.js markers: ${hasNextJs}`);
      console.log(`  Has React markers: ${hasReact}`);
      console.log(`  Content length: ${content.length}`);

      if (hasNextJs || hasReact) {
        console.log(`  >>> FOUND potential Next.js app! <<<`);
        await page.screenshot({ path: `vps-port-${port}.png`, fullPage: true });
      }

      console.log('');
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : 'Connection failed'}`);
      console.log('');
    }
  }

  // Also check common subpaths on default
  console.log('\n=== Checking common paths on main URL ===\n');

  const basePaths = [
    '/login',
    '/admin',
    '/api/health',
    '/_next',
  ];

  for (const path of basePaths) {
    const url = `http://${VPS_IP}${path}`;
    console.log(`Checking: ${url}`);

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 8000
      });

      const finalUrl = page.url();
      const status = response?.status() || 'unknown';

      console.log(`  Status: ${status}`);
      console.log(`  Final URL: ${finalUrl}`);
      console.log('');
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : 'Connection failed'}`);
      console.log('');
    }
  }

  console.log('=== Port Check Complete ===');
});
