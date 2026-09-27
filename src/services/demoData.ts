import {
  Customer,
  Permit,
  SalesOrder,
  SmsMessage,
  FinancialAccount,
  AuditLog,
  AccountProvider,
  CurrencyCode,
} from '../types';
import { initialFinancialAccounts } from './mockData';

// ==============================================================================
// مولّد التجربة الحية الشاملة — بيانات واقعية متسقة تعمل على كل الشاشات
// ==============================================================================

const pad = (n: number) => String(n).padStart(2, '0');

// التاريخ بتوقيت الرياض بصيغة YYYY-MM-DD مع إمكانية الإزاحة بالأيام
export function riyadhDate(offsetDays = 0): string {
  const base = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }));
  base.setDate(base.getDate() + offsetDays);
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const hoursAgo = (h: number): string => new Date(Date.now() - h * 3600 * 1000).toISOString();
const daysAgo = (d: number, hour = 10): string => {
  const t = new Date(Date.now() - d * 86400 * 1000);
  t.setHours(hour, (d * 13) % 55, 0, 0);
  return t.toISOString();
};

// صورة تصريح placeholder أنيقة (SVG data URI) حتى تعرض البطاقات بشكل احترافي
function permitImage(code: string, slot: string, date: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#064e3b"/><stop offset="1" stop-color="#0f766e"/>` +
    `</linearGradient></defs>` +
    `<rect width="640" height="400" fill="url(#g)"/>` +
    `<path d="M270 120 Q320 40 370 120 L370 200 L270 200 Z" fill="#d4af37" opacity="0.9"/>` +
    `<circle cx="320" cy="130" r="14" fill="#064e3b"/>` +
    `<text x="320" y="250" font-family="Tahoma,Arial" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle">تصريح زيارة الروضة الشريفة</text>` +
    `<text x="320" y="295" font-family="monospace" font-size="22" fill="#a7f3d0" text-anchor="middle">${code}</text>` +
    `<text x="320" y="335" font-family="monospace" font-size="20" fill="#fde68a" text-anchor="middle">${date} — ${slot}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface DemoDataset {
  customers: Customer[];
  permits: Permit[];
  orders: SalesOrder[];
  smsMessages: SmsMessage[];
  financialAccounts: FinancialAccount[];
  auditLogs: AuditLog[];
}

export function buildDemoDataset(): DemoDataset {
  const today = riyadhDate(0);
  const tomorrow = riyadhDate(1);
  const dayAfter = riyadhDate(2);
  const yesterday = riyadhDate(-1);
  const threeDaysAgo = riyadhDate(-3);

  // هوية الموظفين الفعليين — نفس معرّفات UUID المخزنة في جدول profiles
  const USERS = {
    admin: { id: 'fe292e3d-9509-43d6-9561-aba950cb8540', name: 'المدير العام' },
    sales: { id: 'e48d53af-a5ae-49b2-a5ef-e91307ed02db', name: 'موظف المبيعات' },
    inventory: { id: 'e3d8cda3-8752-41ef-aaf2-a5694549088c', name: 'مسؤول المخزون والتصاريح' },
    accountant: { id: 'e3faa12e-0e95-4b05-bbd3-6ed8993d7ebc', name: 'المحاسب المالي' },
    sara: { id: '2af77703-0fb8-4ed4-bd5c-98e4142baa4b', name: 'سارة المطيري' },
  };

  // ---------------------------------------------------------------------------
  // 1) العملاء (8)
  // ---------------------------------------------------------------------------
  const customers: Customer[] = [
    { id: uuid(), fullName: 'أبو محمد الأنصاري', whatsappNumber: '+966501112233', nickname: 'أبو محمد (مكرر)', notes: 'عميل دائم، يفضل الفترات المسائية', totalOrdersCount: 0, totalSpent: 0, createdAt: daysAgo(18, 11) },
    { id: uuid(), fullName: 'أم عبدالله القحطاني', whatsappNumber: '+966554443322', nickname: 'أم عبدالله', notes: '', totalOrdersCount: 0, totalSpent: 0, createdAt: daysAgo(15, 12) },
    { id: uuid(), fullName: 'عبدالرحمن الشهري', whatsappNumber: '+966509998877', nickname: 'أبو راكان', notes: 'يطلب دائماً فترتين متتاليتين', totalOrdersCount: 0, totalSpent: 0, createdAt: daysAgo(12, 9) },
    { id: uuid(), fullName: 'عائلة الدوسري (4 أفراد)', whatsappNumber: '+966567778899', nickname: 'العائلة', notes: 'مجموعة عائلية — 4 تصاريح', totalOrdersCount: 0, totalSpent: 0, createdAt: daysAgo(9, 14) },
    { id: uuid(), fullName: 'الحاجة فاطمة الزهراني', whatsappNumber: '+966512345678', nickname: 'الحاجة فاطمة', notes: 'كبيرة في السن — تحتاج متابعة خاصة', totalOrdersCount: 0, totalSpent: 0, createdAt: daysAgo(7, 10) },
    { id: uuid(), fullName: 'أبو يوسف الغامدي', whatsappNumber: '+966598765432', nickname: 'أبو يوسف', notes: '', totalOrdersCount: 0, totalSpent: 0, createdAt: daysAgo(5, 16) },
    { id: uuid(), fullName: 'سارة العتيبي', whatsappNumber: '+966543216789', nickname: 'سارة', notes: 'ألغت حجزها سابقاً لظرف طارئ', totalOrdersCount: 0, totalSpent: 0, createdAt: daysAgo(3, 13) },
    { id: uuid(), fullName: 'مجموعة حجاج مصر (6 أفراد)', whatsappNumber: '+201012345678', nickname: 'القاهرة', notes: 'مجموعة سياحية — تدفع بالتحويل الدولي', totalOrdersCount: 0, totalSpent: 0, createdAt: daysAgo(1, 17) },
  ];
  const cust = (i: number) => customers[i];

  // ---------------------------------------------------------------------------
  // 2) الطلبات (9) — بحالات وسداد وتسليم متنوعة
  // ---------------------------------------------------------------------------
  const UNIT = 150;
  const mkOrder = (
    orderNumber: number,
    customerIdx: number,
    permitsCount: number,
    targetDate: string,
    targetTime: string,
    orderType: SalesOrder['orderType'],
    orderStatus: SalesOrder['orderStatus'],
    deliveryStatus: SalesOrder['deliveryStatus'],
    paidAmount: number,
    notes: string,
    createdBy: string,
    createdAt: string,
    currency: SalesOrder['currency'] = 'SAR',
    extra: Partial<SalesOrder> = {}
  ): SalesOrder => {
    const c = cust(customerIdx);
    const totalAmount = permitsCount * UNIT;
    return {
      id: uuid(),
      orderNumber,
      customerId: c.id,
      customerName: c.fullName,
      customerWhatsapp: c.whatsappNumber,
      permitsCount,
      targetDate,
      targetTime,
      orderType,
      orderStatus,
      deliveryStatus,
      currency,
      unitPrice: UNIT,
      totalAmount,
      paidAmount,
      remainingAmount: Math.max(0, totalAmount - paidAmount),
      notes,
      createdBy,
      createdAt,
      ...extra,
    };
  };

  const orders: SalesOrder[] = [
    mkOrder(1001, 0, 3, today, '14:00', 'instant', 'confirmed', 'sent', 450, 'حجز فوري — دفع كامل', USERS.sales.name, hoursAgo(5)),
    mkOrder(1002, 1, 2, today, '17:20', 'instant', 'confirmed', 'sent', 300, '', USERS.sales.name, hoursAgo(4), 'EGP'),
    mkOrder(1003, 2, 4, tomorrow, '09:00', 'scheduled', 'searching', 'not_sent', 0, 'في انتظار تحويل الحوالة', USERS.sales.name, hoursAgo(3)),
    mkOrder(1004, 3, 4, today, '20:00', 'instant', 'confirmed', 'waiting', 500, 'دفعة أولى 500 — الباقي عند الاستلام', USERS.admin.name, hoursAgo(2.5), 'EGP'),
    mkOrder(1005, 4, 1, dayAfter, '10:00', 'scheduled', 'unconfirmed', 'waiting', 150, 'عربون حجز موعد', USERS.sales.name, hoursAgo(2), 'EGP'),
    mkOrder(1006, 5, 2, today, '22:00', 'instant', 'confirmed', 'sent', 300, '', USERS.sales.name, hoursAgo(1.5)),
    mkOrder(1007, 6, 1, today, '02:00', 'instant', 'cancelled', 'not_sent', 0, 'ألغى العميل لظرف طارئ', USERS.sales.name, hoursAgo(8)),
    mkOrder(1008, 7, 6, tomorrow, '15:00', 'scheduled', 'searching', 'not_sent', 0, 'مجموعة — مطلوب 3 فترات متجاورة', USERS.admin.name, hoursAgo(1)),
    mkOrder(1009, 0, 1, today, '05:20', 'instant', 'confirmed', 'sent', 150, 'حجز فجر — دفع كامل', USERS.sales.name, hoursAgo(10), 'EGP'),
    // مكتملان ومؤرشفان تلقائياً (اكتمل السداد وانقضى الموعد)
    mkOrder(1010, 2, 2, yesterday, '21:00', 'instant', 'confirmed', 'sent', 300, 'اكتمل السداد — أُرشف تلقائياً', USERS.sales.name, daysAgo(2, 10), 'SAR', { isArchived: true, archivedAt: daysAgo(1, 6) }),
    mkOrder(1011, 6, 1, threeDaysAgo, '16:40', 'instant', 'confirmed', 'sent', 150, 'زيارة مكتملة — أُرشف تلقائياً', USERS.sara.name, daysAgo(4, 13), 'SAR', { isArchived: true, archivedAt: daysAgo(3, 7) }),
  ];

  // إحصاءات العملاء المشتقة من الطلبات الفعلية (الملغي لا يُحتسب)
  orders.forEach((o) => {
    if (o.orderStatus === 'cancelled') return;
    const c = customers.find((x) => x.id === o.customerId);
    if (c) {
      c.totalOrdersCount += 1;
      c.totalSpent += o.totalAmount;
    }
  });

  // ---------------------------------------------------------------------------
  // 3) التصاريح (90) — موزعة على 3 أيام × فترات اليوم الـ 72
  // ---------------------------------------------------------------------------
  // [التاريخ، الساعة، عدد التصاريح بكل فترة فرعية :00/:20/:40]
  const slotPlan: Array<[string, number, number[]]> = [
    [today, 0, [3, 2, 3]],
    [today, 2, [2, 2, 0]],
    [today, 5, [3, 2, 0]],
    [today, 14, [3, 3, 2]],
    [today, 17, [2, 2, 0]],
    [today, 20, [3, 2, 3]],
    [today, 22, [2, 0, 0]],
    [tomorrow, 6, [3, 2, 0]],
    [tomorrow, 9, [2, 3, 2]],
    [tomorrow, 12, [3, 2, 0]],
    [tomorrow, 15, [2, 2, 3]],
    [tomorrow, 18, [3, 2, 0]],
    [dayAfter, 7, [2, 3, 0]],
    [dayAfter, 10, [3, 2, 0]],
    [dayAfter, 16, [2, 2, 3]],
    [dayAfter, 19, [3, 2, 0]],
  ];

  const permits: Permit[] = [];
  slotPlan.forEach(([date, hour, counts]) => {
    const minutes = [0, 20, 40];
    counts.forEach((count, mi) => {
      if (count <= 0) return;
      const minute = minutes[mi];
      const slot = `${pad(hour)}:${pad(minute)}`;
      for (let seq = 1; seq <= count; seq++) {
        permits.push({
          id: uuid(),
          permitCode: `PERMIT-${pad(hour)}${pad(minute)}-${seq}`,
          slotDate: date,
          slotHour: hour,
          slotMinute: minute,
          slotFormatted: slot,
          imageUrl: permitImage(`PERMIT-${pad(hour)}${pad(minute)}-${seq}`, slot, date),
          status: 'available',
          notes: '',
          createdAt: hoursAgo(20),
        });
      }
    });
  });

  const findPermit = (date: string, hour: number, minute: number, seq: number): Permit | undefined =>
    permits.find((p) => p.slotDate === date && p.slotHour === hour && p.slotMinute === minute && p.permitCode.endsWith(`-${seq}`));

  const assign = (p: Permit | undefined, customerIdx: number, by: keyof typeof USERS, at: string) => {
    if (!p) return;
    const u = USERS[by];
    const c = cust(customerIdx);
    p.status = 'assigned';
    p.assignedToCustomerId = c.id;
    p.assignedCustomerName = c.fullName;
    p.assignedByUserId = u.id;
    p.assignedByUserName = u.name;
    p.assignedAt = at;
  };
  const lock = (p: Permit | undefined, by: keyof typeof USERS, at: string) => {
    if (!p) return;
    p.status = 'locked';
    p.lockedByUserId = USERS[by].id;
    p.lockedAt = at;
  };

  // تخصيصات مرتبطة بالطلبات — كل سحب يوثق ربط الطلب بالتصاريح (order_permits)
  const claimFor = (
    orderNumber: number,
    customerIdx: number,
    by: keyof typeof USERS,
    at: string,
    refs: Array<[string, number, number, number]>
  ) => {
    const ids: string[] = [];
    refs.forEach(([date, hour, minute, seq]) => {
      const p = findPermit(date, hour, minute, seq);
      assign(p, customerIdx, by, at);
      if (p) ids.push(p.id);
    });
    const targetOrder = orders.find((x) => x.orderNumber === orderNumber);
    if (targetOrder) targetOrder.assignedPermitIds = ids;
  };

  claimFor(1009, 0, 'sales', hoursAgo(9.5), [[today, 5, 20, 1]]);
  claimFor(1001, 0, 'sales', hoursAgo(4.8), [[today, 14, 0, 1], [today, 14, 0, 2], [today, 14, 20, 1]]);
  claimFor(1002, 1, 'sales', hoursAgo(3.8), [[today, 17, 20, 1], [today, 17, 20, 2]]);
  claimFor(1004, 3, 'admin', hoursAgo(2.4), [[today, 20, 0, 1], [today, 20, 0, 2], [today, 20, 0, 3], [today, 20, 20, 1]]);
  claimFor(1005, 4, 'sales', hoursAgo(1.9), [[dayAfter, 10, 0, 1]]);
  claimFor(1006, 5, 'sales', hoursAgo(1.4), [[today, 22, 0, 1], [today, 22, 0, 2]]);

  // مقفولة: موظف المبيعات يمنع التعارض أثناء البحث لطلب عبدالرحمن (غداً 09:00)
  lock(findPermit(tomorrow, 9, 0, 1), 'sales', hoursAgo(2.8));
  lock(findPermit(tomorrow, 9, 0, 2), 'sales', hoursAgo(2.8));
  // مقفولة لطلب المجموعة (غداً 15:00) أثناء البحث
  lock(findPermit(tomorrow, 15, 0, 1), 'admin', hoursAgo(0.9));
  lock(findPermit(tomorrow, 15, 0, 2), 'admin', hoursAgo(0.9));
  // مقفولة من مسؤول المخزون أثناء المراجعة (اليوم 20:40)
  lock(findPermit(today, 20, 40, 1), 'inventory', hoursAgo(0.5));

  // أُرجعت بعد إلغاء الطلب 1007
  const returned = findPermit(today, 2, 0, 1);
  if (returned) returned.status = 'returned';

  // ---------------------------------------------------------------------------
  // 4) رسائل SMS (9) — بصيغة تفهمها محللت parseSmsText
  // ---------------------------------------------------------------------------
  const mkSms = (
    sender: string,
    body: string,
    amount: number,
    provider: SmsMessage['parsedProvider'],
    status: SmsMessage['status'],
    receivedAgoH: number,
    matchedOrder?: SalesOrder,
    matchedAgoH?: number
  ): SmsMessage => {
    const refMatch = body.match(/رقم العملية:\s*([A-Za-z0-9]+)/);
    const s: SmsMessage = {
      id: uuid(),
      sender,
      rawBody: body,
      parsedAmount: amount,
      parsedReferenceId: refMatch ? refMatch[1] : `TXN${Math.floor(10000000 + Math.random() * 89999999)}`,
      parsedAccountNumber: '01000000000',
      parsedProvider: provider,
      status,
      receivedAt: hoursAgo(receivedAgoH),
    };
    if (matchedOrder && matchedAgoH !== undefined) {
      s.matchedOrderId = matchedOrder.id;
      s.matchedOrderNumber = matchedOrder.orderNumber;
      s.matchedByUserId = USERS.accountant.id;
      s.matchedAt = hoursAgo(matchedAgoH);
    }
    return s;
  };

  const o = (n: number) => orders.find((x) => x.orderNumber === n)!;

  const smsMessages: SmsMessage[] = [
    mkSms('AlRajhi', `مصرف الراجحي: تم استلام تحويل بمبلغ: 450.00 ر.س من ${cust(0).fullName} رقم العملية: TXN45120087 على حسابك 482000000000000`, 450, 'al_rajhi', 'matched', 5, o(1001), 4.5),
    mkSms('Vodafone EG', `Vodafone Cash: استلام مبلغ: 300 جنيه من ${cust(1).whatsappNumber} رقم العملية: VF88342101`, 300, 'vodafone_cash', 'matched', 4, o(1002), 3.5),
    mkSms('InstaPay', `InstaPay: You have received 500 EGP from ${cust(3).whatsappNumber} رقم العملية: IP55210043`, 500, 'instapay', 'matched', 2.4, o(1004), 2),
    mkSms('SNB-AlAhli', `البنك الأهلي: تم استلام تحويل بمبلغ: 300.00 ر.س رقم العملية: AH99812344`, 300, 'al_ahli', 'matched', 1.4, o(1006), 1),
    mkSms('Vodafone EG', `Vodafone Cash: استلام مبلغ: 150 جنيه رقم العملية: VF99120033`, 150, 'vodafone_cash', 'matched', 9.8, o(1009), 9.3),
    mkSms('InstaPay', `InstaPay: received 150 EGP رقم العملية: IP77203451`, 150, 'instapay', 'matched', 1.9, o(1005), 1.5),
    // غير مطابقة — تنتظر محاسباً
    mkSms('AlRajhi', `مصرف الراجحي: تم استلام تحويل بمبلغ: 600.00 ر.س من ${cust(2).fullName} رقم العملية: TXN77881209`, 600, 'al_rajhi', 'unmatched', 0.8),
    mkSms('InstaPay', `InstaPay: You have received 750 EGP رقم العملية: IP66120098`, 750, 'instapay', 'unmatched', 0.5),
    mkSms('Vodafone EG', `Vodafone Cash: استلام مبلغ: 225 جنيه رقم العملية: VF55120076`, 225, 'vodafone_cash', 'unmatched', 0.2),
  ];

  // ---------------------------------------------------------------------------
  // 5) الحسابات المالية — 4 حسابات بأرصدة = مجموع المطابق من كل محفظة
  // ---------------------------------------------------------------------------
  const sumMatched = (provider: SmsMessage['parsedProvider']) =>
    smsMessages.filter((s) => s.status === 'matched' && s.parsedProvider === provider).reduce((acc, s) => acc + (s.parsedAmount || 0), 0);

  const financialAccounts: FinancialAccount[] = [
    { ...initialFinancialAccounts[0], id: uuid(), currency: 'EGP', currentBalance: sumMatched('vodafone_cash'), notes: 'رصيد تجريبي من المطابقات' },
    { ...initialFinancialAccounts[1], id: uuid(), currency: 'EGP', currentBalance: sumMatched('instapay') },
    {
      ...initialFinancialAccounts[2],
      id: uuid(),
      currency: 'SAR',
      branchName: 'فرع المدينة المنورة — شارع قباء',
      currentBalance: sumMatched('al_rajhi'),
    },
    {
      id: uuid(),
      type: 'bank',
      provider: 'al_ahli',
      accountName: 'البنك الأهلي السعودي',
      accountNumber: 'SA4410000068240001234567',
      accountHolderName: 'مؤسسة حجز التصاريح',
      iban: 'SA4410000068240001234567',
      branchName: 'فرع المدينة المنورة — المنطقة المركزية',
      currency: 'SAR',
      currentBalance: sumMatched('al_ahli'),
      isActive: true,
      notes: '',
      createdAt: daysAgo(30, 9),
    },
    {
      id: uuid(),
      type: 'bank',
      provider: 'other',
      accountName: 'بنك مصر — حساب الشركة',
      accountNumber: 'EG3800030000123456789012',
      accountHolderName: 'مؤسسة حجز التصاريح',
      iban: 'EG3800030000123456789012',
      branchName: 'فرع القاهرة — وسط البلد',
      currency: 'EGP',
      currentBalance: 2500,
      isActive: true,
      notes: 'حساب تحويلات العملاء المصريين',
      createdAt: daysAgo(45, 9),
    },
  ];

  // ---------------------------------------------------------------------------
  // 6) سجل التدقيق — قصة يوم كامل من العمليات
  // ---------------------------------------------------------------------------
  const log = (
    user: keyof typeof USERS,
    actionType: AuditLog['actionType'],
    entityName: string,
    entityId: string,
    details: Record<string, any>,
    createdAt: string
  ): AuditLog => ({
    id: uuid(),
    userId: USERS[user].id,
    userName: USERS[user].name,
    actionType,
    entityName,
    entityId,
    details,
    createdAt,
  });

  const per = (date: string, hour: number, minute: number, seq: number) =>
    findPermit(date, hour, minute, seq)?.id || uuid();

  const auditLogs: AuditLog[] = [
    log('inventory', 'UPLOAD_PERMITS', 'permits', permits[0]?.id || uuid(), { count: 90, note: 'رفع مخزون 3 أيام كاملاً' }, hoursAgo(20)),
    log('inventory', 'DELETE_PERMIT', 'permits', uuid(), { permitCode: 'PERMIT-1940-2', reason: 'صورة غير مقروءة — أُعيد رفعها' }, hoursAgo(12)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1009).id, { orderNumber: 1009, customerName: cust(0).fullName, count: 1 }, o(1009).createdAt),
    log('sales', 'CLAIM_PERMIT', 'permits', per(today, 5, 20, 1), { permitCode: 'PERMIT-0520-1', customerName: cust(0).fullName, slot: '05:20' }, hoursAgo(9.5)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1007).id, { orderNumber: 1007, customerName: cust(6).fullName, count: 1 }, o(1007).createdAt),
    log('sales', 'RETURN_PERMIT', 'permits', returned?.id || uuid(), { permitCode: 'PERMIT-0200-1', reason: 'إلغاء من قبل العميل', slot: '02:00' }, hoursAgo(7.5)),
    log('sara', 'UPDATE_PROFILE', 'profiles', USERS.sara.id, { employeeName: USERS.sara.name, username: 'sara', avatarChanged: true, source: 'الملف الشخصي (خدمة ذاتية)' }, hoursAgo(6)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1001).id, { orderNumber: 1001, customerName: cust(0).fullName, count: 3 }, o(1001).createdAt),
    log('sales', 'CLAIM_PERMIT', 'permits', per(today, 14, 0, 1), { permitCode: 'PERMIT-1400-1', customerName: cust(0).fullName, slot: '14:00', count: 3 }, hoursAgo(4.8)),
    log('accountant', 'MATCH_SMS', 'sales_orders', o(1001).id, { orderNumber: 1001, amount: 450, ref: 'TXN45120087' }, hoursAgo(4.5)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1002).id, { orderNumber: 1002, customerName: cust(1).fullName, count: 2 }, o(1002).createdAt),
    log('sales', 'CLAIM_PERMIT', 'permits', per(today, 17, 20, 1), { permitCode: 'PERMIT-1720-1', customerName: cust(1).fullName, slot: '17:20', count: 2 }, hoursAgo(3.8)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1003).id, { orderNumber: 1003, customerName: cust(2).fullName, count: 4 }, o(1003).createdAt),
    log('admin', 'CREATE_ORDER', 'sales_orders', o(1004).id, { orderNumber: 1004, customerName: cust(3).fullName, count: 4 }, o(1004).createdAt),
    log('admin', 'CLAIM_PERMIT', 'permits', per(today, 20, 0, 1), { permitCode: 'PERMIT-2000-1', customerName: cust(3).fullName, slot: '20:00', count: 4 }, hoursAgo(2.4)),
    log('sales', 'UPDATE_ORDER', 'sales_orders', o(1004).id, { deliveryStatus: 'waiting' }, hoursAgo(2.2)),
    log('accountant', 'MATCH_SMS', 'sales_orders', o(1004).id, { orderNumber: 1004, amount: 500, ref: 'IP55210043' }, hoursAgo(2)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1005).id, { orderNumber: 1005, customerName: cust(4).fullName, count: 1 }, o(1005).createdAt),
    log('sales', 'CLAIM_PERMIT', 'permits', per(dayAfter, 10, 0, 1), { permitCode: 'PERMIT-1000-1', customerName: cust(4).fullName, slot: '10:00' }, hoursAgo(1.9)),
    log('accountant', 'MATCH_SMS', 'sales_orders', o(1005).id, { orderNumber: 1005, amount: 150, ref: 'IP77203451' }, hoursAgo(1.5)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1006).id, { orderNumber: 1006, customerName: cust(5).fullName, count: 2 }, o(1006).createdAt),
    log('sales', 'CLAIM_PERMIT', 'permits', per(today, 22, 0, 1), { permitCode: 'PERMIT-2200-1', customerName: cust(5).fullName, slot: '22:00', count: 2 }, hoursAgo(1.4)),
    log('accountant', 'MATCH_SMS', 'sales_orders', o(1006).id, { orderNumber: 1006, amount: 300, ref: 'AH99812344' }, hoursAgo(1)),
    log('admin', 'CREATE_ORDER', 'sales_orders', o(1008).id, { orderNumber: 1008, customerName: cust(7).fullName, count: 6 }, o(1008).createdAt),
    log('sales', 'UPDATE_CUSTOMER', 'customers', cust(0).id, { customerName: cust(0).fullName, whatsappNumber: cust(0).whatsappNumber, propagatedOrders: [1001, 1009] }, daysAgo(2, 12)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1010).id, { orderNumber: 1010, customerName: cust(2).fullName, count: 2 }, o(1010).createdAt),
    log('admin', 'ARCHIVE_ORDER', 'sales_orders', o(1010).id, { auto: true, count: 1, orderNumbers: [1010] }, daysAgo(1, 6)),
    log('sales', 'CREATE_ORDER', 'sales_orders', o(1011).id, { orderNumber: 1011, customerName: cust(6).fullName, count: 1 }, o(1011).createdAt),
    log('admin', 'ARCHIVE_ORDER', 'sales_orders', o(1011).id, { auto: true, count: 1, orderNumbers: [1011] }, daysAgo(3, 7)),
    log('admin', 'TOGGLE_EMPLOYEE_STATUS', 'profiles', USERS.sara.id, { employeeName: USERS.sara.name, username: 'sara', before: 'موقوف', after: 'نشط' }, daysAgo(1, 9)),
    log('admin', 'DELETE_PROFILE', 'profiles', uuid(), { employeeName: 'عبدالله الحربي (موظف سابق)', username: 'abdullah', role: 'sales', reason: 'انتهاء فترة التجربة' }, daysAgo(5, 11)),
    log('admin', 'UPDATE_PERMISSIONS', 'profiles', USERS.sara.id, {
      employeeName: USERS.sara.name,
      username: 'sara',
      role: 'sales',
      before: { view: true, create: true, edit: true, delete: false, reports: false },
      after: { view: true, create: true, edit: true, delete: false, reports: true },
      source: 'شاشة الموظفين والصلاحيات',
    }, daysAgo(1, 10)),
  ];
  // الأحدث أولاً — يطابق ترتيب addAuditLog المحلي وواجهة العرض
  auditLogs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return {
    customers,
    permits,
    orders,
    smsMessages,
    financialAccounts,
    auditLogs,
  };
}

// ==============================================================================
// سيناريو السداد اليومي — 10 عملاء بطلبات مستحقة اليوم غير مسددة، لاختبار
// محرك المطابقة التلقائية (التعرف على العميل من رقمه أو اسمه داخل نص الرسالة)
// ==============================================================================

export interface DailyScenarioTexts {
  scenario1: string[]; // الرسائل العشرة كاملة — الجميع يسدد
  scenario2: string[]; // 8 رسائل فقط — عميلان لم يدفعا
  scenario3: string[]; // 8 رسائل منها 2 من مرسلين مجهولين — 4 لم يسددوا
}

export interface DailyPaymentScenario {
  customers: Customer[];
  orders: SalesOrder[];
  financialAccounts: FinancialAccount[];
  auditLogs: AuditLog[];
  texts: DailyScenarioTexts;
}

interface ScenarioSpec {
  fullName: string;
  nickname?: string;
  phone: string;
  currency: CurrencyCode;
  permits: number;
  time: string;
  provider: AccountProvider;
  byPhone: boolean; // التعرف على العميل في نص الرسالة عبر رقمه (وإلا عبر اسمه)
}

const SCENARIO_SPECS: ScenarioSpec[] = [
  { fullName: 'محمود عبدالعزيز', nickname: 'محمود', phone: '01001234501', currency: 'EGP', permits: 2, time: '10:00', provider: 'vodafone_cash', byPhone: true },
  { fullName: 'هدى إبراهيم', phone: '01001234502', currency: 'EGP', permits: 1, time: '12:20', provider: 'vodafone_cash', byPhone: false },
  { fullName: 'كريم سعيد', nickname: 'كريمو', phone: '01001234503', currency: 'EGP', permits: 3, time: '14:00', provider: 'instapay', byPhone: true },
  { fullName: 'منى شريف', phone: '01001234504', currency: 'EGP', permits: 2, time: '16:40', provider: 'instapay', byPhone: false },
  { fullName: 'أحمد فتحي', nickname: 'فتحي', phone: '01001234505', currency: 'EGP', permits: 1, time: '18:00', provider: 'orange_cash', byPhone: true },
  { fullName: 'نورهان حسن', phone: '01001234506', currency: 'EGP', permits: 2, time: '20:00', provider: 'vodafone_cash', byPhone: false },
  { fullName: 'عمرو دياب', nickname: 'عمرو', phone: '01001234507', currency: 'EGP', permits: 1, time: '22:00', provider: 'instapay', byPhone: true },
  { fullName: 'سلمى صابر', phone: '01001234508', currency: 'EGP', permits: 3, time: '09:00', provider: 'vodafone_cash', byPhone: false },
  { fullName: 'بدر العسيري', phone: '+966501234501', currency: 'SAR', permits: 2, time: '11:20', provider: 'al_rajhi', byPhone: false },
  { fullName: 'نوف الحربي', phone: '+966501234502', currency: 'SAR', permits: 1, time: '15:40', provider: 'al_ahli', byPhone: true },
];

// رقم غير مسجل لأي عميل — لرسائل المرسل المجهول في السيناريو الثالث
const UNKNOWN_PHONE = '01550001111';

export function buildDailyPaymentScenario(): DailyPaymentScenario {
  const today = riyadhDate(0);
  const UNIT = 150;
  const SALES = { id: 'e48d53af-a5ae-49b2-a5ef-e91307ed02db', name: 'موظف المبيعات' };

  const customers: Customer[] = SCENARIO_SPECS.map((s, i) => ({
    id: uuid(),
    fullName: s.fullName,
    whatsappNumber: s.phone,
    nickname: s.nickname,
    notes: 'سيناريو اختبار السداد اليومي',
    totalOrdersCount: 1,
    totalSpent: s.permits * UNIT,
    createdAt: daysAgo(2 + ((10 - i) % 5), 11),
  }));

  const orders: SalesOrder[] = SCENARIO_SPECS.map((s, i) => {
    const totalAmount = s.permits * UNIT;
    return {
      id: uuid(),
      orderNumber: 2001 + i,
      customerId: customers[i].id,
      customerName: s.fullName,
      customerWhatsapp: s.phone,
      permitsCount: s.permits,
      targetDate: today,
      targetTime: s.time,
      orderType: 'instant',
      orderStatus: 'searching',
      deliveryStatus: 'not_sent',
      currency: s.currency,
      unitPrice: UNIT,
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      notes: 'مستحق اليوم — بانتظار السداد',
      createdBy: SALES.name,
      createdAt: hoursAgo(3 - (i % 3) * 0.5),
    };
  });

  const auditLogs: AuditLog[] = orders.map((o) => ({
    id: uuid(),
    userId: SALES.id,
    userName: SALES.name,
    actionType: 'CREATE_ORDER',
    entityName: 'sales_orders',
    entityId: o.id,
    details: { orderNumber: o.orderNumber, customerName: o.customerName, count: o.permitsCount },
    createdAt: o.createdAt,
  }));

  const mkAcc = (
    provider: AccountProvider,
    accountName: string,
    accountNumber: string,
    currency: CurrencyCode,
    type: 'wallet' | 'bank'
  ): FinancialAccount => ({
    id: uuid(),
    type,
    provider,
    accountName,
    accountNumber,
    currentBalance: 0,
    isActive: true,
    currency,
    notes: 'خزنة سيناريو السداد اليومي',
    createdAt: daysAgo(30, 9),
  });

  const financialAccounts: FinancialAccount[] = [
    mkAcc('vodafone_cash', 'فودافون كاش', '01000000000', 'EGP', 'wallet'),
    mkAcc('instapay', 'إنستاباي InstaPay', 'rawdah@instapay', 'EGP', 'wallet'),
    mkAcc('orange_cash', 'أورانج كاش', '01000000000', 'EGP', 'wallet'),
    {
      ...mkAcc('al_rajhi', 'مصرف الراجحي', 'SA4410000068240001234567', 'SAR', 'bank'),
      accountHolderName: 'مؤسسة حجز التصاريح',
      iban: 'SA4410000068240001234567',
      branchName: 'فرع المدينة المنورة',
    },
    {
      ...mkAcc('al_ahli', 'البنك الأهلي السعودي', 'SA4410000068240007654321', 'SAR', 'bank'),
      accountHolderName: 'مؤسسة حجز التصاريح',
      iban: 'SA4410000068240007654321',
      branchName: 'فرع المدينة المنورة — المنطقة المركزية',
    },
  ];

  const refCode = (pfx: string, i: number) => `${pfx}${String(48200001 + i * 137)}`;
  const buildMsg = (i: number, payee: string | null): string => {
    const amount = (SCENARIO_SPECS[i].permits * UNIT).toFixed(2);
    const ref = refCode(
      { vodafone_cash: 'VF', instapay: 'IP', orange_cash: 'ORG', etisalat_cash: 'ET', al_rajhi: 'TXN', al_ahli: 'AH', other: 'XX' }[SCENARIO_SPECS[i].provider],
      i
    );
    const from = payee ? ` من ${payee}` : '';
    switch (SCENARIO_SPECS[i].provider) {
      case 'vodafone_cash':
        return `Vodafone Cash: استلام مبلغ: ${amount} جنيه${from} رقم العملية: ${ref}`;
      case 'instapay':
        return `InstaPay: You have received ${amount} EGP${from} رقم العملية: ${ref}`;
      case 'orange_cash':
        return `Orange Cash: استلام مبلغ: ${amount} جنيه${from} رقم العملية: ${ref}`;
      case 'al_rajhi':
        return `مصرف الراجحي: تم استلام تحويل بمبلغ: ${amount} ر.س${from} رقم العملية: ${ref}`;
      case 'al_ahli':
        return `البنك الأهلي: تم استلام تحويل بمبلغ: ${amount} ر.س${from} رقم العملية: ${ref}`;
      default:
        return `تحويل وارد بمبلغ: ${amount}${from} رقم العملية: ${ref}`;
    }
  };
  const payeeOf = (i: number) => (SCENARIO_SPECS[i].byPhone ? SCENARIO_SPECS[i].phone : SCENARIO_SPECS[i].fullName);

  const texts: DailyScenarioTexts = {
    scenario1: SCENARIO_SPECS.map((_, i) => buildMsg(i, payeeOf(i))),
    scenario2: SCENARIO_SPECS.slice(0, 8).map((_, i) => buildMsg(i, payeeOf(i))),
    scenario3: [
      ...SCENARIO_SPECS.slice(0, 6).map((_, i) => buildMsg(i, payeeOf(i))),
      // مرسلان مجهولان: رقم غير مسجل لأي عميل، ونص بلا اسم ولا رقم
      buildMsg(6, UNKNOWN_PHONE),
      buildMsg(7, null),
    ],
  };

  return { customers, orders, financialAccounts, auditLogs, texts };
}
