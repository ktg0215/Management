const http = require('http');

// Test a specific page and extract error details
async function testPageDetailed(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Extract error message if present
        let errorMessage = null;
        let errorStack = null;

        // Look for Next.js error patterns
        const errorMatch = data.match(/<div[^>]*id="__next"[^>]*>([\s\S]*?)<\/div>/);
        if (errorMatch) {
          const content = errorMatch[1];

          // Extract error text
          const textMatch = content.match(/>([^<]+)</g);
          if (textMatch) {
            errorMessage = textMatch.map(m => m.replace(/[><]/g, '').trim()).filter(t => t.length > 0).join(' | ');
          }
        }

        // Look for script errors
        const scriptMatch = data.match(/self\.__next_f\.push\(\[1,"([^"]+)"\]\)/);
        if (scriptMatch) {
          try {
            const decoded = scriptMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
            if (decoded.includes('Error') || decoded.includes('error')) {
              errorStack = decoded;
            }
          } catch (e) {}
        }

        resolve({
          path,
          status: res.statusCode,
          headers: res.headers,
          contentLength: data.length,
          errorMessage,
          errorStack,
          hasNextData: data.includes('__NEXT_DATA__'),
          hasReactRoot: data.includes('id="__next"'),
          htmlSnippet: data.substring(0, 500)
        });
      });
    });

    req.on('error', (e) => {
      resolve({
        path,
        status: 'ERROR',
        error: e.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        path,
        status: 'TIMEOUT'
      });
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 詳細ページテスト（エラー情報抽出）\n');

  const testPaths = [
    '/admin/dashboard',
    '/admin/payments',
    '/admin/sales-management'
  ];

  for (const path of testPaths) {
    console.log('=' .repeat(80));
    console.log(`Testing: ${path}`);
    console.log('=' .repeat(80));

    const result = await testPageDetailed(path);

    console.log(`Status: ${result.status}`);
    console.log(`Content Length: ${result.contentLength} bytes`);
    console.log(`Has React Root: ${result.hasReactRoot}`);
    console.log(`Has Next Data: ${result.hasNextData}`);

    if (result.errorMessage) {
      console.log(`\n⚠️  Error Message:\n${result.errorMessage}`);
    }

    if (result.errorStack) {
      console.log(`\n📋 Error Stack:\n${result.errorStack.substring(0, 1000)}`);
    }

    console.log(`\n📄 HTML Snippet (first 500 chars):\n${result.htmlSnippet}`);
    console.log('\n');

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

main().catch(console.error);
