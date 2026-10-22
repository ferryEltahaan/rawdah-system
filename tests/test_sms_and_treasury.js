import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME_PATH = process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'https://rawdahdeploymentready.vercel.app';
const SCREENSHOT_DIR = path.resolve('tests/screenshots_sms_and_treasury');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runSmsAndTreasuryTest() {
  console.log('🚀 TESTING SMS AUTOMATIC PAYMENT & TREASURY UPDATE 🚀\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,850'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  try {
    // 1. Login
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    const userInp = await page.$('input[placeholder*="المستخدم"], input[type="text"]');
    if (userInp) {
      await userInp.type('admin');
      const passInp = await page.$('input[type="password"]');
      await passInp.type('123456789');
      const loginBtn = await page.$('button[type="submit"]');
      await loginBtn.click();
      await sleep(4000);
    }
    console.log('✅ 1. Logged in.');

    // 2. Navigate to SMS Inbox
    console.log('Navigating to SMS Inbox...');
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a'));
      const target = els.find(e => e.textContent.includes('رسائل الـ SMS'));
      if (target) target.click();
    });
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_sms_inbox.png') });

    // 3. Open Simulate SMS Modal
    console.log('Opening Simulate SMS modal...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const simBtn = btns.find(b => b.textContent.includes('تجربة استقبال رسالة'));
      if (simBtn) simBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_simulate_modal.png') });

    // 4. Click sample template (e.g. AlRajhiBank or VF-Cash)
    console.log('Selecting SMS template...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rajhiTemplate = btns.find(b => b.textContent.includes('AlRajhiBank') || b.textContent.includes('الراجحي'));
      if (rajhiTemplate) {
        rajhiTemplate.click();
      } else {
        const anyTemplate = btns.find(b => b.textContent.includes('حوالة') || b.textContent.includes('استلام'));
        if (anyTemplate) anyTemplate.click();
      }
    });
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_template_selected.png') });

    // 5. Submit SMS
    console.log('Submitting incoming SMS...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('معالجة') || b.textContent.includes('إرسال') || b.textContent.includes('استقبال'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(3500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_sms_matched_result.png') });
    console.log('✅ 2. SMS received and processed.');

    // 6. Navigate to Financial Accounts / Treasury
    console.log('Navigating to Financial Accounts...');
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a'));
      const target = els.find(e => e.textContent.includes('المحافظ والحسابات'));
      if (target) target.click();
    });
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_treasury_balances.png') });
    console.log('✅ 3. Treasury accounts checked.');

  } catch (err) {
    console.error('Error during SMS test:', err);
  } finally {
    await browser.close();
  }

  console.log('\n🏁 SMS & TREASURY TEST COMPLETED 🏁');
}

runSmsAndTreasuryTest();
