import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME_PATH = process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'https://rawdahdeploymentready.vercel.app';
const SCREENSHOT_DIR = path.resolve('tests/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
  console.log('🚀 Starting Automated Live E2E Diagnostic Test...');
  console.log('Browser:', CHROME_PATH);
  console.log('Target:', APP_URL);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`Page Error: ${err.message}`);
  });

  try {
    // ── STEP 1: Load Login Page ──
    console.log('\n[1/6] Navigating to Login Page...');
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') });
    console.log('✅ Page loaded successfully.');

    // Check if we need to login
    const usernameInput = await page.$('input[type="text"], input[name="username"], input[placeholder*="المستخدم"]');
    if (usernameInput) {
      console.log('Found login form. Attempting login as admin...');
      await page.type('input[type="text"], input[name="username"], input[placeholder*="المستخدم"]', 'admin');
      
      const passwordInput = await page.$('input[type="password"]');
      if (passwordInput) {
        // Try password: 'password' first
        await passwordInput.type('password');
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) await submitBtn.click();
        
        await sleep(3000);
        
        // Check if error displayed
        const errorEl = await page.$('.bg-rose-50');
        if (errorEl) {
          console.log('Password "password" failed, trying "123456789"...');
          await passwordInput.click({ clickCount: 3 });
          await passwordInput.press('Backspace');
          await passwordInput.type('123456789');
          const submitBtn2 = await page.$('button[type="submit"]');
          if (submitBtn2) await submitBtn2.click();
          await sleep(3000);
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_after_login.png') });
    console.log('✅ Login step executed.');

    // ── STEP 2: Verify Dashboard ──
    console.log('\n[2/6] Verifying Dashboard & Navigation...');
    const pageContent = await page.content();
    const isLoggedIn = pageContent.includes('لوحة التحكم') || pageContent.includes('إدارة') || !usernameInput;
    console.log(`Is Logged In / Dashboard visible: ${isLoggedIn ? 'YES' : 'NO'}`);

    // ── STEP 3: Test Self-Registration URL ──
    console.log('\n[3/6] Testing Customer Self-Registration Link (?register=true)...');
    await page.goto(`${APP_URL}/?register=true`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_self_register_page.png') });

    const selfRegName = await page.$('input[placeholder*="الاسم"], input[name*="name"]');
    if (selfRegName) {
      console.log('Filling self-registration form...');
      await selfRegName.type('سلطان الشريف');
      
      const phoneInput = await page.$('input[type="tel"], input[placeholder*="جوال"], input[placeholder*="هاتف"]');
      if (phoneInput) await phoneInput.type('0559988776');
      
      const idInput = await page.$('input[placeholder*="هوية"], input[placeholder*="جواز"]');
      if (idInput) await idInput.type('1029384756');
      
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_self_register_filled.png') });

      const registerBtn = await page.$('button[type="submit"]');
      if (registerBtn) {
        await registerBtn.click();
        await sleep(3000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_self_register_submitted.png') });
        console.log('✅ Self-registration submitted.');
      }
    } else {
      console.log('⚠️ Could not find self-registration form inputs.');
    }

    // ── STEP 4: Return to Dashboard and Check Customers ──
    console.log('\n[4/6] Checking Customers CRM...');
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    const buttons = await page.$$('button, a');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('العملاء')) {
        await btn.click();
        await sleep(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_customers_crm.png') });
        console.log('✅ Navigated to Customers CRM.');
        break;
      }
    }

    // ── STEP 5: Check Permits Inventory ──
    console.log('\n[5/6] Checking Permits Inventory...');
    const buttons2 = await page.$$('button, a');
    for (const btn of buttons2) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('تصاريح') || text.includes('المخزون'))) {
        await btn.click();
        await sleep(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_permits_inventory.png') });
        console.log('✅ Navigated to Permits Inventory.');
        break;
      }
    }

    // ── STEP 6: Check Orders Management ──
    console.log('\n[6/6] Checking Orders Management...');
    const buttons3 = await page.$$('button, a');
    for (const btn of buttons3) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('الطلبات') || text.includes('الحجوزات'))) {
        await btn.click();
        await sleep(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_orders_management.png') });
        console.log('✅ Navigated to Orders Management.');
        break;
      }
    }

  } catch (err) {
    console.error('❌ Exception occurred during test:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log('\n=============================================');
  console.log('DIAGNOSTIC TEST COMPLETE');
  console.log('Screenshots saved in:', SCREENSHOT_DIR);
  if (errors.length > 0) {
    console.log(`\n⚠️ Detected ${errors.length} browser errors during test:`);
    errors.slice(0, 10).forEach(e => console.log('  -', e));
  } else {
    console.log('\n✨ Zero browser console/page errors detected!');
  }
  console.log('=============================================');
}

runTest();
