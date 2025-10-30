const http = require('http');
const fs = require('fs');

async function testPage(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`\n=== Testing: ${path} ===`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);
        console.log(`Content-Length: ${data.length} bytes\n`);

        // Extract visible text content
        const match = data.match(/<h1[^>]*>([^<]+)<\/h1>/);
        if (match) {
          console.log(`H1 Content: ${match[1]}`);
        }

        // Look for 404 error
        if (data.includes('404') && data.includes('could not be found')) {
          console.log('❌ ERROR: 404 Page Not Found detected');

          // Check if it's rendering Next.js default 404
          const titleMatch = data.match(/<title>([^<]+)<\/title>/g);
          if (titleMatch) {
            console.log(`Titles found: ${titleMatch.join(', ')}`);
          }
        } else if (res.statusCode === 200) {
          console.log('✅ Page loaded successfully (status 200)');

          // Check for actual content
          if (data.includes('id="__next"') || data.includes('class="')) {
            console.log('✅ Contains React/Next.js content');
          }
        }

        // Save full HTML for inspection
        const filename = `test-output-${path.replace(/\//g, '-')}.html`;
        fs.writeFileSync(filename, data);
        console.log(`📄 Full HTML saved to: ${filename}\n`);

        resolve({ path, status: res.statusCode, hasError: data.includes('404') });
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Connection error for ${path}: ${e.message}`);
      resolve({ path, status: 'ERROR', error: e.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ path, status: 'TIMEOUT' });
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 Direct Page Testing with HTML Inspection\n');
  console.log('Testing pages that returned 404...\n');

  const results = [];

  // Test a few key pages
  const paths = [
    '/admin/dashboard',
    '/admin/payments',
    '/login'
  ];

  for (const path of paths) {
    const result = await testPage(path);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  results.forEach(r => {
    const icon = r.status === 200 && !r.hasError ? '✅' : '❌';
    console.log(`${icon} ${r.path}: ${r.status}${r.hasError ? ' (404 content)' : ''}`);
  });
}

main().catch(console.error);
