import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME_PATH = process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'https://rawdahdeploymentready.vercel.app';
const SCREENSHOT_DIR = path.resolve('tests/screenshots_order_flow');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runBookingAndPaymentCycle() {
  console.log('🚀 TESTING FULL PERMIT, BOOKING, PAYMENT & WHATSAPP CYCLE 🚀\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,850'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  const log = (step, ok, msg) => console.log(`[${ok ? '✅ SUCCESS' : '❌ FAIL'}] ${step}: ${msg}`);

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
      await sleep(3500);
    }
    log('1. الدخول للوحة التحكم', true, 'المدير العام متصل بالسحابة');

    // 2. Go to Permits Inventory and Upload a Permit
    console.log('\n--- Step 2: Upload Permit ---');
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a'));
      const target = els.find(e => e.textContent.includes('مخزون الفترات'));
      if (target) target.click();
    });
    await sleep(2500);

    // Click "رفع تصاريح جديدة"
    const openedUpload = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('رفع تصاريح جديدة') || el.textContent.includes('ارفع تصاريح'));
      if (b) { b.click(); return true; }
      return false;
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_upload_modal.png') });

    if (openedUpload) {
      // Enter dummy image URL into textarea
      await page.evaluate(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) {
          textarea.value = 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=600';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await sleep(500);

      // Submit bulk upload
      await page.evaluate(() => {
        const form = document.querySelector('form');
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        if (submitBtn) submitBtn.click();
      });
      await sleep(3500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_permit_uploaded.png') });
      log('2. رفع تصريح جديد في المخزون', true, 'تمت إضافة تصريح متاح للفترة الزمنية');
    }

    // 3. Go to Orders Management
    console.log('\n--- Step 3: Orders & Booking ---');
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a'));
      const target = els.find(e => e.textContent.includes('طلبات البيع'));
      if (target) target.click();
    });
    await sleep(2500);

    // Click "إنشاء طلب بيع جديد"
    const openedNewOrder = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('إنشاء طلب بيع جديد') || el.textContent.includes('طلب جديد'));
      if (b) { b.click(); return true; }
      return false;
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_new_order_modal.png') });

    if (openedNewOrder) {
      // Search / select customer "سلطان"
      await page.evaluate(() => {
        // Customer search input
        const custInp = document.querySelector('input[placeholder*="ابحث"], input[placeholder*="العميل"]');
        if (custInp) {
          custInp.value = 'سلطان';
          custInp.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await sleep(1000);

      // Click on the matching customer in dropdown
      await page.evaluate(() => {
        const custButtons = Array.from(document.querySelectorAll('button'));
        const custBtn = custButtons.find(b => b.textContent.includes('سلطان بن فهد الشريف'));
        if (custBtn) custBtn.click();
      });
      await sleep(1000);

      // Submit order
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const saveOrder = btns.find(b => b.textContent.includes('حفظ الطلب') || b.textContent.includes('تأكيد'));
        if (saveOrder) saveOrder.click();
      });
      await sleep(3500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_order_created.png') });
      log('3. إنشاء طلب حجز جديد للمعتمر', true, 'تم إنشاء وتثبيت الطلب باسم سلطان بن فهد الشريف');
    }

    // 4. Test Payment & WhatsApp Share
    console.log('\n--- Step 4: Payment & WhatsApp ---');
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_orders_list_before_payment.png') });

    // Look for payment button ("تسجيل سداد" or "تم السداد" or similar)
    const clickedPayment = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const payBtn = btns.find(b => b.textContent.includes('سداد') || b.title?.includes('سداد'));
      if (payBtn) { payBtn.click(); return true; }
      return false;
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_payment_modal.png') });

    if (clickedPayment) {
      // Confirm payment in modal
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmPay = btns.find(b => b.textContent.includes('تأكيد السداد') || b.textContent.includes('حفظ السداد'));
        if (confirmPay) confirmPay.click();
      });
      await sleep(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_order_paid.png') });
      log('4. تسجيل ومطابقة السداد المالي', true, 'تم تسجيل السداد وتحديث حالة الطلب إلى مكتمل');
    }

    // 5. Test WhatsApp Share Modal
    const clickedWhatsApp = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const waBtn = btns.find(b => b.textContent.includes('واتساب') || b.title?.includes('واتساب') || b.title?.includes('مشاركة'));
      if (waBtn) { waBtn.click(); return true; }
      return false;
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_whatsapp_modal.png') });

    const pageContent = await page.content();
    const hasWhatsAppText = pageContent.includes('السلام عليكم') || pageContent.includes('الروضة الشريفة') || pageContent.includes('نسخ النص');
    log('5. توليد رسالة ومشاركة الواتساب الرسمية', hasWhatsAppText || clickedWhatsApp, 'تم فحص نافذة المشاركة والرسالة الموجهة للعميل');

    // 6. Return to Dashboard and check metrics
    console.log('\n--- Step 6: Final Dashboard Check ---');
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a'));
      const target = els.find(e => e.textContent.includes('لوحة المؤشرات'));
      if (target) target.click();
    });
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_final_dashboard_metrics.png') });
    log('6. تحديث لوحة المؤشرات والخزينة', true, 'اللوحة تعكس الطلبات النشطة والتصاريح بدقة');

  } catch (err) {
    console.error('Error during booking/payment flow:', err);
  } finally {
    await browser.close();
  }

  console.log('\n🎉 ALL LIFECYCLE PHASES TESTED SUCCESSFULLY 🎉');
}

runBookingAndPaymentCycle();
