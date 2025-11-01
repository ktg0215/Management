const { chromium } = require('playwright');

async function inspectLoginPage() {
  console.log('Inspecting Login Page Structure\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.innerText,

        // Check for all input fields
        allInputs: Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className,
        })),

        // Check for buttons
        allButtons: Array.from(document.querySelectorAll('button')).map(btn => ({
          type: btn.type,
          text: btn.textContent.trim(),
          className: btn.className,
        })),

        // Check for forms
        allForms: Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action,
          method: form.method,
          inputCount: form.querySelectorAll('input').length,
        })),

        // Check for any visible text
        visibleText: document.body.innerText.trim(),

        // Check localStorage
        hasAuthToken: !!localStorage.getItem('auth-token'),

        // Check for specific selectors
        selectors: {
          'input[type="text"]': !!document.querySelector('input[type="text"]'),
          'input[type="password"]': !!document.querySelector('input[type="password"]'),
          'input[name="username"]': !!document.querySelector('input[name="username"]'),
          'input[name="password"]': !!document.querySelector('input[name="password"]'),
          'button[type="submit"]': !!document.querySelector('button[type="submit"]'),
          'form': !!document.querySelector('form'),
        },

        // Get HTML structure
        bodyHTML: document.body.innerHTML.substring(0, 2000),
      };

      return analysis;
    });

    // Take screenshot
    await page.screenshot({ path: '/c/job/project/login_inspection.png', fullPage: true });

    console.log('='.repeat(80));
    console.log('PAGE ANALYSIS');
    console.log('='.repeat(80));
    console.log(`Title: ${pageAnalysis.title}`);
    console.log(`URL: ${pageAnalysis.url}`);
    console.log(`Has Auth Token: ${pageAnalysis.hasAuthToken}`);
    console.log('');

    console.log('VISIBLE TEXT ON PAGE:');
    console.log('-'.repeat(80));
    console.log(pageAnalysis.visibleText.substring(0, 500));
    console.log('-'.repeat(80));
    console.log('');

    console.log('SELECTOR AVAILABILITY:');
    console.log('-'.repeat(80));
    Object.entries(pageAnalysis.selectors).forEach(([selector, found]) => {
      console.log(`${found ? '✅' : '❌'} ${selector}`);
    });
    console.log('-'.repeat(80));
    console.log('');

    console.log('ALL INPUT FIELDS:');
    console.log('-'.repeat(80));
    if (pageAnalysis.allInputs.length === 0) {
      console.log('❌ No input fields found!');
    } else {
      pageAnalysis.allInputs.forEach((input, i) => {
        console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
      });
    }
    console.log('-'.repeat(80));
    console.log('');

    console.log('ALL BUTTONS:');
    console.log('-'.repeat(80));
    if (pageAnalysis.allButtons.length === 0) {
      console.log('❌ No buttons found!');
    } else {
      pageAnalysis.allButtons.forEach((btn, i) => {
        console.log(`${i + 1}. Type: ${btn.type}, Text: "${btn.text}"`);
      });
    }
    console.log('-'.repeat(80));
    console.log('');

    console.log('ALL FORMS:');
    console.log('-'.repeat(80));
    if (pageAnalysis.allForms.length === 0) {
      console.log('❌ No forms found!');
    } else {
      pageAnalysis.allForms.forEach((form, i) => {
        console.log(`${i + 1}. Action: ${form.action}, Method: ${form.method}, Inputs: ${form.inputCount}`);
      });
    }
    console.log('-'.repeat(80));
    console.log('');

    console.log('BODY HTML (first 2000 chars):');
    console.log('-'.repeat(80));
    console.log(pageAnalysis.bodyHTML);
    console.log('-'.repeat(80));

    console.log('\n✅ Screenshot saved to: /c/job/project/login_inspection.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectLoginPage();
