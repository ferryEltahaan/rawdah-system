import QRCode from 'qrcode';
import { Permit, Customer, SalesOrder, CompanySettings } from '../types';

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ORDER_STATUS_LABELS: Record<SalesOrder['orderStatus'], string> = {
  confirmed: 'مؤكد',
  searching: 'جاري البحث',
  unconfirmed: 'غير مؤكد',
  cancelled: 'ملغي',
};

const DELIVERY_STATUS_LABELS: Record<SalesOrder['deliveryStatus'], string> = {
  sent: 'تم إرساله للعميل',
  waiting: 'قيد الانتظار',
  not_sent: 'لم يتم الإرسال',
};

async function buildQrDataUrl(content: string): Promise<string> {
  try {
    return await QRCode.toDataURL(content, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    return '';
  }
}

export function openPrintWindow(title: string, bodyHtml: string): boolean {
  const printWindow = window.open('', '_blank', 'width=880,height=960');
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; background: #eef2f7; color: #0f172a; padding: 24px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 30px 32px; box-shadow: 0 14px 44px rgba(15, 23, 42, 0.1); }
  .doc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 3px solid #047857; padding-bottom: 16px; }
  .doc-head h1 { font-size: 21px; font-weight: 900; color: #065f46; }
  .doc-head .en { font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 0.4px; margin-top: 2px; }
  .doc-head .contact { font-size: 11px; color: #475569; margin-top: 6px; line-height: 1.7; }
  .logo { width: 74px; height: 74px; object-fit: contain; border-radius: 14px; border: 1px solid #e2e8f0; padding: 4px; background: #fff; }
  .title-band { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 20px 0 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 14px; padding: 12px 16px; }
  .title-band h2 { font-size: 15px; font-weight: 900; color: #065f46; }
  .title-band .order-no { font-size: 13px; font-weight: 700; color: #334155; white-space: nowrap; }
  .title-band .order-no strong { font-family: 'Courier New', monospace; color: #047857; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #e2e8f0; padding: 9px 12px; font-size: 12px; text-align: right; vertical-align: middle; }
  th { background: #f8fafc; color: #475569; font-weight: 700; width: 38%; }
  td { font-weight: 700; color: #0f172a; }
  .mono { font-family: 'Courier New', monospace; }
  .badge { display: inline-block; border-radius: 999px; padding: 3px 12px; font-size: 11px; font-weight: 800; }
  .badge-paid { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
  .badge-due { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .bottom { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 22px; }
  .qr-box { text-align: center; }
  .qr-box img { width: 132px; height: 132px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px; }
  .qr-box .qr-caption { font-size: 10px; color: #64748b; margin-top: 6px; font-weight: 700; }
  .notes { flex: 1; font-size: 11px; color: #475569; line-height: 1.9; }
  .notes .foot-note { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; color: #64748b; }
  .doc-meta { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .permit-image { width: 100%; border: 1px solid #e2e8f0; border-radius: 14px; margin-top: 18px; }
  .actions { max-width: 720px; margin: 18px auto 0; display: flex; gap: 10px; justify-content: center; }
  .actions button { font-family: inherit; font-size: 13px; font-weight: 800; border-radius: 12px; padding: 10px 26px; cursor: pointer; border: none; }
  .btn-print { background: #047857; color: #fff; }
  .btn-close { background: #fff; color: #334155; border: 1px solid #cbd5e1 !important; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; padding: 6px; max-width: 100%; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
${bodyHtml}
<div class="actions no-print">
  <button class="btn-print" onclick="window.print()">🖨️ طباعة</button>
  <button class="btn-close" onclick="window.close()">إغلاق</button>
</div>
<script>
  window.addEventListener('load', function () {
    var run = function () { setTimeout(function () { window.print(); }, 180); };
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); } else { run(); }
  });
</script>
</body>
</html>`);
  printWindow.document.close();
  return true;
}

function buildCompanyHeader(company: CompanySettings): string {
  const contactParts = [company.primaryPhone, company.whatsappNumber, company.email].filter(Boolean);
  return `
  <div class="doc-head">
    <div>
      <h1>${esc(company.companyNameAr)}</h1>
      ${company.companyNameEn ? `<div class="en">${esc(company.companyNameEn)}</div>` : ''}
      <div class="contact">
        ${contactParts.map(part => esc(part)).join(' • ')}<br />
        ${company.address ? esc(company.address) : ''}
        ${company.taxNumber ? `<br />الرقم الضريبي: <span class="mono">${esc(company.taxNumber)}</span>` : ''}
        ${company.commercialRegistry ? ` — السجل التجاري: <span class="mono">${esc(company.commercialRegistry)}</span>` : ''}
      </div>
    </div>
    ${company.logoUrl ? `<img class="logo" src="${esc(company.logoUrl)}" alt="شعار المؤسسة" />` : ''}
  </div>`;
}

function buildFooter(company: CompanySettings, issuerName: string): string {
  const issuedAt = new Date().toLocaleString('ar-SA', {
    timeZone: 'Asia/Riyadh',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  });
  return `
  <div class="doc-meta">
    <span>تاريخ الإصدار: ${esc(issuedAt)} — بتوقيت (Asia/Riyadh)</span>
    <span>أصدره: ${esc(issuerName)}</span>
  </div>`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  SAR: 'ر.س',
  EGP: 'ج.م',
  USD: '$',
  AED: 'د.إ',
};

export async function printOrderReceipt(order: SalesOrder, company: CompanySettings): Promise<boolean> {
  const currency = order.currency
    ? (CURRENCY_SYMBOLS[order.currency] || order.currency)
    : (CURRENCY_SYMBOLS[company.currency] || company.currency || 'ر.س');
  const isFullyPaid = order.paidAmount >= order.totalAmount && order.totalAmount > 0;

  const qrDataUrl = await buildQrDataUrl(
    `طلب رقم #${order.orderNumber}\nالعميل: ${order.customerName}\nالتاريخ: ${order.targetDate} - ${order.targetTime}\nعدد التصاريح: ${order.permitsCount}\nالإجمالي: ${order.totalAmount} ${currency}`
  );

  const bodyHtml = `
  <div class="sheet">
    ${buildCompanyHeader(company)}

    <div class="title-band">
      <h2>سند حجز طلب تصاريح زيارة الروضة الشريفة</h2>
      <div class="order-no">رقم الطلب: <strong>#${esc(order.orderNumber)}</strong></div>
    </div>

    <table>
      <tr><th>اسم العميل</th><td>${esc(order.customerName)}</td></tr>
      <tr><th>رقم الواتساب</th><td class="mono">${esc(order.customerWhatsapp)}</td></tr>
      <tr><th>نوع الحجز</th><td>${order.orderType === 'instant' ? 'فوري' : 'حجز موعد'}</td></tr>
      <tr><th>تاريخ الزيارة المطلوب</th><td class="mono">${esc(order.targetDate)}</td></tr>
      <tr><th>وقت الفترة</th><td class="mono">${esc(order.targetTime)}</td></tr>
      <tr><th>عدد التصاريح</th><td>${esc(order.permitsCount)} تصريح</td></tr>
      <tr><th>سعر التصريح الواحد</th><td class="mono">${esc(order.unitPrice)} ${esc(currency)}</td></tr>
      <tr><th>إجمالي المبلغ</th><td class="mono">${esc(order.totalAmount)} ${esc(currency)}</td></tr>
      <tr><th>المبلغ المدفوع</th><td class="mono">${esc(order.paidAmount)} ${esc(currency)}</td></tr>
      <tr>
        <th>حالة السداد</th>
        <td>
          ${isFullyPaid
            ? '<span class="badge badge-paid">مسدد بالكامل ✓</span>'
            : `<span class="badge badge-due">متبقي ${esc(order.remainingAmount)} ${esc(currency)}</span>`}
        </td>
      </tr>
      <tr><th>حالة الطلب</th><td>${esc(ORDER_STATUS_LABELS[order.orderStatus] ?? order.orderStatus)}</td></tr>
      <tr><th>موقف الإرسال للعميل</th><td>${esc(DELIVERY_STATUS_LABELS[order.deliveryStatus] ?? order.deliveryStatus)}</td></tr>
    </table>

    <div class="bottom">
      <div class="qr-box">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : ''}
        <div class="qr-caption">امسح الرمز للتحقق من بيانات الطلب</div>
      </div>
      <div class="notes">
        ${order.notes ? `<div><strong>ملاحظات:</strong> ${esc(order.notes)}</div>` : ''}
        ${company.invoiceFooterNote ? `<p class="foot-note">${esc(company.invoiceFooterNote)}</p>` : ''}
      </div>
    </div>

    ${buildFooter(company, order.createdBy)}
  </div>`;

  return openPrintWindow(`سند حجز الطلب #${order.orderNumber}`, bodyHtml);
}

export async function printPermit(
  permit: Permit,
  customer: Customer | undefined,
  company: CompanySettings
): Promise<boolean> {
  const customerName = customer?.fullName || permit.assignedCustomerName || '—';

  const qrDataUrl = await buildQrDataUrl(
    `تصريح رقم: ${permit.permitCode}\nالعميل: ${customerName}\nالتاريخ: ${permit.slotDate}\nالفترة: ${permit.slotFormatted}`
  );

  const bodyHtml = `
  <div class="sheet">
    ${buildCompanyHeader(company)}

    <div class="title-band">
      <h2>تصريح زيارة الروضة الشريفة</h2>
      <div class="order-no">رقم التصريح: <strong>${esc(permit.permitCode)}</strong></div>
    </div>

    <table>
      <tr><th>اسم العميل</th><td>${esc(customerName)}</td></tr>
      ${customer?.whatsappNumber ? `<tr><th>رقم الواتساب</th><td class="mono">${esc(customer.whatsappNumber)}</td></tr>` : ''}
      <tr><th>تاريخ الزيارة</th><td class="mono">${esc(permit.slotDate)}</td></tr>
      <tr><th>وقت الفترة</th><td class="mono">${esc(permit.slotFormatted)}</td></tr>
      <tr><th>حالة التصريح</th><td>${permit.status === 'assigned' ? 'مخصص للعميل — جاهز' : esc(permit.status)}</td></tr>
      <tr><th>سحب بواسطة</th><td>${esc(permit.assignedByUserName ?? '—')}</td></tr>
    </table>

    ${permit.imageUrl ? `<img class="permit-image" src="${esc(permit.imageUrl)}" alt="صورة التصريح" />` : ''}

    <div class="bottom">
      <div class="qr-box">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : ''}
        <div class="qr-caption">امسح الرمز للتحقق من بيانات التصريح</div>
      </div>
      <div class="notes">
        ${permit.notes ? `<div><strong>ملاحظات:</strong> ${esc(permit.notes)}</div>` : ''}
        ${company.invoiceFooterNote ? `<p class="foot-note">${esc(company.invoiceFooterNote)}</p>` : ''}
      </div>
    </div>

    ${buildFooter(company, permit.assignedByUserName ?? company.companyNameAr)}
  </div>`;

  return openPrintWindow(`تصريح ${permit.permitCode}`, bodyHtml);
}
