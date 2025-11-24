import { test, expect } from '@playwright/test';

const VPS_URL = 'https://edwtoyama.com';

test('Debug VPS page structure', async ({ page }) => {
  console.log('=== Navigating to VPS ===');
  await page.goto(VPS_URL, { waitUntil: 'networkidle', timeout: 30000 });

  await page.screenshot({ path: 'vps-debug-01-initial.png', fullPage: true });

  console.log(`URL: ${page.url()}`);

  // Get all form elements
  const inputs = await page.locator('input').all();
  console.log(`\nFound ${inputs.length} input elements:`);
  for (let i = 0; i < inputs.length; i++) {
    const type = await inputs[i].getAttribute('type');
    const name = await inputs[i].getAttribute('name');
    const id = await inputs[i].getAttribute('id');
    const placeholder = await inputs[i].getAttribute('placeholder');
    console.log(`  Input ${i}: type=${type}, name=${name}, id=${id}, placeholder=${placeholder}`);
  }

  // Get all buttons
  const buttons = await page.locator('button').all();
  console.log(`\nFound ${buttons.length} button elements:`);
  for (let i = 0; i < buttons.length; i++) {
    const type = await buttons[i].getAttribute('type');
    const text = await buttons[i].textContent();
    console.log(`  Button ${i}: type=${type}, text="${text}"`);
  }

  // Get all clickable elements
  const clickables = await page.locator('input[type="submit"], button, [role="button"]').all();
  console.log(`\nFound ${clickables.length} clickable elements`);

  // Try to find submit by different methods
  const submitByText = await page.locator('text=submit').count();
  const submitByRole = await page.locator('[type="submit"]').count();
  console.log(`\nSubmit search: by text=${submitByText}, by type=${submitByRole}`);

  // Get full HTML body
  const bodyHTML = await page.locator('body').innerHTML();
  console.log(`\nBody HTML length: ${bodyHTML.length}`);
  console.log(`\nFirst 2000 chars of body:\n${bodyHTML.substring(0, 2000)}`);

  // If we found inputs, try to interact
  if (inputs.length >= 2) {
    console.log('\n=== Attempting to fill form ===');

    await inputs[0].fill('admin@example.com');
    await inputs[1].fill('admin123');

    await page.screenshot({ path: 'vps-debug-02-filled.png', fullPage: true });

    // Try clicking different ways
    const submitInput = page.locator('input[type="submit"]');
    const submitButton = page.locator('button[type="submit"]');
    const anyButton = page.locator('button');

    if (await submitInput.count() > 0) {
      console.log('Clicking input[type="submit"]');
      await submitInput.click();
    } else if (await submitButton.count() > 0) {
      console.log('Clicking button[type="submit"]');
      await submitButton.click();
    } else if (await anyButton.count() > 0) {
      console.log('Clicking first button');
      await anyButton.first().click();
    } else {
      // Try pressing Enter
      console.log('Pressing Enter key');
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'vps-debug-03-after-submit.png', fullPage: true });

    console.log(`URL after submit: ${page.url()}`);
  }

  console.log('\n=== Debug Complete ===');
});
