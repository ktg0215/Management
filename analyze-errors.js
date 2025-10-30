const fs = require('fs');
const report = JSON.parse(fs.readFileSync('test-screenshots/test-report.json', 'utf8'));

// Extract key console errors
console.log('=== KEY CONSOLE ERRORS ===\n');
const allPages = [...report.adminPages, ...report.employeePages];
const errorPatterns = {};

allPages.forEach(page => {
  page.consoleErrors.forEach(error => {
    const text = error.text || error.message || '';
    if (text && !text.includes('JSHandle')) {
      errorPatterns[text] = (errorPatterns[text] || 0) + 1;
    }
  });
});

Object.entries(errorPatterns).sort((a, b) => b[1] - a[1]).forEach(([error, count]) => {
  console.log(`[${count}x] ${error}`);
});

// Network errors
console.log('\n=== NETWORK ERRORS ===\n');
allPages.filter(p => p.networkErrors.length > 0).forEach(page => {
  console.log(`${page.name}:`);
  page.networkErrors.forEach(err => {
    console.log(`  - ${err.url}`);
    console.log(`    Method: ${err.method}`);
    console.log(`    Error: ${err.failure?.errorText || 'Unknown'}`);
  });
});

// Failed API requests
console.log('\n=== FAILED API REQUESTS ===\n');
allPages.forEach(page => {
  const failedRequests = page.networkRequests.filter(r => r.status >= 400);
  if (failedRequests.length > 0) {
    console.log(`${page.name}:`);
    failedRequests.forEach(req => {
      console.log(`  [${req.status}] ${req.method} ${req.url}`);
    });
  }
});

// Page load times
console.log('\n=== PAGE LOAD TIMES ===\n');
allPages.forEach(page => {
  console.log(`${page.name}: ${page.loadTime}ms`);
});
