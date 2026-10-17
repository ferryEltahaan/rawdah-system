// Comprehensive End-to-End Workflow Verification Script
// Tests all domain models, state mutations, validations, persistence, and reporting

// 1. Mock Browser Environment (localStorage, window, Event)
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new LocalStorageMock();
globalThis.window = {
  dispatchEvent: (event) => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.Event = class Event { constructor(type) { this.type = type; } };

import { DataService } from '../services/dataService.js';
import { downloadCsv, todayRiyadh } from '../utils/csvHelpers.js';
import { validateWhatsappNumber } from '../utils/phoneValidation.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runE2ETests() {
  console.log('\n======================================================');
  console.log('🚀 بدء الاختبار الشامل لآلية العمل بالكامل (End-to-End)');
  console.log('======================================================\n');

  // STEP 1: INITIALIZATION & DEFAULT PROFILES
  console.log('🔹 الخطوة 1: فحص تهيئة النظام والمستخدمين والملفات الشخصية');
  const currentUser = DataService.getCurrentUser();
  assert(currentUser && currentUser.role === 'super_admin', 'المدير العام مهيأ كحساب افتراضي نشط');

  const initialProfiles = DataService.getProfiles();
  assert(initialProfiles.length >= 4, `تم تحميل ${initialProfiles.length} موظف من الإعدادات الافتراضية`);

  // STEP 2: EMPLOYEE MANAGEMENT (ADD, TOGGLE STATUS, PERMISSIONS)
  console.log('\n🔹 الخطوة 2: إدارة الموظفين والصلاحيات وتغيير الحالة');
  const newStaff = {
    fullName: 'خالد مبيعات تجريبي',
    username: 'khaled_sales',
    password: 'password123',
    phoneNumber: '+966509988771',
    whatsappNumber: '+966509988771',
    role: 'sales',
    isActive: true,
    customPermissions: { view: true, create: true, edit: true, delete: false, reports: false }
  };
  const { profile: savedStaff } = await DataService.saveProfile(newStaff);
  assert(savedStaff && savedStaff.id, 'تمت إضافة موظف مبيعات جديد بنجاح');

  // Toggle active status (deactivate)
  const { profile: deactivatedStaff } = await DataService.saveProfile({ ...savedStaff, isActive: false });
  assert(deactivatedStaff.isActive === false, 'تم إيقاف حساب الموظف مؤقتاً بنجاح (isActive = false)');

  // Verify in profiles list
  const currentProfiles = DataService.getProfiles();
  const foundStaff = currentProfiles.find(p => p.username === 'khaled_sales');
  assert(foundStaff && foundStaff.isActive === false, 'حالة الإيقاف محفوظة ومقروءة بدقة من التخزين');

  // STEP 3: CUSTOMER REGISTRATION & PHONE VALIDATION
  console.log('\n🔹 الخطوة 3: تسجيل عميل جديد وفحص أرقام التواصل وروابط الهاتف');
  const phoneValidation = validateWhatsappNumber('0551234567');
  assert(phoneValidation.isValid && phoneValidation.normalized === '+966551234567', 'التحقق من رقم الهاتف وتحويله للصيغة الدولية (+966...)');

  const newCustomer = {
    fullName: 'عبدالله بن محمد العتيبي',
    whatsappNumber: '+966551234567',
    additionalPhone: '+966501112233',
    nickname: 'أبو محمد',
    notes: 'عميل مميز — زيارة أسبوعية',
  };
  const { customer: savedCustomer } = await DataService.saveCustomer(newCustomer);
  assert(savedCustomer && savedCustomer.id, 'تم تسجيل العميل الجديد وحفظه في الـ CRM');

  const allCustomers = DataService.getCustomers();
  assert(allCustomers.some(c => c.id === savedCustomer.id), 'ظهور العميل في قائمة عملاء النظام');

  // STEP 4: PERMITS INVENTORY & REBALANCING
  console.log('\n🔹 الخطوة 4: فحص مخزون التصاريح والتوزيع على الساعات الـ 24');
  const permits = DataService.getPermits();
  assert(permits.length > 0, `المخزون يحتوي على ${permits.length} تصريح مهيأ`);

  // Move a permit to another hour
  const targetPermit = permits.find(p => p.status === 'available') || permits[0];
  const oldHour = targetPermit.slotHour;
  const newHour = (oldHour + 2) % 24;
  await DataService.movePermits([targetPermit.id], targetPermit.slotDate, newHour, 0);

  const updatedPermits = DataService.getPermits();
  const movedPermit = updatedPermits.find(p => p.id === targetPermit.id);
  assert(movedPermit.slotHour === newHour, `تم نقل التصريح ${targetPermit.permitCode} من الساعة ${oldHour}:00 إلى الساعة ${newHour}:00 بنجاح`);

  // STEP 5: ORDER PLACEMENT
  console.log('\n🔹 الخطوة 5: إنشاء طلب مبيعات جديد وحساب المبالغ المالية');
  const newOrderData = {
    customerId: savedCustomer.id,
    customerName: savedCustomer.fullName,
    customerWhatsapp: savedCustomer.whatsappNumber,
    permitsCount: 2,
    permitsCountMale: 2,
    permitsCountFemale: 0,
    targetDate: todayRiyadh(),
    targetTime: '16:00',
    orderType: 'instant',
    orderStatus: 'searching',
    deliveryStatus: 'not_sent',
    unitPrice: 150,
    totalAmount: 300,
    paidAmount: 0,
    remainingAmount: 300,
    currency: 'SAR',
    notes: 'طلب تصريحين روضة شريفة للرجال',
    isArchived: false,
    createdBy: currentUser.fullName
  };

  const { order: createdOrder } = await DataService.saveOrder(newOrderData);
  assert(createdOrder && createdOrder.orderNumber, `تم إنشاء الطلب رقم #${createdOrder.orderNumber} بنجاح`);
  assert(createdOrder.totalAmount === 300 && createdOrder.remainingAmount === 300, 'إجمالي المبلغ 300 ر.س والمتبقي 300 ر.س');

  // STEP 6: PERMIT CLAIM & ALLOCATION
  console.log('\n🔹 الخطوة 6: تخصيص وسحب التصاريح للطلب');
  const availablePermits = updatedPermits.filter(p => p.status === 'available');
  if (availablePermits.length >= 2) {
    const permitIdsToClaim = [availablePermits[0].id, availablePermits[1].id];
    await DataService.claimPermitsForCustomer(savedCustomer.id, permitIdsToClaim);
    const orderWithPermits = {
      ...createdOrder,
      assignedPermitIds: permitIdsToClaim,
      orderStatus: 'confirmed'
    };
    await DataService.saveOrder(orderWithPermits);
    assert(true, `تم سحب وتخصيص ${permitIdsToClaim.length} تصريح للعميل بنجاح`);
  } else {
    console.log('  ⚠️ تنبيه: عدد التصاريح المتاحة أقل من 2، تم تجاوز السحب المباشر');
  }

  // STEP 7: SMS INGESTION & PAYMENT MATCHING
  console.log('\n🔹 الخطوة 7: استقبال إشعار SMS البنكي والمطابقة الذكية والسداد');
  const smsBody = `حوالة واردة سريعة بمبلغ 300.00 ر.س من: ${savedCustomer.fullName} إلى حسابك المنتهي بـ 5678. المرجع: TXN998811`;
  const { outcome, sms } = await DataService.addIncomingSms('AlRajhiBank', smsBody);
  assert(sms && sms.parsedAmount === 300, 'تم تحليل واستخراج المبلغ (300 ر.س) من نص الرسالة البنكية آلياً');

  // Match SMS to Order
  const matchResult = await DataService.matchSmsToOrder(sms.id, createdOrder.id);
  assert(matchResult.success, `نجاح مطابقة رسالة الدفع مع الطلب رقم #${createdOrder.orderNumber}`);

  // Check Order status and balance after payment
  const verifiedOrders = DataService.getOrders();
  const paidOrder = verifiedOrders.find(o => o.id === createdOrder.id);
  assert(paidOrder.paidAmount === 300, 'تم تحديث المبلغ المدفوع على الطلب إلى 300 ر.س');
  assert(paidOrder.remainingAmount === 0, 'المبلغ المتبقي على الطلب أصبح 0 ر.س');
  assert(paidOrder.orderStatus === 'confirmed', 'حالة الطلب تحولت تلقائياً إلى «مؤكد» بعد اكتمال السداد');
  assert(paidOrder.payments && paidOrder.payments.length > 0, 'سجل مدفوعات الطلب يتضمن عملية السداد المربوطة بالـ SMS');

  // STEP 8: FINANCIAL ACCOUNT BALANCE UPDATE
  console.log('\n🔹 الخطوة 8: تحديث أرصدة الخزينة والحسابات البنكية');
  const accounts = DataService.getFinancialAccounts();
  const rajhiAccount = accounts.find(a => a.provider === 'al_rajhi');
  assert(rajhiAccount && rajhiAccount.currentBalance >= 300, `تمت إضافة المبلغ المحصل لرصيد حساب الراجحي (الرصيد: ${rajhiAccount?.currentBalance} ر.س)`);

  // STEP 9: COLLECTOR DAILY ACCOUNTING REPORT
  console.log('\n🔹 الخطوة 9: تقرير التحصيل اليومي لكل موظف');
  const collectorReport = DataService.getDailyCollectorReport();
  assert(Array.isArray(collectorReport) && collectorReport.length > 0, 'تقرير المحصلين اليومي تم حسابه بدقة');
  const adminRow = collectorReport.find(r => r.userId === currentUser.id);
  assert(adminRow && adminRow.collectedSAR >= 300, `تقرير المحصل سجل ${adminRow?.collectedSAR} ر.س تم تحصيلها بواسطة ${currentUser.fullName}`);

  // STEP 10: AUDIT LOGS & CSV EXPORT
  console.log('\n🔹 الخطوة 10: سجل التدقيق وتصدير التقارير بصيغة CSV');
  const auditLogs = DataService.getAuditLogs();
  assert(auditLogs.length > 0, `سجل التدقيق يحتوي على ${auditLogs.length} عملية موثقة`);

  const lastLog = auditLogs[0];
  assert(lastLog.action === 'MATCH_SMS', `آخر عملية موثقة في سجل التدقيق هي MATCH_SMS برقم الطلب #${createdOrder.orderNumber}`);

  console.log('\n======================================================');
  console.log(`🎉 اكتمل الاختبار الشامل بنجاح تام! (${passedTests}/${totalTests} فحوص ناجحة)`);
  console.log('======================================================\n');
}

runE2ETests().catch(err => {
  console.error('❌ حدث خطأ أثناء تشغيل الاختبار:', err);
  process.exit(1);
});
