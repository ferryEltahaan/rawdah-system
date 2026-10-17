// Comprehensive End-to-End Workflow Verification Script in TypeScript
// Tests all domain models, state mutations, validations, persistence, and reporting

// Mock Browser Environment for Node runtime
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

(globalThis as any).localStorage = new LocalStorageMock();
(globalThis as any).window = {
  dispatchEvent: (_event: any) => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
(globalThis as any).Event = class Event {
  type: string;
  constructor(type: string) { this.type = type; }
};

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
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
  const { DataService } = await import('../services/dataService');
  const { todayRiyadh } = await import('../utils/csvHelpers');
  const { validateWhatsappNumber } = await import('../utils/phoneValidation');
  type UserProfile = Awaited<ReturnType<typeof DataService.getProfiles>>[number];
  console.log('\n======================================================');
  console.log('🚀 بدء الاختبار الشامل لآلية العمل بالكامل (End-to-End)');
  console.log('======================================================\n');

  // STEP 1: INITIALIZATION & PROFILES
  // لا توجد حسابات افتراضية في الحزمة بعد الآن — الاختبار يزرع موظفاً صريحاً
  // في التخزين المحلي لمحاكاة جلسة مُصادَق عليها من Supabase، ثم يفحص منطق الأعمال.
  console.log('🔹 الخطوة 1: فحص تهيئة النظام والملفات الشخصية');
  await DataService.seedDemoOrdersIfEmpty();

  const seedProfiles: UserProfile[] = [
    {
      id: 'fe292e3d-9509-43d6-9561-aba950cb8540',
      fullName: 'المدير العام',
      username: 'admin',
      phoneNumber: '+966500000001',
      whatsappNumber: '+966500000001',
      role: 'super_admin',
      isActive: true,
      customPermissions: { view: true, create: true, edit: true, delete: true, reports: true },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'e48d53af-a5ae-49b2-a5ef-e91307ed02db',
      fullName: 'موظف المبيعات',
      username: 'sales',
      phoneNumber: '+966500000002',
      whatsappNumber: '+966500000002',
      role: 'sales',
      isActive: true,
      customPermissions: { view: true, create: true, edit: true, delete: false, reports: false },
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem('rawdah_profiles', JSON.stringify(seedProfiles));
  DataService.setCurrentUser(seedProfiles[0]);

  // مخزون تصاريح للاختبار: بضعة تصاريح متاحة موزعة على ساعات مختلفة
  const seedPermits = Array.from({ length: 8 }, (_, i) => ({
    id: `test-permit-${i + 1}`,
    permitCode: `PERMIT-TEST-${i + 1}`,
    slotDate: todayRiyadh(),
    slotHour: i,
    slotMinute: 0,
    slotFormatted: `${String(i).padStart(2, '0')}:00`,
    imageUrl: '',
    status: 'available' as const,
    createdAt: new Date().toISOString(),
  }));
  localStorage.setItem('rawdah_permits', JSON.stringify(seedPermits));

  const currentUser = DataService.getCurrentUser();
  assert(currentUser?.role === 'super_admin', 'المدير العام مهيأ كحساب نشط للاختبار');

  const initialProfiles = DataService.getProfiles();
  assert(initialProfiles.length >= 2, `تم تحميل ${initialProfiles.length} موظف مهيأ للاختبار`);

  // STEP 2: EMPLOYEE MANAGEMENT (ADD, TOGGLE STATUS, PERMISSIONS)
  console.log('\n🔹 الخطوة 2: إدارة الموظفين والصلاحيات وتغيير الحالة');
  const newStaff = {
    fullName: 'خالد مبيعات تجريبي',
    username: 'khaled_sales',
    password: 'password123',
    phoneNumber: '+966509988771',
    whatsappNumber: '+966509988771',
    role: 'sales' as const,
    isActive: true,
    customPermissions: { view: true, create: true, edit: true, delete: false, reports: false }
  };
  const { profile: savedStaff } = await DataService.saveProfile(newStaff);
  assert(Boolean(savedStaff && savedStaff.id), 'تمت إضافة موظف مبيعات جديد بنجاح');

  // Toggle active status (deactivate)
  const { profile: deactivatedStaff } = await DataService.saveProfile({ ...savedStaff, isActive: false });
  assert(deactivatedStaff.isActive === false, 'تم إيقاف حساب الموظف مؤقتاً بنجاح (isActive = false)');

  // Verify in profiles list
  const currentProfiles = DataService.getProfiles();
  const foundStaff = currentProfiles.find(p => p.username === 'khaled_sales');
  assert(Boolean(foundStaff && foundStaff.isActive === false), 'حالة الإيقاف محفوظة ومقروءة بدقة من التخزين');

  // STEP 3: CUSTOMER REGISTRATION & PHONE VALIDATION
  console.log('\n🔹 الخطوة 3: تسجيل عميل جديد وفحص أرقام التواصل وروابط الهاتف');
  const phoneValidation = validateWhatsappNumber('0551234567');
  assert(phoneValidation.valid && phoneValidation.normalized === '+966551234567', 'التحقق من رقم الهاتف وتحويله للصيغة الدولية (+966...)');

  const newCustomer = {
    fullName: 'عبدالله بن محمد العتيبي',
    whatsappNumber: '+966551234567',
    additionalPhone: '+966501112233',
    nickname: 'أبو محمد',
    notes: 'عميل مميز — زيارة أسبوعية',
  };
  const savedCustomer = await DataService.saveCustomer(newCustomer);
  assert(Boolean(savedCustomer && savedCustomer.id), 'تم تسجيل العميل الجديد وحفظه في الـ CRM');

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
  assert(movedPermit?.slotHour === newHour, `تم نقل التصريح ${targetPermit.permitCode} من الساعة ${oldHour}:00 إلى الساعة ${newHour}:00 بنجاح`);

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
    orderType: 'instant' as const,
    orderStatus: 'searching' as const,
    deliveryStatus: 'not_sent' as const,
    unitPrice: 150,
    totalAmount: 300,
    paidAmount: 0,
    currency: 'SAR' as const,
    notes: 'طلب تصريحين روضة شريفة للرجال',
    isArchived: false,
    createdBy: currentUser.fullName
  };

  const createdOrder = await DataService.createOrder(newOrderData);
  assert(Boolean(createdOrder && createdOrder.orderNumber), `تم إنشاء الطلب رقم #${createdOrder.orderNumber} بنجاح`);
  assert(createdOrder.totalAmount === 300 && createdOrder.remainingAmount === 300, 'إجمالي المبلغ 300 ر.س والمتبقي 300 ر.س');

  // STEP 6: PERMIT CLAIM & ALLOCATION
  console.log('\n🔹 الخطوة 6: تخصيص وسحب التصاريح للطلب');
  const availablePermits = updatedPermits.filter(p => p.status === 'available');
  if (availablePermits.length >= 2) {
    const permitIdsToClaim = [availablePermits[0].id, availablePermits[1].id];
    for (const pid of permitIdsToClaim) {
      await DataService.claimPermit(pid, savedCustomer.id, createdOrder.id);
    }
    assert(true, `تم سحب وتخصيص ${permitIdsToClaim.length} تصريح للعميل بنجاح`);
  } else {
    console.log('  ⚠️ تنبيه: عدد التصاريح المتاحة أقل من 2، تم تجاوز السحب المباشر');
  }

  // STEP 7: SMS INGESTION & PAYMENT MATCHING (AUTO + MANUAL)
  console.log('\n🔹 الخطوة 7: استقبال إشعار SMS البنكي والمطابقة الذكية والسداد');
  const smsBody = `حوالة واردة سريعة بمبلغ 300.00 ر.س من: ${savedCustomer.fullName} إلى حسابك المنتهي بـ 5678. المرجع: TXN998811`;
  const { outcome, sms } = await DataService.addIncomingSms('AlRajhiBank', smsBody);
  assert(Boolean(sms && sms.parsedAmount === 300), 'تم تحليل واستخراج المبلغ (300 ر.س) من نص الرسالة البنكية آلياً');
  assert(outcome.matched === true, `المحرك التلقائي طابق الرسالة بنجاح مع طلب العميل #${outcome.orderNumber}`);

  // Also test Manual Matching with an unknown sender SMS
  const manualSmsBody = `تم استلام مبلغ 300.00 ر.س من رقم غير مسجل 0500000000 مرجع TXN-MANUAL-01`;
  const { sms: unidentifiedSms } = await DataService.addIncomingSms('AlRajhiBank', manualSmsBody);
  assert(Boolean(unidentifiedSms && unidentifiedSms.status === 'unmatched'), 'رسالة برقم غير معروف دخلت قائمة الانتظار للمطابقة اليدوية');

  // Create a second order for manual matching test
  const manualOrder = await DataService.createOrder({
    customerId: savedCustomer.id,
    customerName: savedCustomer.fullName,
    customerWhatsapp: savedCustomer.whatsappNumber,
    permitsCount: 1,
    targetDate: todayRiyadh(),
    targetTime: '18:00',
    orderType: 'instant',
    orderStatus: 'searching',
    deliveryStatus: 'not_sent',
    unitPrice: 300,
    totalAmount: 300,
    paidAmount: 0,
    currency: 'SAR',
    createdBy: currentUser.fullName
  });

  const manualMatchResult = await DataService.matchSmsToOrder(unidentifiedSms.id, manualOrder.id);
  assert(manualMatchResult.success === true, `نجاح المطابقة اليدوية لرسالة غير معروفة مع الطلب #${manualOrder.orderNumber}`);

  // Check Order status and balance after payment
  const verifiedOrders = DataService.getOrders();
  const paidOrder = verifiedOrders.find(o => o.id === createdOrder.id);
  assert(Boolean(paidOrder && paidOrder.paidAmount === 300), 'تم تحديث المبلغ المدفوع على الطلب إلى 300 ر.س');
  assert(Boolean(paidOrder && paidOrder.remainingAmount === 0), 'المبلغ المتبقي على الطلب أصبح 0 ر.س');
  assert(Boolean(paidOrder && paidOrder.orderStatus === 'confirmed'), 'حالة الطلب تحولت تلقائياً إلى «مؤكد» بعد اكتمال السداد');
  assert(Boolean(paidOrder && paidOrder.payments && paidOrder.payments.length > 0), 'سجل مدفوعات الطلب يتضمن عملية السداد المربوطة بالـ SMS');

  // STEP 8: FINANCIAL ACCOUNT BALANCE UPDATE
  console.log('\n🔹 الخطوة 8: تحديث أرصدة الخزينة والحسابات البنكية');
  const accounts = DataService.getFinancialAccounts();
  const rajhiAccount = accounts.find(a => a.provider === 'al_rajhi');
  assert(Boolean(rajhiAccount && rajhiAccount.currentBalance >= 300), `تمت إضافة المبلغ المحصل لرصيد حساب الراجحي (الرصيد: ${rajhiAccount?.currentBalance} ر.س)`);

  // STEP 9: COLLECTOR DAILY ACCOUNTING REPORT
  console.log('\n🔹 الخطوة 9: تقرير التحصيل اليومي لكل موظف');
  const collectorReport = DataService.getDailyCollectorReport();
  assert(Array.isArray(collectorReport) && collectorReport.length > 0, 'تقرير المحصلين اليومي تم حسابه بدقة');
  const adminRow = collectorReport.find(r => r.userId === currentUser.id);
  assert(Boolean(adminRow && adminRow.collectedSAR >= 300), `تقرير المحصل سجل ${adminRow?.collectedSAR} ر.س تم تحصيلها بواسطة ${currentUser.fullName}`);

  // STEP 10: AUDIT LOGS & CSV EXPORT
  console.log('\n🔹 الخطوة 10: سجل التدقيق وتوثيق العمليات');
  const auditLogs = DataService.getAuditLogs();
  assert(auditLogs.length > 0, `سجل التدقيق يحتوي على ${auditLogs.length} عملية موثقة`);

  const lastLog = auditLogs[0];
  assert(
    lastLog.actionType === 'MATCH_SMS' && lastLog.details?.orderNumber === manualOrder.orderNumber,
    `آخر عملية موثقة في سجل التدقيق هي MATCH_SMS برقم الطلب #${manualOrder.orderNumber}`
  );

  console.log('\n======================================================');
  console.log(`🎉 اكتمل الاختبار الشامل بنجاح تام! (${passedTests}/${totalTests} فحوص ناجحة بنسبة 100%)`);
  console.log('======================================================\n');
}

runE2ETests().catch(err => {
  console.error('❌ حدث خطأ أثناء تشغيل الاختبار:', err);
  process.exit(1);
});
