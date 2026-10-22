import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'https://rawdahdeploymentready.vercel.app';

async function diagnoseNetwork() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  const failedRequests = [];
  page.on('response', async res => {
    if (res.status() >= 400) {
      let body = '';
      try { body = await res.text(); } catch(e) {}
      failedRequests.push({
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
        body: body.slice(0, 300)
      });
    }
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle2' });
  
  // Enter credentials
  const usernameInput = await page.$('input[placeholder*="المستخدم"], input[type="text"]');
  if (usernameInput) {
    await usernameInput.type('admin');
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) await passwordInput.type('123456789');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await new Promise(r => setTimeout(r, 4000));
  }

  await browser.close();

  console.log('Failed Requests Count:', failedRequests.length);
  failedRequests.forEach((req, idx) => {
    console.log(`\n[${idx + 1}] Status ${req.status}: ${req.url}`);
    console.log(`Response: ${req.body}`);
  });
}

diagnoseNetwork();
