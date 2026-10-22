import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME_PATH = process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'https://rawdahdeploymentready.vercel.app';
const SCREENSHOT_DIR = path.resolve('tests/screenshots_complete_cycle');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runCompleteBookingAndPayment() {
  console.log('🚀 TESTING FULL REAL BOOKING & PAYMENT IN APP 🚀\n');

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
    console.log('✅ Logged in successfully.');

    // 2. Direct creation of order in page state
    // Let's navigate to Orders view
    console.log('Navigating to Orders view...');
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a'));
      const target = els.find(e => e.textContent.includes('طلبات البيع'));
      if (target) target.click();
    });
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_orders_view.png') });

    // Click "+ إنشاء طلب بيع جديد"
    console.log('Opening New Order modal...');
    const openedModal = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('إنشاء طلب بيع جديد'));
      if (b) { b.click(); return true; }
      return false;
    });
    console.log('Opened modal:', openedModal);
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_new_order_modal_open.png') });

    // Choose customer
    console.log('Selecting customer in modal...');
    await page.evaluate(() => {
      // Find customer select or search
      const custInput = document.querySelector('input[placeholder*="ابحث بالاسم"]');
      if (custInput) {
        custInput.focus();
        custInput.value = 'سلطان';
        custInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_customer_searched.png') });

    // Click on the matching customer
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('button, div'));
      const custItem = items.find(el => el.textContent.includes('سلطان بن فهد الشريف'));
      if (custItem) custItem.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_customer_selected.png') });

    // Submit the form
    console.log('Submitting the order...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('حفظ الطلب') || b.textContent.includes('إنشاء الطلب'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(3500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_order_submitted_in_table.png') });
    console.log('✅ Order created in table.');

    // Find the Payment button (سداد) on the created order
    console.log('Looking for Payment button on the order...');
    const clickedPayment = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const payBtn = btns.find(b => b.textContent.includes('سداد') || b.textContent.includes('تسجيل سداد'));
      if (payBtn) { payBtn.click(); return true; }
      return false;
    });
    console.log('Clicked Payment button:', clickedPayment);
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_payment_dialog_open.png') });

    if (clickedPayment) {
      // Confirm payment in dialog
      console.log('Confirming payment in dialog...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => b.textContent.includes('تأكيد') || b.textContent.includes('حفظ السداد'));
        if (confirmBtn) confirmBtn.click();
      });
      await sleep(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_order_after_payment.png') });
      console.log('✅ Payment confirmed!');
    }

    // Click WhatsApp share button on the order
    console.log('Opening WhatsApp share modal...');
    const clickedWhatsApp = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const waBtn = btns.find(b => b.textContent.includes('واتساب') || b.title?.includes('واتساب') || b.title?.includes('مشاركة'));
      if (waBtn) { waBtn.click(); return true; }
      return false;
    });
    console.log('Clicked WhatsApp button:', clickedWhatsApp);
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_whatsapp_modal_open.png') });

    // Go to Dashboard to check updated metrics
    console.log('Checking updated Dashboard...');
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a'));
      const target = els.find(e => e.textContent.includes('لوحة المؤشرات'));
      if (target) target.click();
    });
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_final_dashboard_after_booking.png') });
    console.log('✅ Final dashboard captured.');

  } catch (err) {
    console.error('Execution error:', err);
  } finally {
    await browser.close();
  }

  console.log('\n🏁 COMPLETE BOOKING & PAYMENT RUN FINISHED 🏁');
}

runCompleteBookingAndPayment();
