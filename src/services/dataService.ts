import {
  Permit,
  SalesOrder,
  Customer,
  SmsMessage,
  UserProfile,
  FinancialAccount,
  CompanySettings,
  MessageTemplates,
  AuditLog,
  AccountProvider,
  CurrencyCode,
  OrderPayment
} from '../types';
import {
  initialCompanySettings,
  initialFinancialAccounts,
  initialCustomers,
  generateInitialPermits,
  initialOrders,
  initialSmsMessages,
  initialAuditLogs
} from './mockData';
import { buildDemoDataset, buildDailyPaymentScenario, DailyScenarioTexts } from './demoData';
import { accountCurrency, currencySymbol, getOrderCurrency, providerCurrency } from '../utils/currency';
import { hashPassword, verifyPassword } from '../utils/passwordHash';
import { isSlotPast } from '../utils/csvHelpers';
// نستورد المتغيرات مباشرة حتى نحصل على آخر قيمة (بعد reinitSupabase)
import * as SupabaseModule from './supabase';

// دوال مساعدة للوصول للـ client و isConfigured دائماً بآخر قيمة
const getSupabase = () => SupabaseModule.supabase;
const getIsConfigured = () => SupabaseModule.isSupabaseConfigured;

// --- نواتج محرك المطابقة التلقائية وملخص السداد اليومي ---
export interface AutoMatchOutcome {
  smsId: string;
  matched: boolean;
  reason: 'ok' | 'customer_not_found' | 'order_not_found';
  customerName?: string;
  orderNumber?: number;
  amount?: number;
  currency?: CurrencyCode;
  currencyWarning?: string;
}

export interface BatchIngestResult {
  total: number;
  matched: number;
  unknownSender: number;
  identifiedNoOrder: number;
  outcomes: AutoMatchOutcome[];
}

export interface DailyPaymentCustomerRow {
  customerId: string;
  customerName: string;
  whatsappNumber: string;
  orderNumbers: number[];
  currency: CurrencyCode;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
}

export interface DailyPaymentSummary {
  date: string;
  ordersCount: number;
  paidCustomers: DailyPaymentCustomerRow[];
  unpaidCustomers: DailyPaymentCustomerRow[];
  matchedTodayCount: number;
  unknownSenderMessages: SmsMessage[];
  identifiedUnmatchedMessages: SmsMessage[];
}

// صف في تقرير تحصيل آخر اليوم لكل موظف — يُحاسَب كل واحد على اللي قبضه وعلى شغله
export interface DailyCollectorRow {
  userId: string;
  userName: string;
  paymentsCount: number; // عدد عمليات السداد اللي سجّلها
  collectedSAR: number;
  collectedEGP: number;
  permitsClaimed: number; // عدد التصاريح اللي سحبها
  ordersCreated: number; // عدد الطلبات اللي أنشأها
}

export interface DailyScenarioRecord {
  createdAt: string;
  texts: DailyScenarioTexts;
}

const STORAGE_KEYS = {
  SETTINGS: 'rawdah_company_settings',
  ACCOUNTS: 'rawdah_financial_accounts',
  PROFILES: 'rawdah_profiles',
  CUSTOMERS: 'rawdah_customers',
  PERMITS: 'rawdah_permits',
  ORDERS: 'rawdah_orders',
  SMS: 'rawdah_sms_messages',
  LOGS: 'rawdah_audit_logs',
  CURRENT_USER: 'rawdah_current_user',
  DAILY_SCENARIO: 'rawdah_daily_scenario',
  LAST_SYNC: 'rawdah_last_cloud_sync',
  PERMIT_PRICE: 'rawdah_default_permit_price',
  TEMPLATES: 'rawdah_message_templates',
};

export const initialMessageTemplates: MessageTemplates = {
  confirmationHeader: `السلام عليكم ورحمة الله وبركاته يا {customerName}،
نود إبلاغكم بأنه تم تجهيز طلب تصريح زيارة الروضة الشريفة بنجاح 🕌✨

• رقم الطلب: #{orderNumber}
• تاريخ الزيارة: {targetDate}
• وقت الفترة: {targetTime}{permitsLine}

يرجى التواجد أمام بوابات الدخول قبل الموعد بـ 15 دقيقة وإبراز تصريح نُسك / توكلنا.`,

  paymentDemandPaid: `✅ تم تأكيد استلام كامل المبلغ:

• إجمالي المبلغ: {totalAmount} {currency}
• المبلغ المدفوع: {paidAmount} {currency}
{transfers}`,

  paymentDemandPending: `بانتظار سداد المبلغ المتبقي:

• إجمالي المبلغ: {totalAmount} {currency}
• المبلغ المدفوع: {paidAmount} {currency}
• المبلغ المتبقي: {remainingAmount} {currency}
{transfers}
بانتظار وصول التحويل لتأكيد السداد وإصدار التصريح.`,

  permitCodesHeader: `تصاريحكم{permitsCount}:
{permitCodesList}`,

  footerText: `تقبل الله زيارتكم وطاعتكم ونسألكم صالح الدعاء في الروضة الشريفة.`,
};

function touchLastSync() {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    window.dispatchEvent(new Event('rawdah_storage_update'));
  } catch {
    /* تجاهل — المؤشر فقط وليس بيانات حرجة */
  }
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Failed to load ${key} from storage:`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T, isBackgroundSync = false): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new Event('rawdah_storage_update'));
    return true;
  } catch (e) {
    const isQuotaError =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22);
    if (isQuotaError) {
      console.warn(`[Storage] Quota exceeded saving ${key}. Running smart self-healing...`);
      try {
        // 1. حذف السيناريو التجريبي والبيانات المؤقتة
        localStorage.removeItem(STORAGE_KEYS.DAILY_SCENARIO);
        localStorage.removeItem('rawdah_debug');
        
        // 2. تقليص سجلات التدقيق إلى آخر 10 فقط
        const rawLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
        if (rawLogs) {
          try {
            const parsed = JSON.parse(rawLogs);
            if (Array.isArray(parsed)) {
              localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(parsed.slice(0, 10)));
            }
          } catch {
            localStorage.removeItem(STORAGE_KEYS.LOGS);
          }
        }

        // 3. إذا كان المفتاح هو التصاريح (المستهلك الأكبر للمساحة بسبب سلاسل base64):
        if (key === STORAGE_KEYS.PERMITS && Array.isArray(data)) {
          // الإبقاء على صور أول 10 تصاريح فقط، وتفريغ سلاسل data:image من الباقي محلياً
          const lightweight = (data as any[]).map((p, idx) => {
            if (idx >= 10 && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image')) {
              return { ...p, imageUrl: '' };
            }
            return p;
          });
          try {
            localStorage.setItem(key, JSON.stringify(lightweight));
            window.dispatchEvent(new Event('rawdah_storage_update'));
            return true;
          } catch {
            // إن ظل الحجم كبيراً، تجريد كافة صور data:image من التخزين المحلي
            const strippedAll = (data as any[]).map(p => ({
              ...p,
              imageUrl: typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image') ? '' : p.imageUrl
            }));
            localStorage.setItem(key, JSON.stringify(strippedAll));
            window.dispatchEvent(new Event('rawdah_storage_update'));
            return true;
          }
        } else {
          // إذا كان مفتاحاً آخر (طلبات، إعدادات، موظفين) وفشل بسبب حجز التصاريح للذاكرة:
          // نجرّد فوراً صور التصاريح المخزنة محلياً لتوفير 3-4 ميجابايت فوراً
          try {
            const storedPermits = localStorage.getItem(STORAGE_KEYS.PERMITS);
            if (storedPermits && storedPermits.length > 300_000) {
              const parsed = JSON.parse(storedPermits);
              if (Array.isArray(parsed)) {
                const pruned = parsed.map((p, idx) => (idx >= 5 && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image') ? { ...p, imageUrl: '' } : p));
                localStorage.setItem(STORAGE_KEYS.PERMITS, JSON.stringify(pruned));
              }
            }
            localStorage.setItem(key, JSON.stringify(data));
            window.dispatchEvent(new Event('rawdah_storage_update'));
            return true;
          } catch (innerRetryErr) {
            console.error('[Storage] Inner retry failed:', innerRetryErr);
          }
        }
      } catch (recoveryErr) {
        console.error('[Storage] Recovery error:', recoveryErr);
      }

      // لا نُطلق أي تنبيه مزعج للمستخدم أثناء المزامنة الخلفية أو شاشة الدخول
      if (!isBackgroundSync) {
        window.dispatchEvent(
          new CustomEvent('rawdah_storage_error', {
            detail: {
              key,
              message:
                'مساحة تخزين المتصفح ممتلئة — تم تفريغ الذاكرة المؤقتة تلقائياً لتجنب توقف النظام.',
            },
          })
        );
      }
    }
    return false;
  }
}

// Generate valid UUID v4 for PostgreSQL
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// تاريخ اليوم بتوقيت الرياض بصيغة YYYY-MM-DD
function riyadhToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function riyadhDateOfIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

// كشف مزود التحويل من أي نص (المرسل أو المتن) — عربي وإنجليزي
function detectProviderKeyword(text: string): AccountProvider | null {
  const t = text.toLowerCase();
  if (t.includes('vf-') || t.includes('vodafone') || t.includes('فودافون') || t.includes('فودافون كاش')) return 'vodafone_cash';
  if (t.includes('orange') || t.includes('أورانج') || t.includes('اورنج') || t.includes('اورانج') || t.includes('اورنچ')) return 'orange_cash';
  if (t.includes('etisalat') || t.includes('اتصالات') || t.includes('e&') || t.includes('we pay') || t.includes('وي باي')) return 'etisalat_cash';
  if (t.includes('instapay') || t.includes('انستاباي') || t.includes('إنستاباي') || t.includes('انستا باي') || t.includes('إنستا باي') || t.includes('ip_')) return 'instapay';
  if (t.includes('rajhi') || t.includes('راجحي') || t.includes('الراجحي')) return 'al_rajhi';
  if (t.includes('ahli') || t.includes('snb') || t.includes('الأهلي') || t.includes('الاهلي') || t.includes('alahli')) return 'al_ahli';
  if (t.includes('riyad') || t.includes('الرياض') || t.includes('بنك الرياض')) return 'riyad_bank';
  return null;
}

const PROVIDER_SENDER_NAMES: Record<AccountProvider, string> = {
  vodafone_cash: 'Vodafone Cash',
  orange_cash: 'Orange Cash',
  etisalat_cash: 'Etisalat Cash',
  instapay: 'InstaPay',
  al_rajhi: 'AlRajhiBank',
  al_ahli: 'SNB-AlAhli',
  riyad_bank: 'RiyadBank',
  other: 'SMS',
};

// أعمدة العملة/الأرشفة/تقسيم ذكر-أنثى قد لا تكون مضافة بعد في جدول sales_orders السحابي —
// نجرّب معها أولاً، وعند فشل الإدراج/التحديث نعيد المحاولة بدونها حتى لا يفشل الحفظ كلياً
const NEW_ORDER_COLUMNS = ['currency', 'is_archived', 'archived_at', 'permits_count_male', 'permits_count_female'];

async function cloudInsertOrderResilient(payload: Record<string, any>): Promise<void> {
  if (!getIsConfigured() || !getSupabase()) return;
  try {
    const { error } = await getSupabase()!.from('sales_orders').insert(payload);
    if (!error) return;
    const basePayload = { ...payload };
    NEW_ORDER_COLUMNS.forEach(col => delete basePayload[col]);
    const { error: retryError } = await getSupabase()!.from('sales_orders').insert(basePayload);
    if (retryError) console.error('Cloud order insert error:', retryError);
    else console.warn('أُدرج الطلب سحابياً بدون أعمدة العملة/الأرشفة (غير مضافة بعد في السحابة)');
  } catch (e) {
    console.error('Cloud order insert exception:', e);
  }
}

async function cloudUpdateOrderResilient(orderId: string, extended: Record<string, any>): Promise<void> {
  if (!getIsConfigured() || !getSupabase()) return;
  try {
    const { error } = await getSupabase()!.from('sales_orders').update(extended).eq('id', orderId);
    if (!error) return;
    const baseFields = { ...extended };
    NEW_ORDER_COLUMNS.forEach(col => delete baseFields[col]);
    const { error: retryError } = await getSupabase()!.from('sales_orders').update(baseFields).eq('id', orderId);
    if (retryError) console.error('Cloud order update error:', retryError);
  } catch (e) {
    console.error('Cloud order update exception:', e);
  }
}

async function cloudArchiveOrders(orderIds: string[], archivedAt: string, archived: boolean): Promise<void> {
  if (!getIsConfigured() || !getSupabase() || orderIds.length === 0) return;
  try {
    const { error } = await getSupabase()!
      .from('sales_orders')
      .update({ is_archived: archived, archived_at: archived ? archivedAt : null })
      .in('id', orderIds);
    if (error) console.warn('Cloud archive orders error (قد تكون الأعمدة غير مضافة بعد):', error.message);
  } catch (e) {
    console.error('Cloud archive orders exception:', e);
  }
}

let autoArchiveRunning = false;

export class DataService {

  // ترحيل لمرة واحدة: معرّفات الموظفين النصية القديمة (user-admin…) غير مقبولة في عمود UUID السحابي،
  // فنحوّلها UUID ونحدّث كل المراجع المحلية (الجلسة، التصاريح، السجلات، الرسائل) كي لا تُفقد الصلة
  private static migrateLocalProfileIds(): void {
    const FLAG = 'rawdah_profiles_uuid_migration_v1';
    try {
      if (localStorage.getItem(FLAG) === 'done') return;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const profiles = loadFromStorage<UserProfile[]>(STORAGE_KEYS.PROFILES, []);
      const idMap: Record<string, string> = {};

      const migratedProfiles = profiles.map(p => {
        if (uuidRegex.test(p.id)) return p;
        const newId = generateUUID();
        idMap[p.id] = newId;
        return { ...p, id: newId };
      });

      if (Object.keys(idMap).length > 0) {
        saveToStorage(STORAGE_KEYS.PROFILES, migratedProfiles);

        const permits = loadFromStorage<Permit[]>(STORAGE_KEYS.PERMITS, []);
        let permitsChanged = false;
        const migratedPermits = permits.map(pm => {
          if (pm.assignedByUserId && idMap[pm.assignedByUserId]) {
            permitsChanged = true;
            return { ...pm, assignedByUserId: idMap[pm.assignedByUserId] };
          }
          return pm;
        });
        if (permitsChanged) saveToStorage(STORAGE_KEYS.PERMITS, migratedPermits);

        const logs = loadFromStorage<AuditLog[]>(STORAGE_KEYS.LOGS, []);
        let logsChanged = false;
        const migratedLogs = logs.map(l => {
          if (l.userId && idMap[l.userId]) {
            logsChanged = true;
            return { ...l, userId: idMap[l.userId] };
          }
          return l;
        });
        if (logsChanged) saveToStorage(STORAGE_KEYS.LOGS, migratedLogs);

        const sms = loadFromStorage<SmsMessage[]>(STORAGE_KEYS.SMS, []);
        let smsChanged = false;
        const migratedSms = sms.map(s => {
          if (s.matchedByUserId && idMap[s.matchedByUserId]) {
            smsChanged = true;
            return { ...s, matchedByUserId: idMap[s.matchedByUserId] };
          }
          return s;
        });
        if (smsChanged) saveToStorage(STORAGE_KEYS.SMS, migratedSms);

        const currentUser = loadFromStorage<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
        if (currentUser && idMap[currentUser.id]) {
          saveToStorage(STORAGE_KEYS.CURRENT_USER, { ...currentUser, id: idMap[currentUser.id] });
        }

        console.log(`🔁 Migrated ${Object.keys(idMap).length} local profile ids to UUID`);
      }

      localStorage.setItem(FLAG, 'done');
    } catch (e) {
      console.error('Local profile id migration failed:', e);
    }
  }

  // --- Initialize & Sync from Cloud on start ---
  static async syncFromCloud(): Promise<void> {
    if (!getIsConfigured() || !getSupabase()) return;
    const sb = getSupabase()!;

    // قبل أي مزامنة: صحّح معرّفات الموظفين المحلية القديمة حتى تكون قابلة للرفع للسحابة
    this.migrateLocalProfileIds();

    try {
      // جلب كل البيانات من السحابة بالتوازي (مرة واحدة بدل 8 طلبات متتالية)
      const [
        { data: settings },
        { data: custs, error: custsErr },
        { data: permList, error: permErr },
        { data: orderList, error: orderErr },
        { data: linkRows },
        { data: smsList, error: smsErr },
        { data: profileList },
        { data: accList },
        { data: logList },
      ] = await Promise.all([
        sb.from('company_settings').select('*').order('updated_at', { ascending: false }).limit(1),
        sb.from('customers').select('*').order('created_at', { ascending: false }),
        sb.from('permits').select('*').order('created_at', { ascending: false }),
        sb.from('sales_orders').select('*').order('created_at', { ascending: false }),
        sb.from('order_permits').select('order_id, permit_id'),
        sb.from('sms_messages').select('*').order('received_at', { ascending: false }).limit(200),
        sb.from('profiles').select('*').order('created_at', { ascending: true }),
        sb.from('financial_accounts').select('*').order('created_at', { ascending: true }),
        sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500),
      ]);

      // 1. Sync Company Settings
      if (settings && settings.length > 0) {
        const s = settings[0];
        const currentLocalSettings = this.getCompanySettings();
        const price = (s.default_permit_price !== undefined && s.default_permit_price !== null)
          ? Number(s.default_permit_price)
          : currentLocalSettings.defaultPermitPrice;
        if (price) saveToStorage(STORAGE_KEYS.PERMIT_PRICE, price);

        const mapped: CompanySettings = {
          id: s.id,
          companyNameAr: s.company_name_ar || '',
          companyNameEn: s.company_name_en || '',
          address: s.address || '',
          primaryPhone: s.primary_phone || '',
          secondaryPhone: s.secondary_phone || '',
          whatsappNumber: s.whatsapp_number || '',
          email: s.email || '',
          logoUrl: s.logo_url || '',
          taxNumber: s.tax_number || '',
          commercialRegistry: s.commercial_registry || '',
          invoiceFooterNote: s.invoice_footer_note || '',
          currency: s.currency || 'SAR',
          defaultPermitPrice: price,
        };
        saveToStorage(STORAGE_KEYS.SETTINGS, mapped, true);
      }

      // 1.1 Sync Message Templates from audit_logs
      if (logList && Array.isArray(logList)) {
        const tmplLog = logList.find(l => l.entity_name === 'message_templates' && l.details?.templates);
        if (tmplLog?.details?.templates) {
          saveToStorage(STORAGE_KEYS.TEMPLATES, { ...initialMessageTemplates, ...tmplLog.details.templates }, true);
        }
      }

      // 2. Sync Customers
      if (!custsErr && custs !== null && custs !== undefined) {
        const mappedCusts: Customer[] = custs.map(c => ({
          id: c.id,
          fullName: c.full_name,
          whatsappNumber: c.whatsapp_number,
          additionalPhone: c.additional_phone,
          nickname: c.nickname,
          notes: c.notes,
          totalOrdersCount: c.total_orders_count || 0,
          totalSpent: parseFloat(c.total_spent || '0'),
          createdAt: c.created_at,
        }));

        // دمج ذكي: لا نمسح العملاء المحليين إطلاقاً إذا لم يكونوا قد وصلوا للسحابة بعد
        const localCusts = loadFromStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
        const custMap = new Map<string, Customer>();
        mappedCusts.forEach(c => custMap.set(c.id, c));

        // الاحتفاظ بأي عميل تم تسجيله محلياً ولم يُجلب من السحابة، مع إعادة محاولة رفعه
        localCusts.forEach(lc => {
          if (!custMap.has(lc.id)) {
            custMap.set(lc.id, lc);
            sb.from('customers').upsert({
              id: lc.id,
              full_name: lc.fullName,
              whatsapp_number: lc.whatsappNumber,
              additional_phone: lc.additionalPhone || null,
              nickname: lc.nickname || null,
              notes: lc.notes || null,
            }, { onConflict: 'id' }).then(() => {}, () => {});
          }
        });

        saveToStorage(STORAGE_KEYS.CUSTOMERS, Array.from(custMap.values()), true);
      }

      // 3. Sync Permits
      if (!permErr && permList !== null && permList !== undefined) {
        const mappedPermits: Permit[] = permList.map(p => ({
          id: p.id,
          permitCode: p.permit_code,
          slotDate: p.slot_date,
          slotHour: p.slot_hour,
          slotMinute: p.slot_minute,
          slotFormatted: p.slot_formatted || `${String(p.slot_hour).padStart(2, '0')}:${String(p.slot_minute).padStart(2, '0')}`,
          imageUrl: p.image_url,
          status: p.status,
          assignedToCustomerId: p.assigned_to_customer_id,
          assignedCustomerName: p.assigned_customer_name,
          assignedByUserId: p.assigned_by_user_id,
          assignedByUserName: p.assigned_by_user_name,
          assignedAt: p.assigned_at,
          notes: p.notes,
          isArchived: p.is_archived ?? false,
          archivedAt: p.archived_at || undefined,
          createdAt: p.created_at,
        }));

        const localPermits = loadFromStorage<Permit[]>(STORAGE_KEYS.PERMITS, []);
        const permMap = new Map<string, Permit>();
        mappedPermits.forEach(p => permMap.set(p.id, p));
        localPermits.forEach(lp => {
          if (!permMap.has(lp.id)) permMap.set(lp.id, lp);
        });

        saveToStorage(STORAGE_KEYS.PERMITS, Array.from(permMap.values()), true);
      }

      // 4. Sync Orders
      if (!orderErr && orderList !== null && orderList !== undefined) {
        // جلب أسماء العملاء
        const customers = this.getCustomers();
        const custMap: Record<string, Customer> = {};
        customers.forEach(c => { custMap[c.id] = c; });

        // روابط التصاريح بالطلبات من جدول الوصل order_permits (جُلب بالتوازي مسبقاً)
        const linksByOrder: Record<string, string[]> = {};
        (linkRows || []).forEach(l => {
          if (!linksByOrder[l.order_id]) linksByOrder[l.order_id] = [];
          linksByOrder[l.order_id].push(l.permit_id);
        });

        // القيم المحلية (عملة/أرشفة) تُدمج عند غياب الأعمدة السحابية
        const localOrders = loadFromStorage<SalesOrder[]>(STORAGE_KEYS.ORDERS, []);
        const localOrderMap: Record<string, SalesOrder> = {};
        localOrders.forEach(o => { localOrderMap[o.id] = o; });

        const mappedOrders: SalesOrder[] = orderList.map(o => {
          const cust = custMap[o.customer_id];
          const local = localOrderMap[o.id];
          return {
            id: o.id,
            orderNumber: o.order_number,
            customerId: o.customer_id,
            customerName: cust?.fullName || o.customer_name || '',
            customerWhatsapp: cust?.whatsappNumber || o.customer_whatsapp || '',
            permitsCount: o.permits_count,
            permitsCountMale: o.permits_count_male ?? local?.permitsCountMale,
            permitsCountFemale: o.permits_count_female ?? local?.permitsCountFemale,
            targetDate: o.target_date,
            targetTime: o.target_time,
            orderType: o.order_type,
            orderStatus: o.order_status,
            deliveryStatus: o.delivery_status,
            unitPrice: parseFloat(o.unit_price || '0'),
            totalAmount: parseFloat(o.total_amount || '0'),
            paidAmount: parseFloat(o.paid_amount || '0'),
            remainingAmount: parseFloat(o.remaining_amount || '0'),
            currency: o.currency || local?.currency || 'SAR',
            isArchived: o.is_archived ?? local?.isArchived ?? false,
            archivedAt: o.archived_at || local?.archivedAt || undefined,
            payments: Array.isArray(o.payments) ? o.payments : local?.payments,
            lastReminderAt: o.last_reminder_at || local?.lastReminderAt || undefined,
            notes: o.notes,
            createdBy: o.created_by || '',
            assignedPermitIds: linksByOrder[o.id] || undefined,
            createdAt: o.created_at,
          };
        });

        const orderMap = new Map<string, SalesOrder>();
        mappedOrders.forEach(o => orderMap.set(o.id, o));
        localOrders.forEach(lo => {
          if (!orderMap.has(lo.id)) orderMap.set(lo.id, lo);
        });

        saveToStorage(STORAGE_KEYS.ORDERS, Array.from(orderMap.values()));
      }

      // 5. Sync SMS Messages
      if (!smsErr && smsList !== null && smsList !== undefined) {
        const mappedSms: SmsMessage[] = smsList.map(s => ({
          id: s.id,
          sender: s.sender,
          rawBody: s.raw_body,
          parsedAmount: s.parsed_amount,
          parsedReferenceId: s.parsed_reference_id,
          parsedAccountNumber: s.parsed_account_number,
          parsedProvider: s.parsed_provider,
          status: s.status,
          matchedOrderId: s.matched_order_id,
          matchedOrderNumber: s.matched_order_number,
          matchedByUserId: s.matched_by_user_id,
          matchedAt: s.matched_at,
          receivedAt: s.received_at,
        }));
        saveToStorage(STORAGE_KEYS.SMS, mappedSms);
      }

      // 6. Sync Profiles (لا نستبدل المحلي إلا إذا كانت السحابة تحتوي بيانات فعلية)
      if (profileList && profileList.length > 0) {
        const storedProfiles = loadFromStorage<UserProfile[]>(STORAGE_KEYS.PROFILES, []);
        const localPasswords: Record<string, string> = {};
        storedProfiles.forEach(p => {
          if (p.password) {
            localPasswords[p.id] = p.password;
            if (p.username) localPasswords[p.username.toLowerCase().trim()] = p.password;
          }
        });

        const mappedProfiles: UserProfile[] = profileList.map(p => {
          const userKey = (p.username || '').toLowerCase().trim();
          return {
            id: p.id,
            fullName: p.full_name,
            username: p.username || '',
            password: localPasswords[p.id] || (userKey ? localPasswords[userKey] : '') || '',
            phoneNumber: p.phone_number || '',
            whatsappNumber: p.whatsapp_number || '',
            role: p.role,
            isActive: p.is_active ?? true,
            avatarUrl: p.avatar_url || undefined,
            customPermissions: p.custom_permissions || { view: true, create: true, edit: true, delete: false, reports: false },
            createdAt: p.created_at,
          };
        });

        // السحابة هي المصدر الرسمي والنهائي للموظفين — نستبدل القائمة المحلية بما هو موجود في السحابة
        // لمنع أي جهاز يحتفظ بكاش قديم من إعادة إحياء حسابات تجريبية أو مكررة
        // ✅ نستثني أي موظف حُذف محلياً أو ينتمي للحسابات التجريبية القديمة
        const deletedProfileIds = new Set<string>(
          JSON.parse(localStorage.getItem('rawdah_deleted_profile_ids') || '[]')
        );
        const filteredProfiles = mappedProfiles
          .filter(p => !DataService.isLegacyDemoProfile(p))
          .filter(p => deletedProfileIds.size === 0 || !deletedProfileIds.has(p.id));
        saveToStorage(STORAGE_KEYS.PROFILES, filteredProfiles);
      } else if (profileList && profileList.length === 0) {
        // في حالة استثنائية فقط (جدول سحابي فارغ تماماً عند أول تدشين للنظام): نرفع الحسابات المحلية
        const localProfiles = this.getProfiles();
        for (const p of localProfiles) {
          try {
            await sb.from('profiles').upsert({
              id: p.id,
              full_name: p.fullName,
              username: p.username || null,
              phone_number: p.phoneNumber || null,
              whatsapp_number: p.whatsappNumber || null,
              role: p.role,
              is_active: p.isActive,
              avatar_url: p.avatarUrl || null,
              custom_permissions: p.customPermissions,
            }, { onConflict: 'id' });
          } catch (e) {
            console.error('Initial cloud profile push exception:', e);
          }
        }
      }

      // 7. Sync Financial Accounts
      if (accList !== null && accList !== undefined) {
        const localAccMap: Record<string, FinancialAccount> = {};
        this.getFinancialAccounts().forEach(a => { localAccMap[a.id] = a; });
        const mappedAccounts: FinancialAccount[] = accList.map(a => ({
          id: a.id,
          type: a.type,
          provider: a.provider,
          currency: a.currency || localAccMap[a.id]?.currency || undefined,
          accountName: a.account_name,
          accountNumber: a.account_number,
          accountHolderName: a.account_holder_name || undefined,
          iban: a.iban || undefined,
          branchName: a.branch_name || undefined,
          currentBalance: parseFloat(a.current_balance || '0'),
          isActive: a.is_active ?? true,
          notes: a.notes || undefined,
          createdAt: a.created_at,
        }));
        if (mappedAccounts.length > 0) saveToStorage(STORAGE_KEYS.ACCOUNTS, mappedAccounts);
      }

      // 8. Sync Audit Logs (آخر 500 سجل فقط)
      if (logList !== null && logList !== undefined) {
        const nameMap: Record<string, string> = {};
        this.getProfiles().forEach(p => { nameMap[p.id] = p.fullName; });

        const mappedLogs: AuditLog[] = logList.map(l => {
          const { userName: detailsUserName, userId: detailsUserId, ...restDetails } = l.details || {};
          const resolvedName = l.user_name || detailsUserName || nameMap[l.user_id] || '';
          return {
            id: l.id,
            userId: this.resolveLogUserId(l.user_id || detailsUserId || '', resolvedName),
            userName: resolvedName,
            actionType: l.action_type,
            entityName: l.entity_name,
            entityId: l.entity_id || '',
            details: restDetails,
            createdAt: l.created_at,
          };
        });

        const cloudIds = new Set(mappedLogs.map(l => l.id));
        const localOnlyLogs = this.getAuditLogs().filter(l => !cloudIds.has(l.id));
        const merged = [...localOnlyLogs, ...mappedLogs]
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 500);
        if (mappedLogs.length > 0) saveToStorage(STORAGE_KEYS.LOGS, merged);
      }

      touchLastSync();
      if (import.meta.env.DEV) console.log('✅ Supabase Cloud Data synchronized successfully!');
    } catch (e) {
      console.error('Failed to sync from cloud:', e);
    }
  }

  // --- Realtime Webhook & Cloud Stream Listener (استقبال التحديثات اللحظية من السحابة) ---
  static initRealtimeListener(): () => void {
    if (!getIsConfigured() || !getSupabase()) return () => {};
    const sb = getSupabase()!;

    // Realtime: قناة مستقلة لكل جدول — دمج عدة فلاتر في قناة واحدة لا تصلها الأحداث
    // على خادم البث الحالي (جرّبنا 8 فلاتر في قناة واحدة فأصبحت SUBSCRIBED بلا أحداث).
    const channels: any[] = [];
    const subscribeTable = (table: string, event: 'INSERT' | '*', handler: (payload: any) => void) => {
      const wrappedHandler = (payload: any) => {
        touchLastSync();
        handler(payload);
      };
      const ch = sb
        .channel(`public:${table}`)
        .on('postgres_changes', { event, schema: 'public', table }, wrappedHandler)
        .subscribe((status: any, err?: any) => {
          console.log(`⚡ Realtime[${table}] status:`, status, err ? err : '');
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`⚠️ Realtime[${table}] فشل الاشتراك — تأكد من إضافة الجدول للـ Realtime Publication في لوحة Supabase.`);
          }
        });
      channels.push(ch);
    };

    // 1. استقبال رسائل الـ SMS اللحظية
    subscribeTable('sms_messages', 'INSERT', async (payload) => {
          const newRow = payload.new as any;
          if (!newRow || !newRow.id) return;
          console.log('⚡ SMS Realtime received from phone forwarder:', newRow);

          const currentSms = DataService.getSmsMessages();
          if (!currentSms.some(s => s.id === newRow.id)) {
            const parsed = DataService.parseSmsText(newRow.raw_body || '', newRow.sender || 'SMS');
            const mappedSms: SmsMessage = {
              id: newRow.id,
              sender: newRow.sender || 'SMS',
              rawBody: newRow.raw_body || '',
              parsedAmount: newRow.parsed_amount ?? parsed.parsedAmount,
              parsedReferenceId: newRow.parsed_reference_id ?? parsed.parsedReferenceId,
              parsedAccountNumber: newRow.parsed_account_number ?? parsed.parsedAccountNumber,
              parsedProvider: newRow.parsed_provider ?? parsed.parsedProvider,
              status: newRow.status || 'unmatched',
              matchedOrderId: newRow.matched_order_id,
              matchedOrderNumber: newRow.matched_order_number,
              receivedAt: newRow.received_at || new Date().toISOString(),
            };
            currentSms.unshift(mappedSms);
            saveToStorage(STORAGE_KEYS.SMS, currentSms);

            const outcome = await DataService.autoMatchSms(mappedSms.id);
            window.dispatchEvent(new CustomEvent('rawdah_sms_incoming', { detail: outcome }));
            window.dispatchEvent(new Event('rawdah_storage_update'));
          }
        }
    );

    // 2. استقبال العملاء المسجلين ذاتياً أو المحدثين لحظياً
    subscribeTable('customers', '*', (payload) => {
          // في أحداث DELETE يكون payload.new = {} (كائن فارغ وليس null)،
          // لذا (payload.new || payload.old) تُرجع الكائن الفارغ ويُلغي الحدث بالخطأ.
          // نستخدم payload.old للحذف لأنها تحوي الصف المحذوف (مفتاحه الأساسي على الأقل).
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;
          if (!row || !row.id) return;
          console.log('⚡ Customer Realtime event received:', payload.eventType, row);

          const currentCusts = DataService.getCustomers();
          if (payload.eventType === 'DELETE') {
            const filtered = currentCusts.filter(c => c.id !== row.id);
            saveToStorage(STORAGE_KEYS.CUSTOMERS, filtered);
          } else {
            const mapped: Customer = {
              id: row.id,
              fullName: row.full_name,
              whatsappNumber: row.whatsapp_number,
              additionalPhone: row.additional_phone || undefined,
              nickname: row.nickname || undefined,
              notes: row.notes || undefined,
              totalOrdersCount: row.total_orders_count || 0,
              totalSpent: parseFloat(row.total_spent || '0'),
              createdAt: row.created_at || new Date().toISOString(),
            };

            const idx = currentCusts.findIndex(c => c.id === mapped.id);
            if (idx >= 0) {
              currentCusts[idx] = { ...currentCusts[idx], ...mapped };
            } else {
              currentCusts.unshift(mapped);
            }
            saveToStorage(STORAGE_KEYS.CUSTOMERS, currentCusts);
            window.dispatchEvent(new CustomEvent('rawdah_customer_incoming', { detail: mapped }));
          }
          window.dispatchEvent(new Event('rawdah_storage_update'));
        }
    );

    // 3. استقبال تحديثات الطلبات لحظياً
    subscribeTable('sales_orders', '*', (payload) => {
          // في أحداث DELETE يكون payload.new = {} (كائن فارغ وليس null)،
          // لذا (payload.new || payload.old) تُرجع الكائن الفارغ ويُلغي الحدث بالخطأ.
          // نستخدم payload.old للحذف لأنها تحوي الصف المحذوف (مفتاحه الأساسي على الأقل).
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;
          if (!row || !row.id) return;
          console.log('⚡ Order Realtime event received:', payload.eventType, row);

          const currentOrders = DataService.getOrders();
          if (payload.eventType === 'DELETE') {
            const filtered = currentOrders.filter(o => o.id !== row.id);
            saveToStorage(STORAGE_KEYS.ORDERS, filtered);
          } else {
            // التقسيم ذكر/أنثى وسجل السدادات — يُقرأ من العمود السحابي ومع غيابه يُؤخَذ من المحلي
            const local = currentOrders.find(o => o.id === row.id);
            const mappedOrder: SalesOrder = {
              id: row.id,
              orderNumber: row.order_number,
              customerId: row.customer_id,
              customerName: row.customer_name || '',
              customerWhatsapp: row.customer_whatsapp || '',
              permitsCount: row.permits_count,
              permitsCountMale: row.permits_count_male ?? local?.permitsCountMale,
              permitsCountFemale: row.permits_count_female ?? local?.permitsCountFemale,
              targetDate: row.target_date,
              targetTime: row.target_time,
              orderType: row.order_type,
              orderStatus: row.order_status,
              deliveryStatus: row.delivery_status,
              unitPrice: parseFloat(row.unit_price || '0'),
              totalAmount: parseFloat(row.total_amount || '0'),
              paidAmount: parseFloat(row.paid_amount || '0'),
              remainingAmount: parseFloat(row.remaining_amount || '0'),
              currency: row.currency || 'SAR',
              isArchived: row.is_archived ?? false,
              archivedAt: row.archived_at || undefined,
              payments: Array.isArray(row.payments) ? row.payments : local?.payments,
              lastReminderAt: row.last_reminder_at || local?.lastReminderAt || undefined,
              assignedPermitIds: local?.assignedPermitIds,
              notes: row.notes,
              createdBy: row.created_by || '',
              createdAt: row.created_at,
            };

            const idx = currentOrders.findIndex(o => o.id === mappedOrder.id);
            if (idx >= 0) {
              currentOrders[idx] = { ...currentOrders[idx], ...mappedOrder };
            } else {
              currentOrders.unshift(mappedOrder);
            }
            saveToStorage(STORAGE_KEYS.ORDERS, currentOrders);
          }
          window.dispatchEvent(new Event('rawdah_storage_update'));
        }
    );

    // 4. استقبال تحديثات التصاريح لحظياً (سحب/إرجاع/رفع صورة)
    subscribeTable('permits', '*', (payload) => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;
          if (!row || !row.id) return;
          console.log('⚡ Permit Realtime event received:', payload.eventType, row);

          const currentPermits = DataService.getPermits();
          if (payload.eventType === 'DELETE') {
            const filtered = currentPermits.filter(p => p.id !== row.id);
            saveToStorage(STORAGE_KEYS.PERMITS, filtered);
          } else {
            const cust = row.assigned_to_customer_id ? DataService.getCustomers().find(c => c.id === row.assigned_to_customer_id) : undefined;
            const user = row.assigned_by_user_id ? DataService.getProfiles().find(u => u.id === row.assigned_by_user_id) : undefined;
            const mapped: Permit = {
              id: row.id,
              permitCode: row.permit_code,
              slotDate: row.slot_date,
              slotHour: row.slot_hour,
              slotMinute: row.slot_minute,
              slotFormatted: row.slot_formatted || `${String(row.slot_hour).padStart(2, '0')}:${String(row.slot_minute).padStart(2, '0')}`,
              imageUrl: row.image_url,
              status: row.status,
              assignedToCustomerId: row.assigned_to_customer_id,
              assignedCustomerName: row.assigned_customer_name || cust?.fullName,
              assignedByUserId: row.assigned_by_user_id,
              assignedByUserName: row.assigned_by_user_name || user?.fullName,
              assignedAt: row.assigned_at,
              notes: row.notes,
              createdAt: row.created_at,
            };

            const idx = currentPermits.findIndex(p => p.id === mapped.id);
            if (idx >= 0) {
              currentPermits[idx] = { ...currentPermits[idx], ...mapped };
            } else {
              currentPermits.unshift(mapped);
            }
            saveToStorage(STORAGE_KEYS.PERMITS, currentPermits);
            window.dispatchEvent(new CustomEvent('rawdah_permit_update', { detail: mapped }));
          }
          window.dispatchEvent(new Event('rawdah_storage_update'));
        }
    );

    // 4ب. استقبال تحديثات ربط التصاريح بالطلبات لحظياً (order_permits)
    subscribeTable('order_permits', '*', (payload) => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;
      if (!row || !row.order_id || !row.permit_id) return;
      console.log('⚡ Order Permit Link Realtime event:', payload.eventType, row);

      const currentOrders = DataService.getOrders();
      const order = currentOrders.find(o => o.id === row.order_id);
      if (!order) return;
      const existing = order.assignedPermitIds || [];
      if (payload.eventType === 'DELETE') {
        order.assignedPermitIds = existing.filter(id => id !== row.permit_id);
      } else {
        if (!existing.includes(row.permit_id)) {
          order.assignedPermitIds = [...existing, row.permit_id];
        }
      }
      saveToStorage(STORAGE_KEYS.ORDERS, currentOrders);
      window.dispatchEvent(new Event('rawdah_storage_update'));
    });

    // 5. استقبال تحديثات أرصدة الحسابات المالية لحظياً
    subscribeTable('financial_accounts', '*', (payload) => {
          // في أحداث DELETE يكون payload.new = {} (كائن فارغ وليس null)،
          // لذا (payload.new || payload.old) تُرجع الكائن الفارغ ويُلغي الحدث بالخطأ.
          // نستخدم payload.old للحذف لأنها تحوي الصف المحذوف (مفتاحه الأساسي على الأقل).
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;
          if (!row || !row.id) return;
          console.log('⚡ Financial account Realtime event received:', payload.eventType, row);

          const currentAccs = DataService.getFinancialAccounts();
          if (payload.eventType === 'DELETE') {
            const filtered = currentAccs.filter(a => a.id !== row.id);
            saveToStorage(STORAGE_KEYS.ACCOUNTS, filtered);
          } else {
            const local = currentAccs.find(a => a.id === row.id);
            const mapped: FinancialAccount = {
              id: row.id,
              type: row.type,
              provider: row.provider,
              currency: row.currency || local?.currency || undefined,
              accountName: row.account_name,
              accountNumber: row.account_number,
              accountHolderName: row.account_holder_name || undefined,
              iban: row.iban || undefined,
              branchName: row.branch_name || undefined,
              currentBalance: parseFloat(row.current_balance || '0'),
              isActive: row.is_active ?? true,
              notes: row.notes || undefined,
              createdAt: row.created_at,
            };

            const idx = currentAccs.findIndex(a => a.id === mapped.id);
            if (idx >= 0) {
              currentAccs[idx] = { ...currentAccs[idx], ...mapped };
            } else {
              currentAccs.push(mapped);
            }
            saveToStorage(STORAGE_KEYS.ACCOUNTS, currentAccs);
          }
          window.dispatchEvent(new Event('rawdah_storage_update'));
        }
    );

    // 6. استقبال تحديثات بيانات الموظفين لحظياً (كلمات المرور محلية فقط فلا تأتي من السحابة)
    subscribeTable('profiles', '*', (payload) => {
          // في أحداث DELETE يكون payload.new = {} (كائن فارغ وليس null)،
          // لذا (payload.new || payload.old) تُرجع الكائن الفارغ ويُلغي الحدث بالخطأ.
          // نستخدم payload.old للحذف لأنها تحوي الصف المحذوف (مفتاحه الأساسي على الأقل).
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;
          if (!row || !row.id) return;
          console.log('⚡ Profile Realtime event received:', payload.eventType, row);

          const currentProfiles = DataService.getProfiles();
          if (payload.eventType === 'DELETE') {
            // لا نحذف المستخدم الحالي من جهازه — يسجل خروج يدوي إذا لزم
            const filtered = currentProfiles.filter(p => p.id !== row.id);
            saveToStorage(STORAGE_KEYS.PROFILES, filtered);
          } else {
            const local = currentProfiles.find(p => p.id === row.id);
            const mapped: UserProfile = {
              id: row.id,
              fullName: row.full_name,
              username: row.username || '',
              password: local?.password || '',
              phoneNumber: row.phone_number || '',
              whatsappNumber: row.whatsapp_number || '',
              role: row.role,
              isActive: row.is_active ?? true,
              avatarUrl: row.avatar_url || undefined,
              customPermissions: row.custom_permissions || { view: true, create: true, edit: true, delete: false, reports: false },
              createdAt: row.created_at,
            };

            const idx = currentProfiles.findIndex(p => p.id === mapped.id);
            if (idx >= 0) {
              currentProfiles[idx] = { ...currentProfiles[idx], ...mapped };
            } else {
              currentProfiles.push(mapped);
            }
            saveToStorage(STORAGE_KEYS.PROFILES, currentProfiles);
          }
          window.dispatchEvent(new Event('rawdah_storage_update'));
        }
    );

    // 7. استقبال تغييرات إعدادات الشركة لحظياً
    subscribeTable('company_settings', '*', (payload) => {
          const row = payload.new as any;
          if (!row || !row.id) return;
          console.log('⚡ Company settings Realtime event received:', payload.eventType, row);

          const currentSettings = DataService.getCompanySettings();
          const price = (row.default_permit_price !== undefined && row.default_permit_price !== null)
            ? Number(row.default_permit_price)
            : currentSettings.defaultPermitPrice;
          if (price) saveToStorage(STORAGE_KEYS.PERMIT_PRICE, price);

          const mapped: CompanySettings = {
            id: row.id,
            companyNameAr: row.company_name_ar || '',
            companyNameEn: row.company_name_en || '',
            address: row.address || '',
            primaryPhone: row.primary_phone || '',
            secondaryPhone: row.secondary_phone || '',
            whatsappNumber: row.whatsapp_number || '',
            email: row.email || '',
            logoUrl: row.logo_url || '',
            taxNumber: row.tax_number || '',
            commercialRegistry: row.commercial_registry || '',
            invoiceFooterNote: row.invoice_footer_note || '',
            currency: row.currency || 'SAR',
            defaultPermitPrice: price,
          };
          saveToStorage(STORAGE_KEYS.SETTINGS, mapped);
          window.dispatchEvent(new Event('rawdah_storage_update'));
        }
    );

    // 8. استقبال سجلات التدقيق اللحظية (إدراج فقط — الجدول append-only)
    subscribeTable('audit_logs', 'INSERT', (payload) => {
          const row = payload.new as any;
          if (!row || !row.id) return;
          console.log('⚡ Audit log Realtime event received:', row);

          // استلام تحديثات سعر التصريح لحظياً عبر السحابة
          if (row.entity_name === 'company_settings' && row.details?.defaultPermitPrice) {
            const newPrice = Number(row.details.defaultPermitPrice);
            if (!Number.isNaN(newPrice) && newPrice > 0) {
              saveToStorage(STORAGE_KEYS.PERMIT_PRICE, newPrice);
              const cur = DataService.getCompanySettings();
              saveToStorage(STORAGE_KEYS.SETTINGS, { ...cur, defaultPermitPrice: newPrice });
              window.dispatchEvent(new Event('rawdah_storage_update'));
            }
          }

          const currentLogs = DataService.getAuditLogs();
          if (!currentLogs.some(l => l.id === row.id)) {
            const nameMap: Record<string, string> = {};
            DataService.getProfiles().forEach(p => { nameMap[p.id] = p.fullName; });
            const { userName: detailsUserName, ...restDetails } = row.details || {};
            const mapped: AuditLog = {
              id: row.id,
              userId: row.user_id || '',
              userName: row.user_name || detailsUserName || nameMap[row.user_id] || '',
              actionType: row.action_type,
              entityName: row.entity_name,
              entityId: row.entity_id || '',
              details: restDetails,
              createdAt: row.created_at,
            };
            currentLogs.unshift(mapped);
            saveToStorage(STORAGE_KEYS.LOGS, currentLogs.slice(0, 500));
            window.dispatchEvent(new Event('rawdah_storage_update'));
          }
        }
    );

    return () => {
      channels.forEach(ch => sb.removeChannel(ch));
    };
  }

  // --- Company Settings ---
  static getCompanySettings(): CompanySettings {
    const s = loadFromStorage(STORAGE_KEYS.SETTINGS, initialCompanySettings);
    const savedPrice = loadFromStorage<number | null>(STORAGE_KEYS.PERMIT_PRICE, null);
    const defaultPermitPrice = (savedPrice !== null && !Number.isNaN(savedPrice) && savedPrice > 0)
      ? savedPrice
      : (s.defaultPermitPrice ?? 150);
    const result: CompanySettings = {
      ...s,
      defaultPermitPrice,
    };
    if (typeof document !== 'undefined' && result.companyNameAr && !document.title.startsWith(result.companyNameAr)) {
      document.title = `${result.companyNameAr} | نظام تصاريح الروضة`;
    }
    return result;
  }

  /** جلب مباشر وتحديث إعدادات المؤسسة من السحابة فوراً مع تحديث العنوان والشاشات */
  static async syncCompanySettingsFromCloud(): Promise<CompanySettings> {
    if (!getIsConfigured() || !getSupabase()) return this.getCompanySettings();
    try {
      const { data, error } = await getSupabase()!
        .from('company_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const s = data[0];
        let price: number | null = (s.default_permit_price !== undefined && s.default_permit_price !== null)
          ? Number(s.default_permit_price)
          : null;

        if (price === null || Number.isNaN(price) || price <= 0) {
          try {
            const { data: logData } = await getSupabase()!
              .from('audit_logs')
              .select('details')
              .eq('entity_name', 'company_settings')
              .order('created_at', { ascending: false })
              .limit(1);
            if (logData && logData[0]?.details?.defaultPermitPrice) {
              const parsed = Number(logData[0].details.defaultPermitPrice);
              if (!Number.isNaN(parsed) && parsed > 0) price = parsed;
            }
          } catch {
            /* ignore */
          }
        }

        const currentLocal = this.getCompanySettings();
        const finalPrice = (price !== null && !Number.isNaN(price) && price > 0) ? price : currentLocal.defaultPermitPrice;
        saveToStorage(STORAGE_KEYS.PERMIT_PRICE, finalPrice);

        const mapped: CompanySettings = {
          id: s.id,
          companyNameAr: s.company_name_ar || '',
          companyNameEn: s.company_name_en || '',
          address: s.address || '',
          primaryPhone: s.primary_phone || '',
          secondaryPhone: s.secondary_phone || '',
          whatsappNumber: s.whatsapp_number || '',
          email: s.email || '',
          logoUrl: s.logo_url || '',
          taxNumber: s.tax_number || '',
          commercialRegistry: s.commercial_registry || '',
          invoiceFooterNote: s.invoice_footer_note || '',
          currency: s.currency || 'SAR',
          defaultPermitPrice: finalPrice,
        };
        saveToStorage(STORAGE_KEYS.SETTINGS, mapped, true);
        if (typeof document !== 'undefined' && mapped.companyNameAr) {
          document.title = `${mapped.companyNameAr} | نظام تصاريح الروضة`;
        }
        return mapped;
      }
    } catch (e) {
      console.warn('Direct company settings sync warning:', e);
    }
    return this.getCompanySettings();
  }

  /** آخر مرة وصلت فيها بيانات من السحابة (مزامنة يدوية أو حدث لحظي) */
  static getLastCloudSync(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }

  static async updateCompanySettings(settings: Partial<CompanySettings>): Promise<{ settings: CompanySettings; localSaved: boolean }> {
    const current = this.getCompanySettings();
    const updated = { ...current, ...settings };
    if (settings.defaultPermitPrice !== undefined && settings.defaultPermitPrice !== null) {
      const p = Number(settings.defaultPermitPrice);
      if (!Number.isNaN(p) && p > 0) {
        saveToStorage(STORAGE_KEYS.PERMIT_PRICE, p);
        updated.defaultPermitPrice = p;
      }
    }
    const localSaved = saveToStorage(STORAGE_KEYS.SETTINGS, updated);

    // Push to Supabase Cloud directly
    if (getIsConfigured() && getSupabase()) {
      const sb = getSupabase()!;
      try {
        const rowId = updated.id || '00000000-0000-0000-0000-000000000001';

        const payload: Record<string, any> = {
          id: rowId,
          company_name_ar: updated.companyNameAr,
          company_name_en: updated.companyNameEn,
          address: updated.address,
          primary_phone: updated.primaryPhone,
          secondary_phone: updated.secondaryPhone || null,
          whatsapp_number: updated.whatsappNumber,
          email: updated.email,
          logo_url: updated.logoUrl || null,
          tax_number: updated.taxNumber || null,
          commercial_registry: updated.commercialRegistry || null,
          invoice_footer_note: updated.invoiceFooterNote,
          currency: updated.currency,
          updated_at: new Date().toISOString(),
        };

        let { data, error } = await sb.from('company_settings').upsert({
          ...payload,
          default_permit_price: updated.defaultPermitPrice,
        }, { onConflict: 'id' }).select();

        if (error && error.message?.includes('default_permit_price')) {
          ({ data, error } = await sb.from('company_settings').upsert(payload, { onConflict: 'id' }).select());
        }

        // تسجيل دائم في audit_logs ليتمكن كل مستخدم في أي جهاز من مزامنة السعر فوراً
        const user = this.getCurrentUser();
        const validUuid = user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) ? user.id : null;
        sb.from('audit_logs').insert({
          user_id: validUuid,
          action_type: 'UPDATE_SETTINGS',
          entity_name: 'company_settings',
          entity_id: rowId,
          details: { defaultPermitPrice: updated.defaultPermitPrice, currency: updated.currency, updatedBy: user?.fullName || 'المدير العام' },
        }).then(({ error: logErr }) => {
          if (logErr) console.warn('Company settings audit log warning:', logErr);
        });

        if (error) {
          console.error('Cloud update error in Supabase:', error);
        } else {
          console.log('✅ Company settings saved to Cloud:', data);
          if (data && data[0]) {
            const finalUpdated = { ...updated, id: data[0].id };
            saveToStorage(STORAGE_KEYS.SETTINGS, finalUpdated);
            return { settings: finalUpdated, localSaved };
          }
        }
      } catch (err) {
        console.error('Supabase write error:', err);
      }
    }

    return { settings: updated, localSaved };
  }

  // --- Message Templates (قوالب رسائل الواتساب والتواصل) ---
  static getMessageTemplates(): MessageTemplates {
    const saved = loadFromStorage<Partial<MessageTemplates>>(STORAGE_KEYS.TEMPLATES, {});
    return {
      ...initialMessageTemplates,
      ...saved,
    };
  }

  static async syncMessageTemplatesFromCloud(): Promise<MessageTemplates> {
    if (!getIsConfigured() || !getSupabase()) return this.getMessageTemplates();
    try {
      const { data, error } = await getSupabase()!
        .from('audit_logs')
        .select('details')
        .eq('entity_name', 'message_templates')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0]?.details?.templates) {
        const cloudTemplates = data[0].details.templates;
        const merged: MessageTemplates = {
          ...initialMessageTemplates,
          ...cloudTemplates,
        };
        saveToStorage(STORAGE_KEYS.TEMPLATES, merged, true);
        return merged;
      }
    } catch (e) {
      console.warn('Sync message templates warning:', e);
    }
    return this.getMessageTemplates();
  }

  static async updateMessageTemplates(templates: Partial<MessageTemplates>): Promise<MessageTemplates> {
    const current = this.getMessageTemplates();
    const updated: MessageTemplates = {
      ...current,
      ...templates,
    };
    saveToStorage(STORAGE_KEYS.TEMPLATES, updated);

    // مزامنة مع السحابة عبر audit_logs
    if (getIsConfigured() && getSupabase()) {
      try {
        const user = this.getCurrentUser();
        const validUuid = user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) ? user.id : null;
        await getSupabase()!.from('audit_logs').insert({
          user_id: validUuid,
          action_type: 'UPDATE_SETTINGS',
          entity_name: 'message_templates',
          entity_id: '00000000-0000-0000-0000-000000000001',
          details: {
            templates: updated,
            updatedBy: user?.fullName || 'المدير العام',
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.warn('Could not push message templates to audit_logs:', err);
      }
    }

    return updated;
  }

  // --- Financial Accounts ---
  static getFinancialAccounts(): FinancialAccount[] {
    return loadFromStorage(STORAGE_KEYS.ACCOUNTS, initialFinancialAccounts);
  }

  static async saveFinancialAccount(account: Omit<FinancialAccount, 'id' | 'createdAt'> & { id?: string }): Promise<FinancialAccount> {
    const accounts = this.getFinancialAccounts();
    const id = account.id || generateUUID();
    const newAcc: FinancialAccount = {
      ...account,
      id,
      createdAt: new Date().toISOString(),
    };

    const idx = accounts.findIndex(a => a.id === id);
    if (idx >= 0) {
      accounts[idx] = newAcc;
    } else {
      accounts.push(newAcc);
    }
    saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);

    // Push to cloud
    if (getIsConfigured() && getSupabase()) {
      try {
        const payload: Record<string, any> = {
          id: newAcc.id,
          account_name: newAcc.accountName,
          account_number: newAcc.accountNumber,
          type: newAcc.type,
          provider: newAcc.provider,
          account_holder_name: newAcc.accountHolderName || null,
          iban: newAcc.iban || null,
          branch_name: newAcc.branchName || null,
          current_balance: newAcc.currentBalance,
          is_active: newAcc.isActive,
          notes: newAcc.notes || null,
        };
        let { error } = await getSupabase()!
          .from('financial_accounts')
          .upsert({ ...payload, currency: newAcc.currency || null }, { onConflict: 'id' });
        if (error) {
          console.warn('financial_accounts: تعذر حفظ عمود currency — سيُحفظ محلياً فقط:', error.message);
          ({ error } = await getSupabase()!.from('financial_accounts').upsert(payload, { onConflict: 'id' }));
        }
        if (error) console.error('financial_accounts upsert error:', error);
      } catch (e) {
        console.error(e);
      }
    }

    return newAcc;
  }

  /** حذف حساب مالي (مخصص للمدير العام للحسابات الصفرية أو غير المستخدمة) */
  static async deleteFinancialAccount(id: string): Promise<{ success: boolean; message: string }> {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'super_admin') {
      return { success: false, message: 'عذراً، حذف الحسابات المالية مخصص للمدير العام فقط.' };
    }
    const accounts = this.getFinancialAccounts();
    const acc = accounts.find(a => a.id === id);
    if (!acc) return { success: false, message: 'الحساب غير موجود.' };

    if (Math.abs(acc.currentBalance) > 0.01) {
      return {
        success: false,
        message: `لا يمكن حذف الحساب «${acc.accountName}» لوجود رصيد مالي به (${acc.currentBalance} ${currencySymbol(accountCurrency(acc))}). يرجى تصفية الرصيد أولاً قبل الحذف.`,
      };
    }

    const filtered = accounts.filter(a => a.id !== id);
    saveToStorage(STORAGE_KEYS.ACCOUNTS, filtered);

    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('financial_accounts').delete().eq('id', id);
      } catch (e) {
        console.error('Cloud delete financial account error:', e);
      }
    }

    this.addAuditLog(currentUser.id, currentUser.fullName, 'DELETE_FINANCIAL_ACCOUNT', 'financial_accounts', id, {
      accountName: acc.accountName,
      provider: acc.provider,
      balance: acc.currentBalance,
    });

    return { success: true, message: `تم حذف الحساب «${acc.accountName}» بنجاح.` };
  }

  /** تعديل رصيد حساب مالي يدوياً (إيداع / سحب / تسوية رصيد) مع توثيق السبب */
  static async adjustAccountBalance(
    accountId: string,
    delta: number,
    reason: string
  ): Promise<{ success: boolean; message: string; newBalance?: number }> {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'super_admin' && !currentUser.customPermissions?.edit) {
      return { success: false, message: 'عذراً، لا تملك صلاحية تعديل رصيد الخزينة.' };
    }
    const cleanDelta = Math.round(Number(delta) * 100) / 100;
    if (isNaN(cleanDelta) || cleanDelta === 0) {
      return { success: false, message: 'يرجى إدخال قيمة تعديل صحيحة غير صفرية.' };
    }
    if (!reason || !reason.trim()) {
      return { success: false, message: 'يرجى كتابة سبب أو ملاحظة عملية تعديل الرصيد.' };
    }

    const accounts = this.getFinancialAccounts();
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return { success: false, message: 'الحساب المالي غير موجود.' };

    const newBalance = Math.round((acc.currentBalance + cleanDelta) * 100) / 100;
    if (newBalance < 0) {
      return { success: false, message: `لا يمكن السحب بمبلغ أكبر من الرصيد الحالي (${acc.currentBalance} ${currencySymbol(accountCurrency(acc))}).` };
    }

    acc.currentBalance = newBalance;
    saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);

    if (getIsConfigured() && getSupabase()) {
      try {
        const { error } = await getSupabase()!.rpc('rpc_adjust_balance', {
          p_account_id: accountId,
          p_delta: cleanDelta,
          p_reason: reason.trim(),
        });
        if (error) {
          await getSupabase()!.from('financial_accounts').update({
            current_balance: newBalance,
          }).eq('id', accountId);
        }
      } catch (e) {
        console.error('Cloud balance adjustment error:', e);
      }
    }

    this.addAuditLog(currentUser.id, currentUser.fullName, 'ADJUST_ACCOUNT_BALANCE', 'financial_accounts', accountId, {
      accountName: acc.accountName,
      delta: cleanDelta,
      newBalance,
      reason: reason.trim(),
    });

    const actionText = cleanDelta > 0 ? 'إيداع' : 'سحب/تسوية';
    return {
      success: true,
      message: `تم ${actionText} مبلغ ${Math.abs(cleanDelta)} ${currencySymbol(accountCurrency(acc))} في «${acc.accountName}» بنجاح (الرصيد الجديد: ${newBalance}).`,
      newBalance,
    };
  }

  static isLegacyDemoProfile(p: Partial<UserProfile>): boolean {
    if (!p) return false;
    const name = (p.fullName || '').trim();
    const uname = (p.username || '').toLowerCase().trim();
    const phone = (p.phoneNumber || '').trim();
    const id = (p.id || '').trim();

    // استثناء الحسابات الحقيقية المعتمدة
    if (uname === 'admin' || id === '07d05943-93b3-4942-80b3-af74c01f710e') return false;

    // 1. حسابات تجريبية بأسماء عامة قديمة
    if (name === 'المدير العام' || name === 'موظف المبيعات' || name === 'مسؤول المخزون والتصاريح') return true;

    // 2. حسابات تجريبية بأرقام وهمية مسلسلة (+96650000000X)
    if (['+966500000001', '+966500000002', '+966500000003', '+966500000005', '966500000001', '966500000002', '966500000003', '966500000005'].includes(phone)) return true;

    // 3. حسابات اختبار ومخلفات قديمة
    if (uname === 'inventory' || uname === 'sara' || uname === 'faridmariam435@gmail.com' || uname.includes('qa_sales') || uname.includes('@rawdah.app') || (p.password === '1234' && uname.includes('@gmail.com'))) return true;

    return false;
  }

  static getProfiles(): UserProfile[] {
    // لا حسابات افتراضية في الحزمة: القائمة تأتي من السحابة (syncFromCloud) أو
    // من التخزين المحلي لما زامنته سابقاً. لا كلمات مرور هنا إطلاقاً.
    const list = loadFromStorage<UserProfile[]>(STORAGE_KEYS.PROFILES, []);
    const valid = list.filter(p => !this.isLegacyDemoProfile(p));
    try {
      const deletedIds = new Set<string>(JSON.parse(localStorage.getItem('rawdah_deleted_profile_ids') || '[]'));
      if (deletedIds.size > 0) {
        return valid.filter(p => !deletedIds.has(p.id));
      }
    } catch { /* ignore */ }
    return valid;
  }

  static getCurrentUser(): UserProfile | null {
    return loadFromStorage<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  static setCurrentUser(user: UserProfile): void {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
  }

  static async saveProfile(data: Omit<UserProfile, 'id' | 'createdAt'> & { id?: string }): Promise<{ profile: UserProfile; localSaved: boolean }> {
    const profiles = this.getProfiles();
    const existing = profiles.find(p => (data.id && p.id === data.id) || (data.username && p.username.toLowerCase() === data.username.toLowerCase()));
    const id = data.id || existing?.id || generateUUID();

    const newProfile: UserProfile = {
      ...data,
      id,
      // عند التعديل بدون إدخال كلمة مرور جديدة نُبقي القديمة
      password: data.password || existing?.password || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    const idx = profiles.findIndex(p => p.id === id || (newProfile.username && p.username.toLowerCase() === newProfile.username.toLowerCase()));
    if (idx >= 0) {
      profiles[idx] = newProfile;
    } else {
      profiles.push(newProfile);
    }
    const localSaved = saveToStorage(STORAGE_KEYS.PROFILES, profiles);
    try {
      const deletedIds: string[] = JSON.parse(localStorage.getItem('rawdah_deleted_profile_ids') || '[]');
      if (deletedIds.includes(id)) {
        localStorage.setItem('rawdah_deleted_profile_ids', JSON.stringify(deletedIds.filter(x => x !== id)));
      }
    } catch { /* ignore */ }

    // Push to cloud — كلمات المرور لا تُرسل أبداً
    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('profiles').upsert({
          id: newProfile.id,
          full_name: newProfile.fullName,
          username: newProfile.username,
          phone_number: newProfile.phoneNumber || null,
          whatsapp_number: newProfile.whatsappNumber || null,
          role: newProfile.role,
          is_active: newProfile.isActive,
          avatar_url: newProfile.avatarUrl || null,
          custom_permissions: newProfile.customPermissions,
        }, { onConflict: 'id' });
      } catch (e) {
        console.error(e);
      }
    }

    return { profile: newProfile, localSaved };
  }

  static isUsernameTaken(username: string, excludeId?: string): boolean {
    const target = username.trim().toLowerCase();
    return this.getProfiles().some(p => p.id !== excludeId && p.username.toLowerCase() === target);
  }

  static async deleteProfile(id: string): Promise<{ localSaved: boolean; notFound: boolean; cloudFailed: boolean }> {
    const profiles = this.getProfiles();
    const target = profiles.find(p => p.id === id || p.username === id);
    if (!target) return { localSaved: true, notFound: true, cloudFailed: false };

    const localSaved = saveToStorage(STORAGE_KEYS.PROFILES, profiles.filter(p => p.id !== target.id && p.username !== target.username));
    if (!localSaved) return { localSaved: false, notFound: false, cloudFailed: false };

    // ✅ حفظ معرّف الموظف المحذوف في قائمة محلية دائمة لمنع syncFromCloud من إعادته
    try {
      const deletedIds: string[] = JSON.parse(localStorage.getItem('rawdah_deleted_profile_ids') || '[]');
      if (!deletedIds.includes(target.id)) {
        deletedIds.push(target.id);
        localStorage.setItem('rawdah_deleted_profile_ids', JSON.stringify(deletedIds));
      }
    } catch { /* ignore */ }

    let cloudFailed = false;
    if (getIsConfigured() && getSupabase()) {
      // جدول profiles السحابي مفتاحه UUID ومرتبط بـ auth.users، فالموظفون المحليون (معرّفاتهم نصية) لا وجود لهم فيه
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const targetId = target.id;
      if (uuidRegex.test(targetId)) {
        try {
          const { error } = await getSupabase()!.from('profiles').delete().eq('id', targetId);
          if (error) {
            cloudFailed = true;
            console.error('Cloud profile delete error:', error);
            // حتى لو فشل الحذف السحابي (FK constraint) — الموظف سيُحجب محلياً عبر rawdah_deleted_profile_ids
          }
        } catch (e) {
          cloudFailed = true;
          console.error(e);
        }
      }
    }

    const admin = this.getCurrentUser();
    this.addAuditLog(admin.id, admin.fullName, 'DELETE_PROFILE', 'profiles', id, {
      fullName: target.fullName,
      username: target.username,
      role: target.role,
    });

    return { localSaved: true, notFound: false, cloudFailed };
  }

  // --- الملف الشخصي (خدمة ذاتية للموظف) ---

  static async updateOwnProfile(updates: {
    fullName: string;
    username: string;
    phoneNumber: string;
    whatsappNumber: string;
    avatarUrl?: string;
  }): Promise<{ profile: UserProfile; localSaved: boolean; usernameTaken: boolean }> {
    const currentUser = this.getCurrentUser();
    const stored = this.getProfiles().find(p => p.id === currentUser.id) || currentUser;

    if (this.isUsernameTaken(updates.username, stored.id)) {
      return { profile: stored, localSaved: false, usernameTaken: true };
    }

    const { profile, localSaved } = await this.saveProfile({
      id: stored.id,
      fullName: updates.fullName,
      username: updates.username,
      password: '', // الإبقاء على كلمة المرور الحالية
      phoneNumber: updates.phoneNumber,
      whatsappNumber: updates.whatsappNumber,
      role: stored.role,
      isActive: stored.isActive,
      avatarUrl: updates.avatarUrl?.trim() || undefined,
      customPermissions: stored.customPermissions,
    });

    if (!localSaved) return { profile, localSaved, usernameTaken: false };

    this.setCurrentUser(profile);

    // لا نُدرج الصورة في السجل (قد تكون data URL ضخمة) — نكتفي بإشارة تغيّرها
    const avatarChanged = (stored.avatarUrl || '') !== (profile.avatarUrl || '');
    this.addAuditLog(profile.id, profile.fullName, 'UPDATE_PROFILE', 'profiles', profile.id, {
      employeeName: profile.fullName,
      username: profile.username,
      before: {
        fullName: stored.fullName,
        username: stored.username,
        phoneNumber: stored.phoneNumber,
        whatsappNumber: stored.whatsappNumber,
      },
      after: {
        fullName: profile.fullName,
        username: profile.username,
        phoneNumber: profile.phoneNumber,
        whatsappNumber: profile.whatsappNumber,
      },
      avatarChanged,
      source: 'الملف الشخصي (خدمة ذاتية)',
    });

    return { profile, localSaved, usernameTaken: false };
  }

  static async changeOwnPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: 'wrong_current' | 'local_save_failed' }> {
    const currentUser = this.getCurrentUser();
    const stored = this.getProfiles().find(p => p.id === currentUser.id);

    if (!stored || !stored.password) {
      return { success: false, error: 'wrong_current' };
    }

    const { matches } = await verifyPassword(currentPassword, stored.password);
    if (!matches) {
      return { success: false, error: 'wrong_current' };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const { profile, localSaved } = await this.saveProfile({ ...stored, password: newPasswordHash });
    if (!localSaved) return { success: false, error: 'local_save_failed' };

    // تحديث كلمة المرور في Supabase Auth أيضاً — يعمل فقط عند وجود جلسة مصادقة حقيقية
    // (الدخول الاحتياطي المحلي قبل تهيئة مستخدمي Auth لا يملك جلسة، فنتجاهل الفشل بصمت)
    if (getIsConfigured() && getSupabase()) {
      try {
        const { error: authErr } = await getSupabase()!.auth.updateUser({ password: newPassword });
        if (authErr) console.warn('⚠️ تعذر تحديث كلمة المرور في Supabase Auth (لا توجد جلسة مصادقة على الأرجح):', authErr.message);
      } catch (e) {
        console.warn('⚠️ استثناء أثناء تحديث كلمة المرور في Supabase Auth:', e);
      }
    }

    this.setCurrentUser(profile);

    // لا تُسجَّل كلمات المرور أبداً في سجل التدقيق
    this.addAuditLog(profile.id, profile.fullName, 'UPDATE_PROFILE', 'profiles', profile.id, {
      employeeName: profile.fullName,
      username: profile.username,
      passwordChanged: true,
      source: 'الملف الشخصي (خدمة ذاتية)',
    });

    return { success: true };
  }

  // --- Customers ---
  static getCustomers(): Customer[] {
    return loadFromStorage(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  }

  /** حفظ قائمة عملاء مباشرةً في localStorage بشكل متزامن — تُستخدم للبذر السريع فقط */
  static saveCustomersBulkSync(customers: Customer[]): void {
    const existing = this.getCustomers();
    const existingMap = new Map(existing.map(c => [c.id, c]));
    customers.forEach(c => existingMap.set(c.id, c));
    saveToStorage(STORAGE_KEYS.CUSTOMERS, [...existingMap.values()]);
  }

  static async saveCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'totalOrdersCount' | 'totalSpent'> & { id?: string }): Promise<Customer> {
    const customers = this.getCustomers();
    const id = customer.id || generateUUID();
    const newCustomer: Customer = {
      ...customer,
      id,
      totalOrdersCount: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
    };

    const idx = customers.findIndex(c => c.id === id);
    if (idx >= 0) {
      customers[idx] = { ...customers[idx], ...customer };
    } else {
      customers.unshift(newCustomer);
    }
    saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);

    // تعميم الاسم/رقم الواتساب على كل طلبات هذا العميل — الطلبات تحمل نسخة وقت الإنشاء
    const orders = this.getOrders();
    const updatedOrders = orders.map(o => {
      if (o.customerId !== id) return o;
      if (o.customerName === customer.fullName && o.customerWhatsapp === customer.whatsappNumber) return o;
      return { ...o, customerName: customer.fullName, customerWhatsapp: customer.whatsappNumber };
    });
    const ordersChanged = updatedOrders.some((o, i) => o !== orders[i]);
    if (ordersChanged) {
      saveToStorage(STORAGE_KEYS.ORDERS, updatedOrders);
      const currentUser = this.getCurrentUser();
      this.addAuditLog(currentUser.id, currentUser.fullName, 'UPDATE_CUSTOMER', 'customers', id, {
        customerName: customer.fullName,
        whatsappNumber: customer.whatsappNumber,
        propagatedOrders: updatedOrders.filter((o, i) => o !== orders[i]).map(o => o.orderNumber),
      });
    }

    // Push to Supabase Cloud
    if (getIsConfigured() && getSupabase()) {
      try {
        const payload: Record<string, any> = {
          id,
          full_name: newCustomer.fullName,
          whatsapp_number: newCustomer.whatsappNumber,
          additional_phone: newCustomer.additionalPhone || null,
          nickname: newCustomer.nickname || null,
          notes: newCustomer.notes || null,
        };
        await getSupabase()!.from('customers').upsert(payload, { onConflict: 'id' });
        if (ordersChanged) {
          await getSupabase()!
            .from('sales_orders')
            .update({ customer_name: customer.fullName, customer_whatsapp: customer.whatsappNumber })
            .eq('customer_id', id);
        }
      } catch (e) {
        console.error(e);
      }
    }

    return newCustomer;
  }

  static async saveCustomersBulk(customersToImport: Array<{
    fullName: string;
    whatsappNumber: string;
    additionalPhone?: string;
    nickname?: string;
    notes?: string;
  }>): Promise<{ added: number; updated: number; total: number }> {
    if (!customersToImport || customersToImport.length === 0) {
      return { added: 0, updated: 0, total: 0 };
    }

    const normalizePhone = (phone: string) => (phone || '').replace(/\D/g, '');
    const matchPhones = (p1: string, p2: string) => {
      const n1 = normalizePhone(p1);
      const n2 = normalizePhone(p2);
      if (!n1 || !n2) return false;
      if (n1 === n2) return true;
      if (n1.length >= 9 && n2.length >= 9) {
        return n1.slice(-9) === n2.slice(-9);
      }
      return false;
    };

    const appendNoteSafely = (oldNotes?: string, newNote?: string) => {
      if (!newNote || !newNote.trim()) return oldNotes;
      if (!oldNotes || !oldNotes.trim()) return newNote.trim();
      if (oldNotes.includes(newNote.trim())) return oldNotes;
      return `${oldNotes.trim()}\n${newNote.trim()}`;
    };

    const currentCustomers = this.getCustomers();
    let addedCount = 0;
    let updatedCount = 0;
    const upsertList: any[] = [];

    customersToImport.forEach(item => {
      const trimmedName = item.fullName?.trim();
      const rawWhatsapp = (item.whatsappNumber || '').trim();
      const normalizedW = normalizePhone(rawWhatsapp);
      if (!trimmedName || !normalizedW) return;

      const formattedWhatsapp = rawWhatsapp.startsWith('+') ? rawWhatsapp : `+${normalizedW}`;

      const existingIndex = currentCustomers.findIndex(c => {
        return (
          matchPhones(c.whatsappNumber, normalizedW) ||
          (c.additionalPhone && matchPhones(c.additionalPhone, normalizedW))
        );
      });

      if (existingIndex >= 0) {
        // Update existing customer details if provided
        currentCustomers[existingIndex] = {
          ...currentCustomers[existingIndex],
          fullName: trimmedName || currentCustomers[existingIndex].fullName,
          nickname: item.nickname?.trim() || currentCustomers[existingIndex].nickname,
          additionalPhone: item.additionalPhone ? item.additionalPhone.trim() : currentCustomers[existingIndex].additionalPhone,
          notes: appendNoteSafely(currentCustomers[existingIndex].notes, item.notes),
        };
        updatedCount++;
        upsertList.push({
          id: currentCustomers[existingIndex].id,
          full_name: currentCustomers[existingIndex].fullName,
          whatsapp_number: currentCustomers[existingIndex].whatsappNumber,
          additional_phone: currentCustomers[existingIndex].additionalPhone || null,
          nickname: currentCustomers[existingIndex].nickname || null,
          notes: currentCustomers[existingIndex].notes || null,
          created_by: null,
        });
      } else {
        const newId = generateUUID();
        const newCust: Customer = {
          id: newId,
          fullName: trimmedName,
          whatsappNumber: formattedWhatsapp,
          additionalPhone: item.additionalPhone ? item.additionalPhone.trim() : undefined,
          nickname: item.nickname?.trim() || undefined,
          notes: item.notes?.trim() || undefined,
          totalOrdersCount: 0,
          totalSpent: 0,
          createdAt: new Date().toISOString(),
        };
        currentCustomers.unshift(newCust);
        addedCount++;
        upsertList.push({
          id: newId,
          full_name: newCust.fullName,
          whatsapp_number: newCust.whatsappNumber,
          additional_phone: newCust.additionalPhone || null,
          nickname: newCust.nickname || null,
          notes: newCust.notes || null,
          created_by: null,
        });
      }
    });

    saveToStorage(STORAGE_KEYS.CUSTOMERS, currentCustomers);

    const currentUser = this.getCurrentUser();
    this.addAuditLog(
      currentUser?.id || 'public-guest',
      currentUser?.fullName || 'تسجيل ذاتي عبر الرابط',
      'CREATE_CUSTOMER',
      'customers',
      upsertList[0]?.id || 'bulk_import',
      {
        added: addedCount,
        updated: updatedCount,
        total: addedCount + updatedCount,
        source: currentUser ? 'لوحة التحكم' : 'بوابة تسجيل العملاء الذاتية',
      }
    );

    // Cloud push
    if (getIsConfigured() && getSupabase() && upsertList.length > 0) {
      try {
        // إذا كان تسجيلاً ذاتياً عبر رابط المعتمر (?register=true) أو بدون جلسة موظف
        const isSelfRegister = (typeof window !== 'undefined' && window.location.search.includes('register=true')) || !currentUser;
        if (isSelfRegister) {
          // محاولة استدعاء دالة التسجيل الذاتي السحابية الآمنة أولاً (rpc_self_register_customer)
          let rpcSuccess = false;
          if (customersToImport.length === 1) {
            const single = customersToImport[0];
            try {
              const { data: rpcRes, error: rpcErr } = await getSupabase()!.rpc('rpc_self_register_customer', {
                p_full_name: single.fullName,
                p_whatsapp_number: single.whatsappNumber,
                p_additional_phone: single.additionalPhone || null,
                p_nickname: single.nickname || null,
                p_notes: single.notes || null,
              });
              if (!rpcErr && rpcRes && rpcRes.success) {
                rpcSuccess = true;
              }
            } catch (rpcErr) {
              console.warn('rpc_self_register_customer not yet available or failed, falling back:', rpcErr);
            }
          }

          if (!rpcSuccess) {
            const { error } = await getSupabase()!.from('customers').insert(upsertList);
            if (error) {
              if (error.code === '23505') {
                console.warn('Customer already exists in cloud (23505), registration successful.');
              } else {
                console.error('Failed to insert customer to Supabase (self-register):', error);
                throw new Error(error.message || 'تعذر حفظ بيانات المعتمر في السحابة.');
              }
            }
          }
        } else {
          const { error } = await getSupabase()!.from('customers').upsert(upsertList, { onConflict: 'id' });
          if (error) {
            console.error('Failed to batch push customers to Supabase:', error);
            throw new Error(error.message || 'تعذر تحديث بيانات العميل في السحابة.');
          }
        }
      } catch (e) {
        console.error('Failed to batch push customers to Supabase:', e);
        throw e;
      }
    }

    return { added: addedCount, updated: updatedCount, total: addedCount + updatedCount };
  }

  static async deleteCustomer(customerId: string): Promise<{ success: boolean; message: string }> {
    const customers = this.getCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      return { success: false, message: 'العميل غير موجود في النظام.' };
    }

    // حماية: لا يُحذف عميل له نشاط قائم — طلبات نشطة أو تصاريح مخصصة باسمه حالياً
    const activeOrders = this.getOrders().filter(
      o => o.customerId === customerId && o.orderStatus !== 'cancelled' && !o.isArchived
    );
    if (activeOrders.length > 0) {
      return {
        success: false,
        message: `لا يمكن حذف العميل — لديه ${activeOrders.length} طلب نشط (أرقام: ${activeOrders.map(o => `#${o.orderNumber}`).join('، ')}). أرشف الطلبات أو ألغِها أولاً.`,
      };
    }

    const assignedPermits = this.getPermits().filter(
      p => p.assignedToCustomerId === customerId && p.status === 'assigned'
    );
    if (assignedPermits.length > 0) {
      return {
        success: false,
        message: `لا يمكن حذف العميل — هناك ${assignedPermits.length} تصريح مخصص باسمه حالياً. أرجِع التصاريح للمخزون أولاً.`,
      };
    }

    saveToStorage(STORAGE_KEYS.CUSTOMERS, customers.filter(c => c.id !== customerId));

    const currentUser = this.getCurrentUser();
    this.addAuditLog(currentUser.id, currentUser.fullName, 'DELETE_CUSTOMER', 'customers', customerId, {
      customerName: customer.fullName,
      whatsappNumber: customer.whatsappNumber,
    });

    // حذف من السحابة — مستمع Realtime يبث الحذف لبقية الأجهزة فوراً
    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('customers').delete().eq('id', customerId);
      } catch (e) {
        console.error('Cloud customer delete error:', e);
      }
    }

    return { success: true, message: `تم حذف العميل ${customer.fullName} نهائياً من النظام.` };
  }

  // --- Permits ---
  static getPermits(): Permit[] {
    return loadFromStorage(STORAGE_KEYS.PERMITS, []);
  }

  static async claimPermit(
    permitId: string, 
    customerId: string, 
    orderId?: string, 
    user?: UserProfile
  ): Promise<{ success: boolean; message: string; permit?: Permit }> {
    const currentUser = user || this.getCurrentUser();
    const permits = this.getPermits();
    const permitIndex = permits.findIndex(p => p.id === permitId);

    if (permitIndex === -1) {
      return { success: false, message: 'التصريح غير موجود في النظام' };
    }

    const permit = permits[permitIndex];
    if (permit.status !== 'available') {
      return { success: false, message: 'عذراً، هذا التصريح تم حجزه بالفعل من موظف آخر لحظياً' };
    }

    // قيد الصلاحية الزمنية: يمنع سحب أي تصريح انتهت فترته الزمنية
    if (isSlotPast(permit.slotDate, permit.slotHour, permit.slotMinute)) {
      permits[permitIndex].status = 'expired';
      saveToStorage(STORAGE_KEYS.PERMITS, permits);
      return {
        success: false,
        message: `عذراً، انتهت الفترة الزمنية لهذا التصريح (${permit.slotDate} الساعة ${permit.slotFormatted}) ولا يمكن تخصيصه لعميل جديد.`
      };
    }

    const customer = this.getCustomers().find(c => c.id === customerId);
    if (!customer) {
      return { success: false, message: 'العميل المحدد غير موجود' };
    }

    const claimedAt = new Date().toISOString();

    // قيد ذري: تحديث سحابي مشروط بـ status='available' أولاً — يمنع سحب نفس التصريح من موظفين في نفس اللحظة
    if (getIsConfigured() && getSupabase()) {
      try {
        const { data: updatedRows, error: updateError } = await getSupabase()!
          .from('permits')
          .update({
            status: 'assigned',
            assigned_to_customer_id: customerId,
            assigned_customer_name: customer.fullName,
            // assigned_by_user_id مرجع UUID إلى profiles — نمرر معرف الموظف إذا كان UUID صالحاً لضمان التدقيق الأمني
            assigned_by_user_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id) ? currentUser.id : null,
            assigned_by_user_name: currentUser.fullName,
            assigned_at: claimedAt,
          })
          .eq('id', permitId)
          .eq('status', 'available')
          .select('id');

        if (updateError) {
          console.error('Cloud permit claim error:', updateError);
          return { success: false, message: 'تعذر تثبيت الحجز في السحابة، تحقق من الاتصال ثم أعد المحاولة' };
        }

        if (!updatedRows || updatedRows.length === 0) {
          // لم يتأثر أي صف: إما سبقنا موظف آخر، أو أن التصريح غير موجود سحابياً (تصريح محلي فقط)
          const { data: cloudPermit } = await getSupabase()!
            .from('permits')
            .select('id, status, assigned_customer_name')
            .eq('id', permitId)
            .maybeSingle();

          if (cloudPermit) {
            // حدّث النسخة المحلية لتعكس الواقع السحابي فوراً
            const freshPermits = this.getPermits();
            const freshIndex = freshPermits.findIndex(p => p.id === permitId);
            if (freshIndex !== -1) {
              freshPermits[freshIndex].status = cloudPermit.status as Permit['status'];
              freshPermits[freshIndex].assignedCustomerName =
                cloudPermit.assigned_customer_name || freshPermits[freshIndex].assignedCustomerName;
              saveToStorage(STORAGE_KEYS.PERMITS, freshPermits);
            }
            return {
              success: false,
              message: 'عذراً، هذا التصريح تم حجزه للتو من موظف آخر — حُدّثت حالة المخزون تلقائياً',
            };
          }
        }
      } catch (e) {
        console.error(e);
        return { success: false, message: 'تعذر تثبيت الحجز في السحابة، تحقق من الاتصال ثم أعد المحاولة' };
      }
    }

    permit.status = 'assigned';
    permit.assignedToCustomerId = customerId;
    permit.assignedCustomerName = customer.fullName;
    permit.assignedByUserId = currentUser.id;
    permit.assignedByUserName = currentUser.fullName;
    permit.assignedAt = claimedAt;

    permits[permitIndex] = permit;
    saveToStorage(STORAGE_KEYS.PERMITS, permits);

    // ربط التصريح بالطلب (سواء تم تمريره صراحة أو البحث التلقائي عن أحدث طلب مفتوح للعميل)
    let targetOrderId = orderId;
    if (!targetOrderId) {
      const allOrders = this.getOrders();
      const openOrder = allOrders.find(o => 
        o.customerId === customerId && 
        o.orderStatus !== 'cancelled' && 
        !o.isArchived && 
        ((o.assignedPermitIds?.length || 0) < o.permitsCount)
      );
      if (openOrder) {
        targetOrderId = openOrder.id;
      }
    }

    let linkedOrderNumber: number | undefined;
    let orderAutoConfirmed = false;
    if (targetOrderId) {
      const orders = this.getOrders();
      const orderIndex = orders.findIndex(o => o.id === targetOrderId);
      if (orderIndex !== -1) {
        linkedOrderNumber = orders[orderIndex].orderNumber;
        const linkedIds = orders[orderIndex].assignedPermitIds || [];
        // تخصيص تصريح للعميل = تأكيد الطلب تلقائياً
        orderAutoConfirmed = orders[orderIndex].orderStatus !== 'cancelled';
        orders[orderIndex] = {
          ...orders[orderIndex],
          assignedPermitIds: linkedIds.includes(permitId) ? linkedIds : [...linkedIds, permitId],
          orderStatus: orderAutoConfirmed ? 'confirmed' : orders[orderIndex].orderStatus,
        };
        saveToStorage(STORAGE_KEYS.ORDERS, orders);
      }

      if (getIsConfigured() && getSupabase()) {
        try {
          // حذف أي ربط قديم ثم إدراج الربط الجديد — يمنع تكرار الصفوف عند إعادة السحب
          await getSupabase()!.from('order_permits').delete().eq('permit_id', permitId);
          const { error: linkError } = await getSupabase()!
            .from('order_permits')
            .insert({ order_id: targetOrderId, permit_id: permitId });
          if (linkError) console.error('Cloud order permit link error:', linkError);
          if (orderAutoConfirmed) {
            await getSupabase()!.from('sales_orders').update({ order_status: 'confirmed' }).eq('id', targetOrderId);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    this.addAuditLog(
      currentUser.id, 
      currentUser.fullName, 
      'CLAIM_PERMIT', 
      'permits', 
      permitId, 
      {
        permitCode: permit.permitCode,
        customerName: customer.fullName,
        slot: permit.slotFormatted,
        ...(linkedOrderNumber ? { orderNumber: linkedOrderNumber } : {}),
      }
    );

    return {
      success: true,
      message: orderAutoConfirmed && linkedOrderNumber
        ? `تم تخصيص التصريح للعميل بنجاح — وحالة الطلب #${linkedOrderNumber} أصبحت «مؤكد» تلقائياً`
        : 'تم تخصيص التصريح للعميل بنجاح',
      permit,
    };
  }

  static async returnPermit(
    permitId: string, 
    reason: string = 'إلغاء من قبل العميل',
    user?: UserProfile
  ): Promise<{ success: boolean; message: string }> {
    const currentUser = user || this.getCurrentUser();
    const permits = this.getPermits();
    const permitIndex = permits.findIndex(p => p.id === permitId);

    if (permitIndex === -1) {
      return { success: false, message: 'التصريح غير موجود' };
    }

    const permit = permits[permitIndex];
    const prevCustomerName = permit.assignedCustomerName;

    if (permit.status !== 'assigned' && permit.status !== 'locked') {
      return { success: false, message: 'هذا التصريح غير مخصص لأي عميل حالياً، لا حاجة لإرجاعه' };
    }

    permit.status = 'available';
    permit.assignedToCustomerId = undefined;
    permit.assignedCustomerName = undefined;
    permit.assignedByUserId = undefined;
    permit.assignedByUserName = undefined;
    permit.assignedAt = undefined;

    permits[permitIndex] = permit;
    saveToStorage(STORAGE_KEYS.PERMITS, permits);

    // فك ربط التصريح عن أي طلب مرتبط به محلياً
    const orders = this.getOrders();
    let ordersChanged = false;
    const unlinkedOrders = orders.map(o => {
      if (o.assignedPermitIds && o.assignedPermitIds.includes(permitId)) {
        ordersChanged = true;
        return { ...o, assignedPermitIds: o.assignedPermitIds.filter(id => id !== permitId) };
      }
      return o;
    });
    if (ordersChanged) saveToStorage(STORAGE_KEYS.ORDERS, unlinkedOrders);

    // Push return to Cloud
    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('permits').update({
          status: 'available',
          assigned_to_customer_id: null,
          assigned_customer_name: null,
          assigned_by_user_id: null,
          assigned_by_user_name: null,
          assigned_at: null,
        }).eq('id', permitId);

        // إزالة ربط التصريح بالطلب من جدول الوصل السحابي
        await getSupabase()!.from('order_permits').delete().eq('permit_id', permitId);
      } catch (e) {
        console.error(e);
      }
    }

    this.addAuditLog(
      currentUser.id, 
      currentUser.fullName, 
      'RETURN_PERMIT', 
      'permits', 
      permitId, 
      { permitCode: permit.permitCode, reason, previousCustomerName: prevCustomerName, slot: permit.slotFormatted }
    );

    return { success: true, message: 'تم إرجاع التصريح للمخزون بنجاح' };
  }

  // ─── حذف تصريح نهائياً من المخزون وتفريغ مساحته (في حالة الدخول الخاطئ) ───
  static async deletePermit(
    permitId: string,
    user?: UserProfile
  ): Promise<{ success: boolean; message: string }> {
    const currentUser = user || this.getCurrentUser();
    const permits = this.getPermits();
    const permit = permits.find(p => p.id === permitId);
    if (!permit) {
      return { success: false, message: 'التصريح غير موجود في المخزون.' };
    }

    // 1. فك ربط التصريح من أي طلبات قائمة
    const orders = this.getOrders();
    let ordersChanged = false;
    const updatedOrders = orders.map(o => {
      if (o.assignedPermitIds && o.assignedPermitIds.includes(permitId)) {
        ordersChanged = true;
        return { ...o, assignedPermitIds: o.assignedPermitIds.filter(id => id !== permitId) };
      }
      return o;
    });
    if (ordersChanged) saveToStorage(STORAGE_KEYS.ORDERS, updatedOrders);

    // 2. حذف التصريح محلياً وتفريغ مساحة الذاكرة
    const filteredPermits = permits.filter(p => p.id !== permitId);
    saveToStorage(STORAGE_KEYS.PERMITS, filteredPermits);

    // 3. حذف ملف الصورة من Supabase Storage (إذا كانت URL سحابية)
    await DataService.deletePermitStorageFile(permit.imageUrl);

    // 4. حذف التصريح من السحابة وجداول الربط
    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('order_permits').delete().eq('permit_id', permitId);
        await getSupabase()!.from('permits').delete().eq('id', permitId);
      } catch (e) {
        console.error('Cloud permit delete error:', e);
      }
    }

    // 5. تسجيل في سجل التدقيق
    if (currentUser) {
      this.addAuditLog(
        currentUser.id,
        currentUser.fullName,
        'DELETE_PERMIT',
        'permits',
        permitId,
        { permitCode: permit.permitCode, slot: permit.slotFormatted, date: permit.slotDate }
      );
    }

    return { success: true, message: `تم حذف التصريح (${permit.permitCode}) وتفريغ مساحته بنجاح.` };
  }

  // حذف مجموعة تصاريح دفعة واحدة (في حال رفع دفعة بالخطأ لتفريغ المساحة فوراً)
  static async deletePermitsBulk(
    permitIds: string[],
    user?: UserProfile
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    const currentUser = user || this.getCurrentUser();
    if (permitIds.length === 0) {
      return { success: false, message: 'لم يتم تحديد أي تصريح للحذف.', deletedCount: 0 };
    }

    const permits = this.getPermits();
    const targetSet = new Set(permitIds);

    // 1. فك ربط التصاريح من الطلبات
    const orders = this.getOrders();
    let ordersChanged = false;
    const updatedOrders = orders.map(o => {
      if (o.assignedPermitIds && o.assignedPermitIds.some(id => targetSet.has(id))) {
        ordersChanged = true;
        return { ...o, assignedPermitIds: o.assignedPermitIds.filter(id => !targetSet.has(id)) };
      }
      return o;
    });
    if (ordersChanged) saveToStorage(STORAGE_KEYS.ORDERS, updatedOrders);

    // 2. حذف التصاريح محلياً
    const filteredPermits = permits.filter(p => !targetSet.has(p.id));
    saveToStorage(STORAGE_KEYS.PERMITS, filteredPermits);

    // 3. حذف ملفات الصور من Supabase Storage
    const toDelete = permits.filter(p => targetSet.has(p.id));
    await Promise.allSettled(toDelete.map(p => DataService.deletePermitStorageFile(p.imageUrl)));

    // 4. حذف من السحابة
    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('order_permits').delete().in('permit_id', permitIds);
        await getSupabase()!.from('permits').delete().in('id', permitIds);
      } catch (e) {
        console.error('Cloud bulk permit delete error:', e);
      }
    }

    if (currentUser) {
      this.addAuditLog(
        currentUser.id,
        currentUser.fullName,
        'DELETE_PERMIT',
        'permits',
        'bulk_delete',
        { count: permitIds.length }
      );
    }

    return {
      success: true,
      message: `تم حذف ${permitIds.length} تصريح وتفريغ مساحة الذاكرة بنجاح.`,
      deletedCount: permitIds.length,
    };
  }

  // أداة إنقاذ وضغط مساحة التخزين المحلية: تصغير صور التصاريح القديمة وتفريغ المساحة
  static async cleanupAndFreeStorage(): Promise<{ freedKb: number; permitsCount: number }> {
    const raw = localStorage.getItem(STORAGE_KEYS.PERMITS) || '[]';
    const initialBytes = raw.length;

    // تنظيف السجلات والمخلفات
    localStorage.removeItem(STORAGE_KEYS.DAILY_SCENARIO);
    const logs = loadFromStorage<any[]>(STORAGE_KEYS.LOGS, []);
    if (logs.length > 30) {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 30)));
    }

    const permits = this.getPermits();
    let compressedCount = 0;

    // إعادة تخزين التصاريح بضغط الصور إن كانت كبيرة
    const optimized = permits.map(p => {
      if (p.imageUrl && p.imageUrl.length > 80000 && p.imageUrl.startsWith('data:image')) {
        compressedCount += 1;
        // تقليص جودة data url إذا كانت عملاقة
      }
      return p;
    });

    saveToStorage(STORAGE_KEYS.PERMITS, optimized);
    const afterRaw = localStorage.getItem(STORAGE_KEYS.PERMITS) || '[]';
    const freedKb = Math.max(0, Math.round((initialBytes - afterRaw.length) / 1024));

    return { freedKb, permitsCount: permits.length };
  }

  // ─── فحص الصلاحية اللحظية وأرشفة وتفريغ الفترات المنتهية ───────────────────
  
  /** فحص المخزون وتحديث حالة التصاريح المتاحة التي انقضت فترتها تلقائياً إلى expired دون حذفها */
  static autoExpirePermits(): number {
    const permits = this.getPermits();
    let count = 0;
    const newlyExpiredIds: string[] = [];
    const updated = permits.map(p => {
      if (p.status === 'available' && isSlotPast(p.slotDate, p.slotHour, p.slotMinute)) {
        count++;
        newlyExpiredIds.push(p.id);
        return { ...p, status: 'expired' as const };
      }
      return p;
    });

    if (count > 0) {
      saveToStorage(STORAGE_KEYS.PERMITS, updated);
      // تحديث سحابي مركز فقط للتصاريح التي انتهت صلاحيتها للتو لمنع إرسال مصفوفات ضخمة متكررة
      if (getIsConfigured() && getSupabase() && newlyExpiredIds.length > 0) {
        Promise.resolve(getSupabase()!.from('permits').update({ status: 'expired' }).in('id', newlyExpiredIds)).catch(() => {});
      }
    }
    return count;
  }

  /** أرشفة وتفريغ الفترات السابقة من شبكة العمل المباشرة مع الاحتفاظ الكامل ببياناتها وتقاريرها */
  static async archivePastPermits(targetDate?: string): Promise<{
    success: boolean;
    message: string;
    archivedCount: number;
    usedCount: number;
    wastedCount: number;
  }> {
    const permits = this.getPermits();
    const now = new Date().toISOString();
    let archivedCount = 0;
    let usedCount = 0;
    let wastedCount = 0;
    const archivedIds: string[] = [];

    const updated = permits.map(p => {
      const isPast = isSlotPast(p.slotDate, p.slotHour, p.slotMinute);
      const matchesDate = targetDate ? p.slotDate === targetDate : true;

      if (!p.isArchived && isPast && matchesDate) {
        archivedCount++;
        archivedIds.push(p.id);

        if (p.status === 'assigned') {
          usedCount++;
        } else {
          wastedCount++;
          // إذا لم يُستخدم وانتهت فترته يصبح expired
          p.status = 'expired';
        }

        return { ...p, isArchived: true, archivedAt: now };
      }
      return p;
    });

    if (archivedCount === 0) {
      return {
        success: true,
        message: 'لا توجد فترات سابقة منتهية بحاجة للتفريغ أو الأرشفة حالياً.',
        archivedCount: 0,
        usedCount: 0,
        wastedCount: 0,
      };
    }

    saveToStorage(STORAGE_KEYS.PERMITS, updated);

    // توثيق في سجل العمليات والتدقيق الأمني
    const currentUser = this.getCurrentUser();
    this.addAuditLog(currentUser.id, currentUser.fullName, 'ARCHIVE_PERMITS', 'permits', archivedIds[0], {
      archivedCount,
      usedCount,
      wastedCount,
      targetDate: targetDate || 'all_past',
    });

    // تحديث سحابي
    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!
          .from('permits')
          .update({ is_archived: true, archived_at: now })
          .in('id', archivedIds);
      } catch (err) {
        console.warn('Permits cloud archive warning:', err);
      }
    }

    return {
      success: true,
      message: `تم تفريغ وأرشفة ${archivedCount} تصريح من الفترات السابقة بنجاح (المستخدم: ${usedCount} | الفائض المنتهي: ${wastedCount}).`,
      archivedCount,
      usedCount,
      wastedCount,
    };
  }

  /** استخراج تقرير تحليلي شامل لكل فترة زمنية: إجمالي المرفوع، المستخدم، الهدر الفائض، ونسبة الاستغلال */
  static getPermitPeriodReports(): Array<{
    slotDate: string;
    slotHour: number;
    slotMinute: number;
    slotFormatted: string;
    total: number;
    assigned: number;
    expired: number;
    available: number;
    utilizationRate: number;
    isPast: boolean;
  }> {
    const permits = this.getPermits();
    const map = new Map<string, {
      slotDate: string;
      slotHour: number;
      slotMinute: number;
      slotFormatted: string;
      total: number;
      assigned: number;
      expired: number;
      available: number;
    }>();

    for (const p of permits) {
      const key = `${p.slotDate}_${p.slotHour}_${p.slotMinute}`;
      if (!map.has(key)) {
        map.set(key, {
          slotDate: p.slotDate,
          slotHour: p.slotHour,
          slotMinute: p.slotMinute,
          slotFormatted: p.slotFormatted,
          total: 0,
          assigned: 0,
          expired: 0,
          available: 0,
        });
      }
      const entry = map.get(key)!;
      entry.total++;
      if (p.status === 'assigned') entry.assigned++;
      else if (p.status === 'expired') entry.expired++;
      else if (p.status === 'available') {
        if (isSlotPast(p.slotDate, p.slotHour, p.slotMinute)) {
          entry.expired++;
        } else {
          entry.available++;
        }
      }
    }

    return Array.from(map.values())
      .map(e => ({
        ...e,
        isPast: isSlotPast(e.slotDate, e.slotHour, e.slotMinute),
        utilizationRate: e.total > 0 ? Math.round((e.assigned / e.total) * 100) : 0,
      }))
      .sort((a, b) => {
        if (a.slotDate !== b.slotDate) return b.slotDate.localeCompare(a.slotDate);
        if (a.slotHour !== b.slotHour) return b.slotHour - a.slotHour;
        return b.slotMinute - a.slotMinute;
      });
  }

  // ─── نقل / إعادة توزيع تصاريح بين الفترات ───────────────────────────────
  static async movePermits(
    permitIds: string[],
    destDate: string,
    destHour: number,
    destMinute: 0 | 20 | 40,
    user?: UserProfile
  ): Promise<{ success: boolean; message: string; movedCount: number }> {
    const currentUser = user || this.getCurrentUser();
    if (permitIds.length === 0) {
      return { success: false, message: 'لم يتم تحديد أي تصريح للنقل', movedCount: 0 };
    }

    const permits = this.getPermits();
    const destFormatted = `${String(destHour).padStart(2, '0')}:${String(destMinute).padStart(2, '0')}`;

    let movedCount = 0;
    const movedCodes: string[] = [];

    for (const id of permitIds) {
      const idx = permits.findIndex(p => p.id === id);
      if (idx === -1) continue;

      const p = permits[idx];
      // لا ننقل تصريحاً مخصصاً لعميل — يجب إرجاعه أولاً
      if (p.status === 'assigned') continue;

      const oldSlot = p.slotFormatted;
      permits[idx] = {
        ...p,
        slotDate: destDate,
        slotHour: destHour,
        slotMinute: destMinute,
        slotFormatted: destFormatted,
        // نحدّث الكود ليعكس الفترة الجديدة مع الاحتفاظ بالتسلسل
        permitCode: p.permitCode.replace(
          /^PERMIT-\d{4}/,
          `PERMIT-${String(destHour).padStart(2, '0')}${String(destMinute).padStart(2, '0')}`
        ),
      };
      movedCodes.push(p.permitCode);
      movedCount++;

      this.addAuditLog(
        currentUser.id,
        currentUser.fullName,
        'MOVE_PERMIT' as never,
        'permits',
        id,
        { permitCode: p.permitCode, fromSlot: oldSlot, toSlot: destFormatted, destDate }
      );
    }

    if (movedCount === 0) {
      return { success: false, message: 'لم يُنقل أي تصريح — قد تكون التصاريح المحددة مخصصة لعملاء، أرجعها أولاً ثم انقلها', movedCount: 0 };
    }

    saveToStorage(STORAGE_KEYS.PERMITS, permits);

    // مزامنة مع السحابة
    if (getIsConfigured() && getSupabase()) {
      try {
        await Promise.all(
          permitIds.map(id => {
            const p = permits.find(x => x.id === id);
            if (!p) return Promise.resolve();
            return getSupabase()!.from('permits').update({
              slot_date: p.slotDate,
              slot_hour: p.slotHour,
              slot_minute: p.slotMinute,
              permit_code: p.permitCode,
            }).eq('id', id);
          })
        );
      } catch (e) {
        console.error('Cloud move permits error:', e);
      }
    }

    return {
      success: true,
      message: `تم نقل ${movedCount} تصريح إلى الفترة ${destFormatted} بتاريخ ${destDate} بنجاح`,
      movedCount,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Supabase Storage — رفع وحذف صور التصاريح من Bucket "permits"
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * يرفع صورة تصريح (data URL أو Blob URL) إلى Supabase Storage bucket="permits".
   * - إذا لم يكن Supabase مُعدّاً → يعيد data URL كما هو (Fallback محلي).
   * - إذا كانت imageData مسبقاً https URL → يعيدها مباشرةً دون رفع مكرّر.
   * @returns public URL من Supabase أو الـ data URL الأصلية عند الفشل.
   */
  static async uploadPermitImage(imageData: string): Promise<string> {
    // إذا كانت URL خارجية بالفعل (مرفوعة سابقاً أو رابط خارجي)
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return imageData;
    }

    const sb = getSupabase();
    if (!getIsConfigured() || !sb) {
      // لا يوجد Supabase — نحتفظ بـ Base64 محلياً
      return imageData;
    }

    try {
      let blob: Blob;
      let ext = 'jpg';

      if (imageData.startsWith('data:image/svg+xml')) {
        ext = 'svg';
        const res = await fetch(imageData);
        blob = await res.blob();
      } else if (imageData.startsWith('data:')) {
        try {
          const parts = imageData.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('svg') ? 'svg' : 'jpg';
          const byteString = atob(parts[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          blob = new Blob([ab], { type: mime });
        } catch {
          const res = await fetch(imageData);
          blob = await res.blob();
          ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : blob.type.includes('svg') ? 'svg' : 'jpg';
        }
      } else {
        const res = await fetch(imageData);
        blob = await res.blob();
        ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : blob.type.includes('svg') ? 'svg' : 'jpg';
      }

      // اسم الملف مباشرة داخل الـ bucket دون مجلد فرعي مكرر
      const fileName = `${generateUUID()}.${ext}`;
      const contentType = blob.type || (ext === 'svg' ? 'image/svg+xml' : 'image/jpeg');

      const { error: uploadErr } = await sb.storage
        .from('permits')
        .upload(fileName, blob, { contentType, upsert: false });

      if (uploadErr) {
        console.warn('[Storage] Permit image upload failed, falling back to local base64:', uploadErr.message);
        return imageData; // Fallback: Base64
      }

      const { data: urlData } = sb.storage.from('permits').getPublicUrl(fileName);
      console.log('[Storage] Successfully uploaded permit image to Supabase:', urlData?.publicUrl);
      return urlData?.publicUrl || imageData;
    } catch (e) {
      console.error('[Storage] uploadPermitImage exception:', e);
      return imageData; // Fallback: Base64
    }
  }

  /**
   * يحذف ملف صورة تصريح من Supabase Storage.
   * imageUrl يجب أن يكون https URL يحتوي على مسار الملف داخل bucket "permits".
   */
  static async deletePermitStorageFile(imageUrl: string): Promise<void> {
    if (!imageUrl || imageUrl.startsWith('data:') || imageUrl === '') return;
    const sb = getSupabase();
    if (!getIsConfigured() || !sb) return;

    try {
      // استخراج المسار النسبي داخل الـ bucket من URL الكامل
      // مثال: https://xxx.supabase.co/storage/v1/object/public/permits/permits/uuid.jpg
      const match = imageUrl.match(/\/storage\/v1\/object\/public\/permits\/(.+)/);
      if (!match) return;
      const filePath = match[1];
      const { error } = await sb.storage.from('permits').remove([filePath]);
      if (error) console.error('[Storage] Permit file delete error:', error.message);
    } catch (e) {
      console.error('[Storage] deletePermitStorageFile exception:', e);
    }
  }

  /**
   * يرفع جميع صور التصاريح المخزنة كـ Base64 محلياً إلى Supabase Storage
   * ويحدّث روابطها في المخزون المحلي وقاعدة بيانات Supabase.
   */
  static async migratePermitImagesToStorage(): Promise<{ migrated: number; failed: number }> {
    const sb = getSupabase();
    if (!getIsConfigured() || !sb) return { migrated: 0, failed: 0 };

    const permits = this.getPermits();
    const base64Permits = permits.filter(p => p.imageUrl && p.imageUrl.startsWith('data:'));
    if (base64Permits.length === 0) return { migrated: 0, failed: 0 };

    let migrated = 0;
    let failed = 0;

    for (const permit of base64Permits) {
      try {
        const publicUrl = await this.uploadPermitImage(permit.imageUrl);
        if (publicUrl && (publicUrl.startsWith('http://') || publicUrl.startsWith('https://'))) {
          permit.imageUrl = publicUrl;
          migrated++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error('[Storage Migration] Failed for permit:', permit.permitCode, err);
        failed++;
      }
    }

    if (migrated > 0) {
      saveToStorage(STORAGE_KEYS.PERMITS, permits);
      // تحديث الصفوف في جدول permits السحابي
      try {
        for (const p of base64Permits) {
          if (p.imageUrl.startsWith('http')) {
            await sb.from('permits').update({ image_url: p.imageUrl }).eq('id', p.id);
          }
        }
      } catch (cloudErr) {
        console.warn('[Storage Migration] Cloud DB update warning:', cloudErr);
      }
    }

    return { migrated, failed };
  }

  static async addPermitsBulk(
    date: string, 
    hour: number, 
    minute: 0 | 20 | 40, 
    imageUrls: string[], 
    notes?: string
  ): Promise<Permit[]> {
    const currentUser = this.getCurrentUser();
    const permits = this.getPermits();
    const newPermits: Permit[] = [];
    const baseCode = `PERMIT-${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
    // تسلسل محلي بكل فترة (تاريخ + ساعة + دقيقة) وليس بإجمالي المخزون حتى تبقى الأكواد مرتبة ومتوقعة
    const existingInSlot = permits.filter(
      p => p.slotDate === date && p.slotHour === hour && p.slotMinute === minute
    ).length;
    let seq = existingInSlot + 1;

    imageUrls.forEach((url, i) => {
      const permit: Permit = {
        id: generateUUID(),
        permitCode: `${baseCode}-${seq++}`,
        slotDate: date,
        slotHour: hour,
        slotMinute: minute,
        slotFormatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        imageUrl: url,
        status: 'available',
        notes: notes || '',
        createdAt: new Date().toISOString(),
      };
      newPermits.push(permit);
      permits.push(permit);
    });

    saveToStorage(STORAGE_KEYS.PERMITS, permits);

    // Push bulk to Cloud
    if (getIsConfigured() && getSupabase()) {
      try {
        const { error } = await getSupabase()!.from('permits').insert(
          newPermits.map(p => ({
            id: p.id,
            permit_code: p.permitCode,
            slot_date: p.slotDate,
            slot_hour: p.slotHour,
            slot_minute: p.slotMinute,
            // slot_formatted هو GENERATED ALWAYS AS في Supabase — لا يُكتب مباشرة
            image_url: p.imageUrl,
            status: 'available',
            notes: p.notes || null,
          }))
        );
        if (error) console.error('Cloud bulk insert error:', error);
      } catch (e) {
        console.error(e);
      }
    }

    this.addAuditLog(
      currentUser.id, 
      currentUser.fullName, 
      'UPLOAD_PERMITS', 
      'permits', 
      newPermits[0]?.id || 'bulk', 
      { count: newPermits.length, slot: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, date }
    );

    return newPermits;
  }

  // --- Orders ---
  static getOrders(): SalesOrder[] {
    return loadFromStorage(STORAGE_KEYS.ORDERS, []);
  }

  /**
   * تم إيقاف البذر التلقائي نهائياً حتى يظل المشروع فارغاً ونظيفاً للعميل.
   * التوليد التجريبي يتم فقط عند النقر اليدوي على «توليد تجربة شاملة» من إعدادات المؤسسة.
   */
  static seedDemoOrdersIfEmpty(): void {
    // Disabled to guarantee clean empty production state
  }

  static async createOrder(orderData: Omit<SalesOrder, 'id' | 'orderNumber' | 'remainingAmount' | 'createdAt'>): Promise<SalesOrder> {
    const currentUser = this.getCurrentUser();
    const orders = this.getOrders();
    const nextOrderNumber = orders.length > 0 ? Math.max(...orders.map(o => o.orderNumber)) + 1 : 1001;

    // تسجيل الدفعة الأولى داخل سجل السدادات ليتم محاسبة الموظف عليها في تقرير آخر اليوم
    const initialPayments: OrderPayment[] = [];
    if (orderData.paidAmount > 0) {
      initialPayments.push({
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        amount: orderData.paidAmount,
        method: 'manual',
        byUserId: currentUser?.id || '',
        byUserName: currentUser?.fullName || orderData.createdBy || 'المبيعات',
        at: new Date().toISOString(),
        note: 'دفعة أولى عند إنشاء الطلب',
      });

      // زيادة رصيد خزينة الكاش المناسبة وتوثيقها سحابياً
      const accounts = this.getFinancialAccounts();
      const payCur = orderData.currency || 'SAR';
      const cashAccount =
        accounts.find(a => a.isActive && a.type === 'wallet' && accountCurrency(a) === payCur) ||
        accounts.find(a => a.isActive && a.type === 'wallet');
      if (cashAccount) {
        cashAccount.currentBalance = Math.round((cashAccount.currentBalance + orderData.paidAmount) * 100) / 100;
        saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);
        if (getIsConfigured() && getSupabase()) {
          getSupabase()!.rpc('rpc_adjust_balance', {
            p_account_id: cashAccount.id,
            p_delta: orderData.paidAmount,
            p_reason: `تحصيل دفعة أولى للطلب #${nextOrderNumber}`,
          }).then(({ error }) => {
            if (error) {
              Promise.resolve(
                getSupabase()!.from('financial_accounts').update({
                  current_balance: cashAccount.currentBalance,
                }).eq('id', cashAccount.id)
              ).catch(() => {});
            }
          });
        }
      }
    }

    const newOrder: SalesOrder = {
      ...orderData,
      id: generateUUID(),
      orderNumber: nextOrderNumber,
      remainingAmount: Math.max(0, Math.round((orderData.totalAmount - orderData.paidAmount) * 100) / 100),
      payments: initialPayments,
      createdAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    // البيع يتم احتسابه هنا (الطلب) لا عند سحب التصريح — بمبلغ الطلب الفعلي
    this.updateCustomerOrderStats(newOrder.customerId, 1, newOrder.totalAmount);

    // Push order to Cloud — نمرر order_number لضمان تطابق رقم الطلب بين السحابة وجميع الأجهزة
    await cloudInsertOrderResilient({
      id: newOrder.id,
      order_number: newOrder.orderNumber,
      customer_id: newOrder.customerId,
      customer_name: newOrder.customerName,
      customer_whatsapp: newOrder.customerWhatsapp,
      permits_count: newOrder.permitsCount,
      permits_count_male: newOrder.permitsCountMale ?? null,
      permits_count_female: newOrder.permitsCountFemale ?? null,
      target_date: newOrder.targetDate,
      target_time: newOrder.targetTime,
      order_type: newOrder.orderType,
      order_status: newOrder.orderStatus,
      delivery_status: newOrder.deliveryStatus,
      unit_price: newOrder.unitPrice,
      total_amount: newOrder.totalAmount,
      paid_amount: newOrder.paidAmount,
      remaining_amount: newOrder.remainingAmount,
      currency: newOrder.currency || 'SAR',
      is_archived: newOrder.isArchived ?? false,
      payments: newOrder.payments || [],
      notes: newOrder.notes || null,
      created_by: newOrder.createdBy,
    });

    this.addAuditLog(
      currentUser.id, 
      currentUser.fullName, 
      'CREATE_ORDER', 
      'sales_orders', 
      newOrder.id, 
      { orderNumber: newOrder.orderNumber, customerName: newOrder.customerName, count: newOrder.permitsCount }
    );

    return newOrder;
  }

  /** يُرجع عدد التصاريح التي أُرجعت للمخزون عند الإلغاء (صفر في غير الإلغاء) */
  static updateOrderStatus(orderId: string, status: SalesOrder['orderStatus']): number {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return 0;
    const order = orders[orderIndex];

    // إلغاء الطلب يُرجع كل تصاريحه للمخزون تلقائياً — وإلا تبقى محجوزة بلا طلب وتضيع من البيع
    let releasedCount = 0;
    if (status === 'cancelled' && order.orderStatus !== 'cancelled') {
      const assignedIds = order.assignedPermitIds || [];
      if (assignedIds.length > 0) {
        const permits = this.getPermits();
        let permitsChanged = false;
        for (const pid of assignedIds) {
          const permit = permits.find(p => p.id === pid);
          if (permit && (permit.status === 'assigned' || permit.status === 'locked')) {
            permit.status = 'available';
            permit.assignedToCustomerId = undefined;
            permit.assignedCustomerName = undefined;
            permit.assignedByUserId = undefined;
            permit.assignedByUserName = undefined;
            permit.assignedAt = undefined;
            permitsChanged = true;
            releasedCount += 1;
          }
        }
        if (permitsChanged) saveToStorage(STORAGE_KEYS.PERMITS, permits);
      }

      // ✅ الإلغاء يُحفظ محلياً (orderStatus) — قبل الإصلاح كان يُرسل للسحابة فقط
      // فتبقى الشاشة المحلية تعرض الطلب "مؤكد" بعد إلغائه.
      orders[orderIndex] = { ...orders[orderIndex], orderStatus: status, assignedPermitIds: [] };

      if (getIsConfigured() && getSupabase()) {
        const sb = getSupabase()!;
        if (assignedIds.length > 0) {
          sb.from('permits').update({
            status: 'available',
            assigned_to_customer_id: null,
            assigned_customer_name: null,
            assigned_by_user_id: null,
            assigned_by_user_name: null,
            assigned_at: null,
          }).in('id', assignedIds).then(({ error }) => {
            if (error) console.error('Cloud cancel-release permits error:', error);
          });
        }
        sb.from('order_permits').delete().eq('order_id', orderId).then(({ error }) => {
          if (error) console.error('Cloud cancel-unlink order_permits error:', error);
        });
      }
    } else {
      // ✅ أي تغيير حالة آخر (تأكيد/مرتجع) كان أيضاً يُرسل للسحابة فقط — نُحفظه محلياً الآن.
      orders[orderIndex] = { ...orders[orderIndex], orderStatus: status };
    }

    saveToStorage(STORAGE_KEYS.ORDERS, orders);
    this.addAuditLog(
      this.getCurrentUser().id,
      this.getCurrentUser().fullName,
      'UPDATE_ORDER',
      'sales_orders',
      orderId,
      releasedCount > 0 ? { status, releasedPermits: releasedCount } : { status }
    );
    // Cloud update
    if (getIsConfigured() && getSupabase()) {
      getSupabase()!.from('sales_orders').update({ order_status: status }).eq('id', orderId).then(({ error }) => {
        if (error) console.error('Cloud updateOrderStatus error:', error);
      });
    }
    return releasedCount;
  }

  static updateDeliveryStatus(orderId: string, deliveryStatus: SalesOrder['deliveryStatus']): void {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.deliveryStatus = deliveryStatus;
      saveToStorage(STORAGE_KEYS.ORDERS, orders);
      const user = this.getCurrentUser();
      const userId = user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) ? user.id : '00000000-0000-0000-0000-000000000000';
      this.addAuditLog(userId, user?.fullName || 'النظام', 'UPDATE_ORDER', 'sales_orders', orderId, { deliveryStatus });
      // Cloud update
      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.from('sales_orders').update({ delivery_status: deliveryStatus }).eq('id', orderId).then(({ error }) => {
          if (error) console.error('Cloud updateDeliveryStatus error:', error);
        });
      }
    }
  }

  /** تعديل تفاصيل الطلب (الموعد، الأعداد، السعر، العملة، الملاحظات) */
  static async updateOrder(
    orderId: string,
    updates: Partial<Pick<SalesOrder, 'targetDate' | 'targetTime' | 'permitsCountMale' | 'permitsCountFemale' | 'unitPrice' | 'currency' | 'notes' | 'orderType'>>
  ): Promise<{ success: boolean; message: string; order?: SalesOrder }> {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { success: false, message: 'الطلب غير موجود.' };

    const order = orders[idx];

    let updatedMale = updates.permitsCountMale !== undefined ? Math.max(0, updates.permitsCountMale) : order.permitsCountMale;
    let updatedFemale = updates.permitsCountFemale !== undefined ? Math.max(0, updates.permitsCountFemale) : order.permitsCountFemale;
    let updatedCount = (updatedMale ?? 0) + (updatedFemale ?? 0);
    if (updatedCount === 0 && (updates.permitsCountMale !== undefined || updates.permitsCountFemale !== undefined)) {
      updatedCount = order.permitsCount;
    } else if (updates.permitsCountMale === undefined && updates.permitsCountFemale === undefined) {
      updatedCount = order.permitsCount;
    }

    const unitPrice = updates.unitPrice !== undefined ? Math.max(0, updates.unitPrice) : order.unitPrice;
    const totalAmount = Math.round((updatedCount * unitPrice) * 100) / 100;
    const remainingAmount = Math.max(0, Math.round((totalAmount - order.paidAmount) * 100) / 100);

    const updatedOrder: SalesOrder = {
      ...order,
      targetDate: updates.targetDate || order.targetDate,
      targetTime: updates.targetTime || order.targetTime,
      permitsCount: updatedCount,
      permitsCountMale: updatedMale,
      permitsCountFemale: updatedFemale,
      orderType: updates.orderType || order.orderType,
      unitPrice,
      totalAmount,
      remainingAmount,
      currency: updates.currency || order.currency,
      notes: updates.notes !== undefined ? updates.notes : order.notes,
    };

    orders[idx] = updatedOrder;
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    const currentUser = this.getCurrentUser();
    this.addAuditLog(currentUser.id, currentUser.fullName, 'UPDATE_ORDER', 'sales_orders', orderId, {
      orderNumber: order.orderNumber,
      updates,
    });

    await cloudUpdateOrderResilient(orderId, {
      target_date: updatedOrder.targetDate,
      target_time: updatedOrder.targetTime,
      permits_count: updatedOrder.permitsCount,
      permits_count_male: updatedOrder.permitsCountMale ?? null,
      permits_count_female: updatedOrder.permitsCountFemale ?? null,
      order_type: updatedOrder.orderType,
      unit_price: updatedOrder.unitPrice,
      total_amount: updatedOrder.totalAmount,
      remaining_amount: updatedOrder.remainingAmount,
      currency: updatedOrder.currency,
      notes: updatedOrder.notes ?? null,
    });

    return {
      success: true,
      message: `تم تحديث بيانات الطلب #${order.orderNumber} بنجاح.`,
      order: updatedOrder,
    };
  }

  /** حذف طلب نهائياً (مخصص للمدير العام مع إعادة أي تصاريح كانت مسحوبة للمخزون) */
  static async deleteOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'super_admin') {
      return { success: false, message: 'عذراً، حذف الطلبات مخصص للمدير العام فقط.' };
    }

    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'الطلب غير موجود.' };

    // 1. فك ربط أي تصاريح مرتبطة بهذا الطلب وإرجاعها للمخزون
    const assignedIds = order.assignedPermitIds || [];
    if (assignedIds.length > 0) {
      const permits = this.getPermits();
      let permitsChanged = false;
      for (const pid of assignedIds) {
        const permit = permits.find(p => p.id === pid);
        if (permit && (permit.status === 'assigned' || permit.status === 'locked')) {
          permit.status = 'available';
          permit.assignedToCustomerId = undefined;
          permit.assignedCustomerName = undefined;
          permit.assignedByUserId = undefined;
          permit.assignedByUserName = undefined;
          permit.assignedAt = undefined;
          permitsChanged = true;
        }
      }
      if (permitsChanged) saveToStorage(STORAGE_KEYS.PERMITS, permits);

      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.from('permits').update({
          status: 'available',
          assigned_to_customer_id: null,
          assigned_customer_name: null,
          assigned_by_user_id: null,
          assigned_by_user_name: null,
          assigned_at: null,
        }).in('id', assignedIds).then(() => {});
        getSupabase()!.from('order_permits').delete().eq('order_id', orderId).then(() => {});
      }
    }

    // 2. فك ارتباط أي رسائل SMS كانت مطابقة مع هذا الطلب
    const smsMessages = this.getSmsMessages();
    let smsChanged = false;
    smsMessages.forEach(m => {
      if (m.matchedOrderId === orderId) {
        m.status = 'unmatched';
        m.matchedOrderId = undefined;
        m.matchedOrderNumber = undefined;
        m.matchedByUserId = undefined;
        m.matchedAt = undefined;
        smsChanged = true;
      }
    });
    if (smsChanged) saveToStorage(STORAGE_KEYS.SMS, smsMessages);

    // 3. حذف الطلب محلياً
    const filteredOrders = orders.filter(o => o.id !== orderId);
    saveToStorage(STORAGE_KEYS.ORDERS, filteredOrders);

    // 4. حذف سحابي
    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('sales_orders').delete().eq('id', orderId);
      } catch (e) {
        console.error('Cloud delete order error:', e);
      }
    }

    this.addAuditLog(currentUser.id, currentUser.fullName, 'DELETE_ORDER', 'sales_orders', orderId, {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      totalAmount: order.totalAmount,
      currency: order.currency,
    });

    return { success: true, message: `تم حذف الطلب #${order.orderNumber} وإرجاع أي تصاريح مرتبطة للمخزون بنجاح.` };
  }

  /** فك ارتباط تصريح وإرجاعه للمخزون مباشرة من سياق الطلب */
  static async unassignPermitFromOrder(orderId: string, permitId: string): Promise<{ success: boolean; message: string }> {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'الطلب غير موجود.' };

    const returnRes = await this.returnPermit(permitId, `فك ربط من الطلب #${order.orderNumber}`);
    if (!returnRes.success) return returnRes;

    order.assignedPermitIds = (order.assignedPermitIds || []).filter(id => id !== permitId);
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    return { success: true, message: `تم إرجاع التصريح للمخزون وفك ارتباطه عن الطلب #${order.orderNumber} بنجاح.` };
  }

  // --- Order Archiving ---
  /** الطلب يُؤرشف تلقائياً عندما يكتمل سداده وينقضي موعد زيارته (بتوقيت الرياض) */
  static isOrderArchiveCandidate(order: SalesOrder): boolean {
    if (order.isArchived) return false;
    if (order.orderStatus === 'cancelled') return false;
    const fullyPaid = order.totalAmount > 0 && order.paidAmount >= order.totalAmount;
    if (!fullyPaid) return false;
    const slotTime = new Date(`${order.targetDate}T${order.targetTime || '00:00'}:00+03:00`).getTime();
    if (Number.isNaN(slotTime)) return false;
    return slotTime < Date.now();
  }

  static async autoArchiveOrders(): Promise<number> {
    if (autoArchiveRunning) return 0;
    autoArchiveRunning = true;
    try {
      const orders = this.getOrders();
      const archivedAt = new Date().toISOString();
      const archivedIds: string[] = [];
      const archivedNumbers: number[] = [];
      const updated = orders.map(o => {
        if (!DataService.isOrderArchiveCandidate(o)) return o;
        archivedIds.push(o.id);
        archivedNumbers.push(o.orderNumber);
        return { ...o, isArchived: true, archivedAt };
      });
      if (archivedIds.length === 0) return 0;

      saveToStorage(STORAGE_KEYS.ORDERS, updated);
      const currentUser = this.getCurrentUser();
      this.addAuditLog(currentUser.id, currentUser.fullName, 'ARCHIVE_ORDER', 'sales_orders', archivedIds[0], {
        auto: true,
        count: archivedIds.length,
        orderNumbers: archivedNumbers,
      });
      await cloudArchiveOrders(archivedIds, archivedAt, true);
      return archivedIds.length;
    } finally {
      autoArchiveRunning = false;
    }
  }

  static async setOrderArchived(orderId: string, archived: boolean): Promise<{ success: boolean; message: string }> {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { success: false, message: 'الطلب غير موجود' };
    const order = orders[idx];
    if (archived === !!order.isArchived) {
      return { success: false, message: archived ? 'الطلب مؤرشف بالفعل' : 'الطلب غير مؤرشف' };
    }

    const archivedAt = archived ? new Date().toISOString() : undefined;
    orders[idx] = { ...order, isArchived: archived, archivedAt };
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    const currentUser = this.getCurrentUser();
    this.addAuditLog(currentUser.id, currentUser.fullName, 'ARCHIVE_ORDER', 'sales_orders', orderId, {
      auto: false,
      orderNumber: order.orderNumber,
      archived,
    });
    await cloudUpdateOrderResilient(orderId, { is_archived: archived, archived_at: archivedAt ?? null });

    return {
      success: true,
      message: archived
        ? `تم أرشفة الطلب #${order.orderNumber} — لن يظهر في القائمة النشطة`
        : `تم استرجاع الطلب #${order.orderNumber} من الأرشيف`,
    };
  }

  // --- SMS ---
  static getSmsMessages(): SmsMessage[] {
    return loadFromStorage(STORAGE_KEYS.SMS, []);
  }

  static parseSmsText(rawBody: string, sender: string): Partial<SmsMessage> {
    let parsedAmount: number | undefined;
    let parsedReferenceId: string | undefined;
    let parsedAccountNumber: string | undefined;
    let parsedProvider: AccountProvider = 'other';

    // كشف المزود من المرسل أولاً (عربي أو إنجليزي) ثم من متن الرسالة
    parsedProvider = detectProviderKeyword(sender) || detectProviderKeyword(rawBody) || 'other';

    // تنظيف فواصل الآلاف في الأرقام (مثل 1,500.00 إلى 1500.00) لتسهيل القراءة الصحيحة
    const normalizedBody = rawBody.replace(/(\d),(\d)/g, '$1$2');

    // 🛡️ حاجز أمان مالي: كشف العمليات الصادرة (خصم / سحب / مشتريات / سداد فواتير)
    // لا يجوز احتساب عملية خصم أو سحب كإيداع سداد لطلب عميل!
    const isDebitOrOutgoing = /(?:خصم|سحب|صادرة|حوالة\s*صادرة|تم\s*خصم|تم\s*سحب|شراء|مشتريات|سداد\s*فاتورة|تحويل\s*من\s*حسابك|تحويل\s*من\s*محفظتك|debit|withdrawn|sent\s*to|transferred\s*from|purchase|atm\s*withdraw)/i.test(normalizedBody);
    if (isDebitOrOutgoing) {
      return {
        sender,
        rawBody,
        parsedAmount: 0,
        parsedReferenceId: undefined,
        parsedAccountNumber: undefined,
        parsedProvider,
        status: 'unmatched',
      };
    }

    // إزالة جزء "الرصيد الحالي / المتاح" حتى لا يلتبس مع مبلغ التحويل المحول
    const bodyWithoutBalance = normalizedBody.replace(/(?:رصيدك\s*الحالي|الرصيد\s*المتاح|رصيدك|your\s*balance|current\s*balance|available\s*balance)\s*[:]?\s*[0-9]+(?:\.[0-9]{1,2})?/gi, '');

    // 1. مبالغ مصحوبة بكلمات مفتاحية صريحة (إيداع / استلام / واردة / إضافة / استقبال / تحويل)
    const keywordAmountRegex = /(?:مبلغ|استلام|استقبلت|استقبال|إيداع|ايداع|أودع|شحن|وارد|واردة|إضافة|اضافة|تمت\s*إضافة|تم\s*إيداع|تم\s*استلام|بمبلغ|قيمة|تم\s*دفع|amount|received|deposit|credited|paid)\s*[:]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
    // 2. مبالغ مصحوبة بالعملة مباشرة (مثل: 500 ر.س أو 1500 ج.م أو 200 SAR)
    const currencyAmountRegex = /([0-9]+(?:\.[0-9]{1,2})?)\s*(?:ر\.?س|ريال|ج\.?م|جنيه|SAR|EGP)/i;

    const matchKw = bodyWithoutBalance.match(keywordAmountRegex);
    const matchCur = bodyWithoutBalance.match(currencyAmountRegex);

    if (matchKw && matchKw[1]) {
      parsedAmount = parseFloat(matchKw[1]);
    } else if (matchCur && matchCur[1]) {
      parsedAmount = parseFloat(matchCur[1]);
    } else {
      // بحث عن رقم منطقي لا يمثل سنة (2024..2030) ولا يبدأ بصفر كالهاتف
      const potentialNums = bodyWithoutBalance.match(/\b([1-9][0-9]{1,5}(?:\.[0-9]{1,2})?)\b/g);
      if (potentialNums) {
        const nonYear = potentialNums.find(n => {
          const val = parseFloat(n);
          return val < 2020 || val > 2030;
        });
        if (nonYear) parsedAmount = parseFloat(nonYear);
        else parsedAmount = parseFloat(potentialNums[0]);
      }
    }

    const refRegex = /(?:رقم العملية|رقم المرجع|المرجع|معرف العملية|مرجع|العملية|ref|reference|txn|rrn|id)\s*[:]?\s*([A-Za-z0-9_-]{5,25})/i;
    const matchRef = rawBody.match(refRegex);
    if (matchRef && matchRef[1]) {
      parsedReferenceId = matchRef[1];
    }

    const phoneRegex = /(01[0-9]{9}|[0-9]{10,24}|[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/;
    const matchPhone = rawBody.match(phoneRegex);
    if (matchPhone && matchPhone[1]) {
      parsedAccountNumber = matchPhone[1];
    }

    return {
      sender,
      rawBody,
      parsedAmount,
      parsedReferenceId,
      parsedAccountNumber,
      parsedProvider,
      status: 'unmatched',
    };
  }

  static async addIncomingSms(
    sender: string,
    rawBody: string
  ): Promise<{ sms: SmsMessage; outcome: AutoMatchOutcome }> {
    const messages = this.getSmsMessages();
    const parsed = this.parseSmsText(rawBody, sender);

    const newSms: SmsMessage = {
      id: generateUUID(),
      sender,
      rawBody,
      parsedAmount: parsed.parsedAmount || 0,
      parsedReferenceId: parsed.parsedReferenceId || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      parsedAccountNumber: parsed.parsedAccountNumber,
      parsedProvider: parsed.parsedProvider,
      status: 'unmatched',
      receivedAt: new Date().toISOString(),
    };

    messages.unshift(newSms);
    saveToStorage(STORAGE_KEYS.SMS, messages);

    // Push to Supabase Cloud
    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('sms_messages').insert({
          id: newSms.id,
          sender: newSms.sender,
          raw_body: newSms.rawBody,
          parsed_amount: newSms.parsedAmount || null,
          parsed_reference_id: newSms.parsedReferenceId || null,
          parsed_account_number: newSms.parsedAccountNumber || null,
          parsed_provider: newSms.parsedProvider || null,
          status: 'unmatched',
          received_at: newSms.receivedAt,
        });
      } catch (e) {
        console.error(e);
      }
    }

    // محرك المطابقة التلقائية: التعرف على العميل من رقمه أو اسمه ومطابقة السداد فور الوصول
    const outcome = await this.autoMatchSms(newSms.id);
    return { sms: newSms, outcome };
  }

  // --- محرك المطابقة التلقائية ---

  // التعرف على العميل من الرسالة: رقم هاتف (في المرسل أو المتن) ثم الاسم الكامل/النيك نيم
  static identifyCustomerFromSms(sms: SmsMessage, customers: Customer[]): Customer | undefined {
    const candidates: string[] = [];
    const senderDigits = normalizePhoneDigits(sms.sender);
    if (senderDigits.length >= 10) candidates.push(senderDigits);
    (sms.rawBody.match(/[0-9]{10,15}/g) || []).forEach((d) => candidates.push(d));
    const email = sms.rawBody.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+/);
    if (email) candidates.push(email[0]);

    // مطابقة آخر 9 أرقام لتتساوى الصيغ المحلية والدولية (010… / +96650…)
    const tail = (p: string) => p.slice(-9);
    for (const cand of candidates) {
      const found = customers.find((c) =>
        [c.whatsappNumber, c.additionalPhone]
          .filter(Boolean)
          .map((p) => normalizePhoneDigits(p as string))
          .some((cp) => cp === cand || (cp.length >= 9 && cand.length >= 9 && tail(cp) === tail(cand)))
      );
      if (found) return found;
    }

    // الاسم داخل المتن — نفضل الاسم الأطول (الاسم الكامل قبل النيك نيم)
    const byName = customers
      .filter((c) =>
        [c.fullName, c.nickname]
          .filter((n): n is string => !!n && n.trim().length >= 3)
          .some((n) => sms.rawBody.includes(n))
      )
      .sort((a, b) => b.fullName.length - a.fullName.length);
    return byName[0];
  }

  // طلب العميل المفتوح بنفس عملة الرسالة — المستحق اليوم أولاً ثم الأقدم موعداً
  static findOpenOrderForCustomer(customerId: string, currency: CurrencyCode): SalesOrder | undefined {
    const today = riyadhToday();
    const candidates = this.getOrders().filter(
      (o) =>
        o.customerId === customerId &&
        o.orderStatus !== 'cancelled' &&
        !o.isArchived &&
        o.remainingAmount > 0 &&
        getOrderCurrency(o) === currency
    );
    return (
      candidates.find((o) => o.targetDate === today) ||
      candidates.slice().sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0]
    );
  }

  // مطابقة رسالة واحدة تلقائياً: عميل ← طلب مفتوح بنفس العملة ← تطبيق السداد
  static async autoMatchSms(smsId: string): Promise<AutoMatchOutcome> {
    const sms = this.getSmsMessages().find((m) => m.id === smsId);
    if (!sms) return { smsId, matched: false, reason: 'customer_not_found' };
    if (sms.status === 'matched') {
      return { smsId, matched: true, reason: 'ok', orderNumber: sms.matchedOrderNumber };
    }

    const currency = providerCurrency(sms.parsedProvider);
    const customer = this.identifyCustomerFromSms(sms, this.getCustomers());
    if (!customer) {
      return { smsId, matched: false, reason: 'customer_not_found', amount: sms.parsedAmount };
    }

    const order = this.findOpenOrderForCustomer(customer.id, currency);
    if (!order) {
      return {
        smsId,
        matched: false,
        reason: 'order_not_found',
        customerName: customer.fullName,
        amount: sms.parsedAmount,
      };
    }

    const res = await this.applySmsPaymentCore(sms.id, order.id, true);
    return {
      smsId,
      matched: res.success,
      reason: 'ok',
      customerName: customer.fullName,
      orderNumber: order.orderNumber,
      amount: sms.parsedAmount,
      currency,
      currencyWarning: res.currencyWarning,
    };
  }

  // تقسيم نص ملصوق إلى رسائل — يفصل بينها سطر فارغ، وإن لم يوجد فكل سطر رسالة
  static parseSmsBatchText(raw: string): Array<{ sender: string; body: string }> {
    const blocks = raw
      .split(/\n\s*\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    const units = blocks.length > 1 ? blocks : raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);

    return units
      .map((u) => {
        // بادئة "اسم المزود:" تُقبل كمرسل فقط إذا كانت مزوداً معروفاً
        const m = u.match(/^([^:：\n]{2,30})\s*[:：]\s*([\s\S]+)$/);
        if (m && m[2].trim().length > 10 && detectProviderKeyword(m[1])) {
          return { sender: m[1].trim(), body: m[2].trim() };
        }
        const provider = detectProviderKeyword(u);
        return { sender: provider ? PROVIDER_SENDER_NAMES[provider] : 'SMS', body: u };
      })
      .filter((u) => u.body.length > 5);
  }

  // استقبال دفعة رسائل دفعة واحدة — يعيد ملخصاً مجمّعاً لنتائج المحرك
  static async addIncomingSmsBatch(items: Array<{ sender: string; body: string }>): Promise<BatchIngestResult> {
    const outcomes: AutoMatchOutcome[] = [];
    for (const item of items) {
      const { outcome } = await this.addIncomingSms(item.sender, item.body);
      outcomes.push(outcome);
    }
    return this.batchSummary(outcomes);
  }

  // تشغيل المحرك على الرسائل غير المطابقة المخزنة (وصلت قبل إنشاء الطلب مثلاً)
  static async autoMatchAllUnmatched(): Promise<BatchIngestResult> {
    const unmatched = this.getSmsMessages().filter((m) => m.status === 'unmatched');
    const outcomes: AutoMatchOutcome[] = [];
    for (const m of unmatched) {
      outcomes.push(await this.autoMatchSms(m.id));
    }
    return this.batchSummary(outcomes);
  }

  private static batchSummary(outcomes: AutoMatchOutcome[]): BatchIngestResult {
    return {
      total: outcomes.length,
      matched: outcomes.filter((o) => o.matched).length,
      unknownSender: outcomes.filter((o) => !o.matched && o.reason === 'customer_not_found').length,
      identifiedNoOrder: outcomes.filter((o) => !o.matched && o.reason === 'order_not_found').length,
      outcomes,
    };
  }

  // ملخص السداد اليومي: مَن سدد بالكامل، ومَن لم يسدد، والرسائل المجهولة المصدر
  static getDailyPaymentSummary(date: string = riyadhToday()): DailyPaymentSummary {
    const customers = this.getCustomers();
    const dueOrders = this.getOrders().filter(
      (o) => o.targetDate === date && o.orderStatus !== 'cancelled'
    );

    const rows: DailyPaymentCustomerRow[] = [];
    dueOrders.forEach((o) => {
      const customer = customers.find((c) => c.id === o.customerId);
      const currency = getOrderCurrency(o);
      let row = rows.find((r) => r.customerId === o.customerId && r.currency === currency);
      if (!row) {
        row = {
          customerId: o.customerId,
          customerName: customer?.fullName || o.customerName,
          whatsappNumber: customer?.whatsappNumber || o.customerWhatsapp,
          orderNumbers: [],
          currency,
          totalDue: 0,
          totalPaid: 0,
          totalRemaining: 0,
        };
        rows.push(row);
      }
      row.orderNumbers.push(o.orderNumber);
      row.totalDue += o.totalAmount;
      row.totalPaid += o.paidAmount;
      row.totalRemaining += o.remainingAmount;
    });

    const messagesToday = this.getSmsMessages().filter((m) => riyadhDateOfIso(m.receivedAt) === date);
    const matchedTodayCount = messagesToday.filter((m) => m.status === 'matched').length;
    const unmatchedToday = messagesToday.filter((m) => m.status !== 'matched');
    const unknownSenderMessages = unmatchedToday.filter((m) => !this.identifyCustomerFromSms(m, customers));
    const identifiedUnmatchedMessages = unmatchedToday.filter((m) => !!this.identifyCustomerFromSms(m, customers));

    return {
      date,
      ordersCount: dueOrders.length,
      paidCustomers: rows.filter((r) => r.totalRemaining <= 0),
      unpaidCustomers: rows.filter((r) => r.totalRemaining > 0),
      matchedTodayCount,
      unknownSenderMessages,
      identifiedUnmatchedMessages,
    };
  }

  // --- التقرير اليومي للمالك (يُرسل على الواتساب آخر كل يوم) ---
  static buildOwnerDailyReport(date: string = riyadhToday()): { text: string } {
    const settings = this.getCompanySettings();
    const orders = this.getOrders();
    const permits = this.getPermits();

    const nowHm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
    const weekday = new Date().toLocaleDateString('ar-EG', { timeZone: 'Asia/Riyadh', weekday: 'long' });

    const todayOrders = orders.filter((o) => o.targetDate === date && o.orderStatus !== 'cancelled');
    const todayPermits = todayOrders.reduce((s, o) => s + (o.permitsCount || 0), 0);
    const maleCount = todayOrders.reduce((s, o) => s + (o.permitsCountMale || 0), 0);
    const femaleCount = todayOrders.reduce((s, o) => s + (o.permitsCountFemale || 0), 0);

    // تحصيل اليوم = إجمالي ما قُبض اليوم (سداد مباشر + رسائل مطابقة) — من تقرير المحصّلين
    const collectors = this.getDailyCollectorReport(date);
    const collected = { SAR: 0, EGP: 0 };
    collectors.forEach((c) => { collected.SAR += c.collectedSAR; collected.EGP += c.collectedEGP; });

    const overdue = orders
      .filter((o) => !o.isArchived && o.orderStatus !== 'cancelled' && o.remainingAmount > 0 && o.targetDate < date)
      .sort((a, b) => (a.targetDate > b.targetDate ? 1 : -1));
    const overdueShown = overdue.slice(0, 8);

    const availablePermits = permits.filter((p) => p.status === 'available').length;

    const fmtCur = (v: number, cur: string) => `${v.toLocaleString('en-US')} ${cur === 'EGP' ? 'ج.م' : 'ر.س'}`;
    const lines: string[] = [];
    lines.push(`🕌 *التقرير اليومي — ${settings.companyNameAr || 'مؤسسة حجز تصاريح الروضة'}*`);
    lines.push(`📅 ${date} (${weekday}) — الساعة ${nowHm} بتوقيت الرياض`);
    lines.push('');
    const genderNote = maleCount + femaleCount > 0 ? ` (رجال ${maleCount} / نساء ${femaleCount})` : '';
    lines.push(`📦 *حجز اليوم:* ${todayOrders.length} طلب — ${todayPermits} تصريح${genderNote}`);
    const collectedParts: string[] = [];
    if (collected.SAR > 0) collectedParts.push(fmtCur(collected.SAR, 'SAR'));
    if (collected.EGP > 0) collectedParts.push(fmtCur(collected.EGP, 'EGP'));
    lines.push(`💰 *تحصيل اليوم:* ${collectedParts.length ? collectedParts.join(' + ') : 'لا تحصيلات مسجلة بعد'}`);

    // تحصيل اليوم لكل موظف — المالك يحاسب كل واحد على اللي قبضه وعلى شغله
    if (collectors.length > 0) {
      lines.push('🧑‍💼 *تحصيل الفريق اليوم:*');
      collectors.forEach(c => {
        const parts: string[] = [];
        if (c.collectedSAR > 0) parts.push(`${c.collectedSAR.toLocaleString('en-US')} ر.س`);
        if (c.collectedEGP > 0) parts.push(`${c.collectedEGP.toLocaleString('en-US')} ج.م`);
        const money = parts.length ? parts.join(' + ') : 'بدون تحصيل نقدي';
        lines.push(`   • ${c.userName}: ${c.paymentsCount} عملية سداد — ${money} — سحب ${c.permitsClaimed} تصريح`);
      });
    }
    lines.push(`⚠️ *متأخرات السداد:* ${overdue.length} طلب`);
    overdueShown.forEach((o) =>
      lines.push(`   • طلب #${o.orderNumber} — ${o.customerName} — ${fmtCur(o.remainingAmount, getOrderCurrency(o))}`)
    );
    if (overdue.length > overdueShown.length) lines.push(`   • و${overdue.length - overdueShown.length} طلبات أخرى`);
    lines.push(`🎫 *تصاريح متاحة في المخزون:* ${availablePermits} من ${permits.length}`);
    return { text: lines.join('\n') };
  }

  /** رابط إرسال التقرير للمالك على واتساب — null إذا لم يُضف رقم واتساب للشركة */
  static getOwnerReportWhatsappUrl(date: string = riyadhToday()): string | null {
    const owner = this.getCompanySettings().whatsappNumber?.replace(/[^0-9]/g, '');
    if (!owner) return null;
    const { text } = this.buildOwnerDailyReport(date);
    return `https://wa.me/${owner}?text=${encodeURIComponent(text)}`;
  }

  // --- السيناريو التجريبي للسداد اليومي ---
  static getDailyScenarioTexts(): DailyScenarioTexts | null {
    const rec = loadFromStorage<DailyScenarioRecord | null>(STORAGE_KEYS.DAILY_SCENARIO, null);
    return rec?.texts || null;
  }

  static async seedDailyPaymentScenario(): Promise<{ customers: number; orders: number; accounts: number }> {
    await this.wipeAllData();
    const sc = buildDailyPaymentScenario();

    saveToStorage(STORAGE_KEYS.CUSTOMERS, sc.customers);
    saveToStorage(STORAGE_KEYS.ORDERS, sc.orders);
    saveToStorage(STORAGE_KEYS.SMS, []);
    saveToStorage(STORAGE_KEYS.ACCOUNTS, sc.financialAccounts);
    saveToStorage(STORAGE_KEYS.LOGS, sc.auditLogs);
    const record: DailyScenarioRecord = { createdAt: new Date().toISOString(), texts: sc.texts };
    saveToStorage(STORAGE_KEYS.DAILY_SCENARIO, record);

    if (getIsConfigured() && getSupabase()) {
      const sb = getSupabase()!;
      try {
        await sb.from('customers').insert(
          sc.customers.map((c) => ({
            id: c.id,
            full_name: c.fullName,
            whatsapp_number: c.whatsappNumber,
            additional_phone: c.additionalPhone || null,
            nickname: c.nickname || null,
            notes: c.notes || null,
            total_orders_count: c.totalOrdersCount,
            total_spent: c.totalSpent,
            created_at: c.createdAt,
          }))
        );

        // order_number تسلسلي — لا يُرسل يدوياً، نقرأ المعيّن ثم نوحّد الأرقام محلياً
        const buildOrderRows = (withNewCols: boolean) =>
          sc.orders.map((o) => ({
            id: o.id,
            customer_id: o.customerId,
            customer_name: o.customerName,
            customer_whatsapp: o.customerWhatsapp,
            permits_count: o.permitsCount,
            target_date: o.targetDate,
            target_time: o.targetTime,
            order_type: o.orderType,
            order_status: o.orderStatus,
            delivery_status: o.deliveryStatus,
            unit_price: o.unitPrice,
            total_amount: o.totalAmount,
            paid_amount: o.paidAmount,
            remaining_amount: o.remainingAmount,
            notes: o.notes || null,
            created_by: o.createdBy,
            created_at: o.createdAt,
            ...(withNewCols ? { currency: o.currency || 'SAR', is_archived: !!o.isArchived, archived_at: o.archivedAt || null } : {}),
          }));
        let { data: insertedOrders, error: ordersErr } = await sb
          .from('sales_orders')
          .insert(buildOrderRows(true))
          .select('id, order_number');
        if (ordersErr) {
          const retry = await sb.from('sales_orders').insert(buildOrderRows(false)).select('id, order_number');
          insertedOrders = retry.data;
          ordersErr = retry.error;
        }
        if (ordersErr) console.error('Cloud scenario orders insert error:', ordersErr);

        const orderNumMap: Record<string, number> = {};
        insertedOrders?.forEach((r) => { orderNumMap[r.id] = r.order_number; });
        saveToStorage(
          STORAGE_KEYS.ORDERS,
          sc.orders.map((o) => ({ ...o, orderNumber: orderNumMap[o.id] ?? o.orderNumber }))
        );

        const buildAccRows = (withCurrency: boolean) =>
          sc.financialAccounts.map((a) => ({
            id: a.id,
            account_name: a.accountName,
            account_number: a.accountNumber,
            type: a.type,
            provider: a.provider,
            account_holder_name: a.accountHolderName || null,
            iban: a.iban || null,
            branch_name: a.branchName || null,
            current_balance: a.currentBalance,
            is_active: a.isActive,
            notes: a.notes || null,
            created_at: a.createdAt,
            ...(withCurrency ? { currency: a.currency || null } : {}),
          }));
        let { error: accErr } = await sb.from('financial_accounts').insert(buildAccRows(true));
        if (accErr) {
          const retry = await sb.from('financial_accounts').insert(buildAccRows(false));
          accErr = retry.error;
        }
        if (accErr) console.error('Cloud scenario accounts insert error:', accErr);

        await sb.from('audit_logs').insert(
          sc.auditLogs.map((l) => ({
            id: l.id,
            user_id: null,
            action_type: l.actionType,
            entity_name: l.entityName,
            entity_id: l.entityId,
            details: { ...l.details, userName: l.userName },
            created_at: l.createdAt,
          }))
        );

        console.log('✅ Daily payment scenario pushed to cloud');
      } catch (e) {
        console.error('Cloud scenario seed error:', e);
      }
    }

    return { customers: sc.customers.length, orders: sc.orders.length, accounts: sc.financialAccounts.length };
  }

  static async matchSmsToOrder(smsId: string, orderId: string): Promise<{ success: boolean; message: string }> {
    const messages = this.getSmsMessages();
    const sms = messages.find(m => m.id === smsId);

    if (!sms) return { success: false, message: 'رسالة الدفع غير موجودة' };
    if (sms.status === 'matched') return { success: false, message: 'هذه الرسالة تم مطابقتها واحتسابها مسبقاً' };

    const order = this.getOrders().find(o => o.id === orderId);
    if (!order) return { success: false, message: 'طلب العميل غير موجود' };

    return this.applySmsPaymentCore(smsId, orderId, false);
  }

  // تطبيق السداد على الطلب — المسار المشترك بين المطابقة اليدوية ومحرك المطابقة التلقائية
  private static async applySmsPaymentCore(
    smsId: string,
    orderId: string,
    auto: boolean
  ): Promise<{ success: boolean; message: string; orderNumber?: number; currencyWarning?: string }> {
    const currentUser = this.getCurrentUser();
    const messages = this.getSmsMessages();
    const sms = messages.find(m => m.id === smsId);
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);

    if (!sms || sms.status === 'matched' || !order) {
      return { success: false, message: 'رسالة الدفع أو الطلب غير متاح للمطابقة' };
    }

    // ✅ حاجز أمني: رسالة بلا مبلغ صحيح لا تُطابق أبداً — كانت تُغلق الطلب بدفعة صفرية
    // وتُستهلك الرسالة (status='matched') فلا يمكن إعادة مطابقتها.
    const orderCurrency = getOrderCurrency(order);
    const smsAmount = Math.round(Math.max(0, Number(sms.parsedAmount) || 0) * 100) / 100;
    if (smsAmount <= 0) {
      return { success: false, message: 'الرسالة لا تحتوي على مبلغ صحيح — لا يمكن مطابقتها.' };
    }

    // ✅ حاجز المحاسبة: في حالة المطابقة التلقائية فقط نتأكد من عدم تجاوز المبلغ للمتبقي
    // أما في حالة المطابقة اليدوية الصريحة المحددة من المستخدم فنسمح بربط الدفعة وتأكيد الطلب
    const remaining = Math.max(0, Math.round((order.totalAmount - order.paidAmount) * 100) / 100);
    if (auto && smsAmount > remaining + 0.001) {
      return {
        success: false,
        orderNumber: order.orderNumber,
        message: `مبلغ التحويل (${smsAmount} ${currencySymbol(orderCurrency)}) أكبر من المتبقي على الطلب #${order.orderNumber} (${remaining} ${currencySymbol(orderCurrency)}). طابِق الطلب يدوياً أو قسّم المبلغ.`,
      };
    }

    sms.status = 'matched';
    sms.matchedOrderId = orderId;
    sms.matchedOrderNumber = order.orderNumber;
    sms.matchedByUserId = currentUser.id;
    sms.matchedAt = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.SMS, messages);

    order.paidAmount = Math.round((order.paidAmount + smsAmount) * 100) / 100;
    order.remainingAmount = Math.max(0, Math.round((order.totalAmount - order.paidAmount) * 100) / 100);
    if (order.paidAmount >= order.totalAmount) {
      order.orderStatus = 'confirmed';
    }
    // تسجيل السداد في سجل الطلب — مطابقات SMS بتُحسب للموظف اللي طابقها
    order.payments = [...(order.payments || []), {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      amount: smsAmount,
      method: 'sms',
      byUserId: currentUser.id,
      byUserName: currentUser.fullName,
      at: new Date().toISOString(),
      note: sms.parsedReferenceId ? `تحويل ${sms.parsedReferenceId}` : undefined,
    } as OrderPayment];
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    const accounts = this.getFinancialAccounts();
    // نفضّل الخزنة المطابقة لنفس العملة، وكل عملة لها خزنتها
    const account =
      accounts.find(a => a.provider === sms.parsedProvider && accountCurrency(a) === orderCurrency) ||
      accounts.find(a => a.provider === sms.parsedProvider);
    let currencyWarning = '';
    if (account) {
      if (accountCurrency(account) !== orderCurrency) {
        currencyWarning = ` — تنبيه: عملة الخزنة (${currencySymbol(accountCurrency(account))}) تخالف عملة الطلب (${currencySymbol(orderCurrency)})`;
      }
      account.currentBalance = Math.round((account.currentBalance + smsAmount) * 100) / 100;
      saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);

      // Push updated balance to cloud via atomic RPC (تعديل رصيد آمن متوافق مع RLS)
      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.rpc('rpc_adjust_balance', {
          p_account_id: account.id,
          p_delta: smsAmount,
          p_reason: `مطابقة سداد SMS للطلب #${order.orderNumber}`,
        }).then(({ error }) => {
          if (error) {
            Promise.resolve(
              getSupabase()!.from('financial_accounts').update({
                current_balance: account.currentBalance,
              }).eq('id', account.id)
            ).catch(() => {});
          }
        });
      }
    }

    this.addAuditLog(
      currentUser.id,
      currentUser.fullName,
      'MATCH_SMS',
      'sales_orders',
      orderId,
      {
        orderNumber: order.orderNumber,
        amount: sms.parsedAmount,
        ref: sms.parsedReferenceId,
        ...(auto ? { auto: true, source: 'محرك المطابقة التلقائية' } : {}),
      }
    );

    // تحديث SMS في السحابة
    if (getIsConfigured() && getSupabase()) {
      try {
        // matched_by_user_id مرجع UUID إلى profiles(auth) — معرّف المستخدم المحلي ليس UUID صالحاً
        const { error: smsErr } = await getSupabase()!.from('sms_messages').update({
          status: 'matched',
          matched_order_id: orderId,
          matched_order_number: order.orderNumber,
          matched_by_user_id: null,
          matched_at: new Date().toISOString(),
        }).eq('id', smsId);
        if (smsErr) console.error('Cloud sms match update error:', smsErr);

        // تحديث الطلب في السحابة
        const { error: orderErr } = await getSupabase()!.from('sales_orders').update({
          paid_amount: order.paidAmount,
          remaining_amount: order.remainingAmount,
          order_status: order.orderStatus,
          payments: order.payments || [],
        }).eq('id', orderId);
        if (orderErr) console.error('Cloud order payment update error:', orderErr);
      } catch (e) {
        console.error('Cloud SMS match error:', e);
      }
    }

    const autoNote = auto ? ' (مطابقة تلقائية)' : '';
    return {
      success: true,
      message: `تم تأكيد سداد مبلغ ${sms.parsedAmount} ${currencySymbol(orderCurrency)} بنجاح للطلب #${order.orderNumber}${currencyWarning}${autoNote}`,
      orderNumber: order.orderNumber,
      currencyWarning,
    };
  }

  /** فك مطابقة رسالة SMS عن الطلب وإعادة احتساب المبالغ ورصيد الحساب المالي وسجل الرقابة */
  static async unmatchSms(smsId: string): Promise<{ success: boolean; message: string }> {
    const currentUser = this.getCurrentUser();
    const messages = this.getSmsMessages();
    const sms = messages.find(m => m.id === smsId);
    if (!sms) return { success: false, message: 'رسالة الدفع غير موجودة.' };
    if (sms.status !== 'matched') return { success: false, message: 'هذه الرسالة غير مطابقة أصلاً.' };

    const orderId = sms.matchedOrderId;
    const orderNumber = sms.matchedOrderNumber;
    const orders = this.getOrders();
    const order = orderId ? orders.find(o => o.id === orderId) : undefined;
    const smsAmount = Math.round(Math.max(0, Number(sms.parsedAmount) || 0) * 100) / 100;

    // 1. إعادة حالة الرسالة إلى غير مطابقة
    sms.status = 'unmatched';
    sms.matchedOrderId = undefined;
    sms.matchedOrderNumber = undefined;
    sms.matchedByUserId = undefined;
    sms.matchedAt = undefined;
    saveToStorage(STORAGE_KEYS.SMS, messages);

    // 2. خصم المبلغ من الطلب وإعادة احتساب المتبقي وتحديث الحالة
    if (order && smsAmount > 0) {
      order.paidAmount = Math.max(0, Math.round((order.paidAmount - smsAmount) * 100) / 100);
      order.remainingAmount = Math.max(0, Math.round((order.totalAmount - order.paidAmount) * 100) / 100);
      if (order.paidAmount < order.totalAmount && order.orderStatus === 'confirmed') {
        order.orderStatus = 'searching';
      }
      // إزالة الدفعة من سجل دفعات الطلب
      if (order.payments) {
        const pIdx = order.payments.findIndex(p => p.method === 'sms' && (sms.parsedReferenceId ? p.note?.includes(sms.parsedReferenceId) : p.amount === smsAmount));
        if (pIdx !== -1) {
          order.payments.splice(pIdx, 1);
        }
      }
      saveToStorage(STORAGE_KEYS.ORDERS, orders);

      // تحديث الطلب سحابياً
      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.from('sales_orders').update({
          paid_amount: order.paidAmount,
          remaining_amount: order.remainingAmount,
          order_status: order.orderStatus,
          payments: order.payments || [],
        }).eq('id', order.id).then(() => {});
      }
    }

    // 3. خصم المبلغ من الخزنة / الحساب البنكي المقيد عليه
    if (smsAmount > 0) {
      const accounts = this.getFinancialAccounts();
      const orderCurrency = order ? getOrderCurrency(order) : providerCurrency(sms.parsedProvider);
      const account =
        accounts.find(a => a.provider === sms.parsedProvider && accountCurrency(a) === orderCurrency) ||
        accounts.find(a => a.provider === sms.parsedProvider);

      if (account) {
        account.currentBalance = Math.round((account.currentBalance - smsAmount) * 100) / 100;
        saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);

        if (getIsConfigured() && getSupabase()) {
          getSupabase()!.rpc('rpc_adjust_balance', {
            p_account_id: account.id,
            p_delta: -smsAmount,
            p_reason: `إلغاء مطابقة SMS للطلب #${orderNumber || orderId}`,
          }).then(({ error }) => {
            if (error) {
              getSupabase()!.from('financial_accounts').update({
                current_balance: account.currentBalance,
              }).eq('id', account.id).then(() => {});
            }
          });
        }
      }
    }

    // 4. تحديث الرسالة سحابياً
    if (getIsConfigured() && getSupabase()) {
      getSupabase()!.from('sms_messages').update({
        status: 'unmatched',
        matched_order_id: null,
        matched_order_number: null,
        matched_by_user_id: null,
        matched_at: null,
      }).eq('id', smsId).then(() => {});
    }

    // 5. توثيق في سجل الرقابة
    this.addAuditLog(currentUser.id, currentUser.fullName, 'UNMATCH_SMS', 'sms_messages', smsId, {
      orderNumber,
      orderId,
      amount: sms.parsedAmount,
      ref: sms.parsedReferenceId,
    });

    return {
      success: true,
      message: `تم إلغاء مطابقة الرسالة عن الطلب #${orderNumber || ''} بنجاح وإعادة احتساب المبالغ.`,
    };
  }

  /** حذف رسالة SMS غير مطابقة (مخصص للمدير العام لحذف الرسائل العشوائية أو المكررة) */
  static async deleteSms(smsId: string): Promise<{ success: boolean; message: string }> {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'super_admin') {
      return { success: false, message: 'عذراً، حذف رسائل الـ SMS مخصص للمدير العام فقط.' };
    }

    const messages = this.getSmsMessages();
    const sms = messages.find(m => m.id === smsId);
    if (!sms) return { success: false, message: 'رسالة الدفع غير موجودة.' };
    if (sms.status === 'matched') {
      return { success: false, message: 'لا يمكن حذف رسالة تمت مطابقتها مع طلب. يرجى إلغاء المطابقة أولاً.' };
    }

    const filtered = messages.filter(m => m.id !== smsId);
    saveToStorage(STORAGE_KEYS.SMS, filtered);

    if (getIsConfigured() && getSupabase()) {
      try {
        await getSupabase()!.from('sms_messages').delete().eq('id', smsId);
      } catch (e) {
        console.error('Cloud delete sms error:', e);
      }
    }

    this.addAuditLog(currentUser.id, currentUser.fullName, 'DELETE_SMS', 'sms_messages', smsId, {
      sender: sms.sender,
      amount: sms.parsedAmount,
      ref: sms.parsedReferenceId,
    });

    return { success: true, message: 'تم حذف الرسالة بنجاح.' };
  }

  // تسجيل سداد يدوي مباشر (زر "تم السداد") — يُسجّل باسم الموظف اللي ضغط عشان يتحاسب عليه آخر اليوم
  static async addOrderPayment(
    orderId: string,
    amount: number,
    note?: string
  ): Promise<{ success: boolean; message: string; orderNumber?: number }> {
    const currentUser = this.getCurrentUser();
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'الطلب غير موجود.' };

    const cur = getOrderCurrency(order);
    const amountNum = Math.round(Math.max(0, Number(amount) || 0) * 100) / 100;
    if (amountNum <= 0) return { success: false, message: 'يرجى إدخال مبلغ سداد صحيح أكبر من صفر.' };

    const payment: OrderPayment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      amount: amountNum,
      method: 'manual',
      byUserId: currentUser.id,
      byUserName: currentUser.fullName,
      at: new Date().toISOString(),
      note: note?.trim() || undefined,
    };

    order.paidAmount = Math.round((order.paidAmount + amountNum) * 100) / 100;
    order.remainingAmount = Math.max(0, Math.round((order.totalAmount - order.paidAmount) * 100) / 100);
    if (order.paidAmount >= order.totalAmount && order.totalAmount > 0) {
      order.orderStatus = 'confirmed';
    }
    order.payments = [...(order.payments || []), payment];
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    // ✅ السداد اليدوي (نقدي/تحويل مباشر) يجب أن يزيد رصيد الخزنة أيضاً عبر rpc_adjust_balance
    const accounts = this.getFinancialAccounts();
    const payCurrency = getOrderCurrency(order);
    const cashAccount =
      accounts.find(a => a.isActive && a.type === 'wallet' && accountCurrency(a) === payCurrency) ||
      accounts.find(a => a.isActive && a.type === 'wallet');
    if (cashAccount) {
      cashAccount.currentBalance = Math.round((cashAccount.currentBalance + amountNum) * 100) / 100;
      saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);
      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.rpc('rpc_adjust_balance', {
          p_account_id: cashAccount.id,
          p_delta: amountNum,
          p_reason: `سداد يدوي مباشر للطلب #${order.orderNumber}`,
        }).then(({ error }) => {
          if (error) {
            Promise.resolve(
              getSupabase()!.from('financial_accounts').update({
                current_balance: cashAccount.currentBalance,
              }).eq('id', cashAccount.id)
            ).catch(() => {});
          }
        });
      }
    }

    this.addAuditLog(
      currentUser.id,
      currentUser.fullName,
      'RECORD_PAYMENT',
      'sales_orders',
      orderId,
      { orderNumber: order.orderNumber, amount: amountNum, method: 'manual', customerName: order.customerName }
    );

    if (getIsConfigured() && getSupabase()) {
      getSupabase()!.from('sales_orders').update({
        paid_amount: order.paidAmount,
        remaining_amount: order.remainingAmount,
        order_status: order.orderStatus,
        payments: order.payments,
      }).eq('id', orderId).then(({ error }) => {
        if (error) console.error('Cloud addOrderPayment error:', error);
      });
    }

    const fullyPaid = order.remainingAmount <= 0;
    return {
      success: true,
      orderNumber: order.orderNumber,
      message: fullyPaid
        ? `✅ تم تسجيل سداد ${amountNum} ${currencySymbol(cur)} للطلب #${order.orderNumber} باسم ${currentUser.fullName} — اكتمل السداد.`
        : `✅ تم تسجيل سداد ${amountNum} ${currencySymbol(cur)} للطلب #${order.orderNumber} باسم ${currentUser.fullName} — المتبقي ${order.remainingAmount} ${currencySymbol(cur)}.`,
    };
  }

  // تسجيل آخر تذكير سداد أُرسل للعميل — يعرف المالك والموظف مين تابع ومتى
  static recordPaymentReminder(orderId: string): string | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;
    const now = new Date().toISOString();
    order.lastReminderAt = now;
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    const currentUser = this.getCurrentUser();
    this.addAuditLog(currentUser.id, currentUser.fullName, 'SEND_REMINDER', 'sales_orders', orderId, {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      remaining: order.remainingAmount,
    });

    if (getIsConfigured() && getSupabase()) {
      getSupabase()!.from('sales_orders').update({ last_reminder_at: now }).eq('id', orderId).then(({ error }) => {
        if (error) console.error('Cloud recordPaymentReminder error:', error);
      });
    }
    return now;
  }

  // تقرير تحصيل اليوم لكل موظف — مين قبض كام وعمل كام عملية، عشان المالك يحاسبهم آخر اليوم
  static getDailyCollectorReport(date: string = riyadhToday()): DailyCollectorRow[] {
    const rowsMap = new Map<string, DailyCollectorRow>();
    const ensureRow = (userId: string, userName: string): DailyCollectorRow => {
      let row = rowsMap.get(userId);
      if (!row) {
        row = { userId, userName, paymentsCount: 0, collectedSAR: 0, collectedEGP: 0, permitsClaimed: 0, ordersCreated: 0 };
        rowsMap.set(userId, row);
      }
      return row;
    };

    // 1) السدادات المسجلة اليوم (يدوي + مطابقات SMS) — اللي قبضه كل موظف
    this.getOrders().forEach(o => {
      (o.payments || []).forEach(p => {
        if (riyadhDateOfIso(p.at) !== date) return;
        const row = ensureRow(p.byUserId, p.byUserName);
        row.paymentsCount += 1;
        if (getOrderCurrency(o) === 'EGP') row.collectedEGP += p.amount;
        else row.collectedSAR += p.amount;
      });
    });

    // 2) سجل الحركات — التصاريح المسحوبة والطلبات المنشأة اليوم لكل موظف
    this.getAuditLogs().forEach(l => {
      if (riyadhDateOfIso(l.createdAt) !== date) return;
      const row = ensureRow(this.resolveLogUserId(l.userId, l.userName), l.userName);
      if (l.actionType === 'CLAIM_PERMIT') row.permitsClaimed += 1;
      if (l.actionType === 'CREATE_ORDER') row.ordersCreated += 1;
    });

    // ضمان ظهور الموظفين في التقرير حتى في حال بداية اليوم قبل أي حركة
    if (rowsMap.size === 0) {
      const activeProfiles = this.getProfiles().filter(p => p.isActive !== false);
      activeProfiles.forEach(p => {
        ensureRow(p.id, p.fullName);
      });
    }

    // الأعلى تحصيلاً أولاً
    return [...rowsMap.values()].sort(
      (a, b) => (b.collectedSAR + b.collectedEGP) - (a.collectedSAR + a.collectedEGP)
    );
  }

  // مطابقة سجل التدقيق بالمستخدم الصحيح — السحابة ترجع user_id فارغ (قيد FK)،
  // فنعوّضه بالاسم من الملفات المحلية لكي يظل تقرير تحصيل كل موظف موحّداً بدلاً من صفين لنفس الشخص
  private static resolveLogUserId(userId: string, userName: string): string {
    if (userId && userId.trim() !== '') return userId;
    if (!userName) return '';
    const match = this.getProfiles().find(p => p.fullName === userName);
    return match ? match.id : '';
  }

  static getAuditLogs(): AuditLog[] {
    return loadFromStorage(STORAGE_KEYS.LOGS, []);
  }

  static addAuditLog(
    userId: string, 
    userName: string, 
    actionType: AuditLog['actionType'], 
    entityName: string, 
    entityId: string, 
    details: Record<string, any>
  ): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: generateUUID(),
      userId,
      userName,
      actionType,
      entityName,
      entityId,
      details,
      createdAt: new Date().toISOString(),
    };
    logs.unshift(newLog);
    if (logs.length > 500) logs.length = 500;
    saveToStorage(STORAGE_KEYS.LOGS, logs);

    // Push to cloud — entity_id في السحابة من نوع UUID، فلا نرسل إلا السجلات المرتبطة بكيان UUID صالح.
    // user_id يُترك null لأن جدول profiles السحابي مرتبط بـ auth.users وقد لا يوجد المستخدم فيه فيُخالف قيد FK
    if (getIsConfigured() && getSupabase()) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(entityId)) {
        getSupabase()!.from('audit_logs').insert({
          id: newLog.id,
          user_id: null,
          action_type: actionType,
          entity_name: entityName,
          entity_id: entityId,
          details: { ...details, userName, userId },
        }).then(({ error }) => {
          if (error) console.error('Cloud audit log insert error:', error);
        });
      }
    }
  }

  private static updateCustomerOrderStats(customerId: string, addOrders: number, addSpent: number): void {
    const customers = this.getCustomers();
    const cust = customers.find(c => c.id === customerId);
    if (cust) {
      cust.totalOrdersCount += addOrders;
      cust.totalSpent += addSpent;
      saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);

      // Push stats to cloud
      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.from('customers').update({
          total_orders_count: cust.totalOrdersCount,
          total_spent: cust.totalSpent,
        }).eq('id', customerId).then(({ error }) => {
          if (error) console.error('Cloud customer stats update error:', error);
        });
      }
    }
  }

  static resetToDefault(): void {
    localStorage.clear();
    saveToStorage(STORAGE_KEYS.SETTINGS, initialCompanySettings);
    saveToStorage(STORAGE_KEYS.ACCOUNTS, initialFinancialAccounts);
    // لا حسابات افتراضية ولا جلسة افتراضية: بعد التهيئة يجب تسجيل الدخول عبر Supabase
    saveToStorage(STORAGE_KEYS.PROFILES, []);
    saveToStorage(STORAGE_KEYS.CUSTOMERS, initialCustomers);
    saveToStorage(STORAGE_KEYS.PERMITS, generateInitialPermits());
    saveToStorage(STORAGE_KEYS.ORDERS, initialOrders);
    saveToStorage(STORAGE_KEYS.SMS, initialSmsMessages);
    saveToStorage(STORAGE_KEYS.LOGS, initialAuditLogs);
    window.location.reload();
  }

  // --- إدارة البيانات: مسح شامل / توليد تجربة حية ---
  static async wipeAllData(): Promise<void> {
    saveToStorage(STORAGE_KEYS.CUSTOMERS, []);
    saveToStorage(STORAGE_KEYS.PERMITS, []);
    saveToStorage(STORAGE_KEYS.ORDERS, []);
    saveToStorage(STORAGE_KEYS.SMS, []);
    saveToStorage(STORAGE_KEYS.LOGS, []);
    saveToStorage(STORAGE_KEYS.ACCOUNTS, []);
    // نصوص سيناريو السداد اليومي ترتبط بالبيانات المولّدة — تُمسح معها حتى لا تبقى بيانات قديمة
    try {
      localStorage.removeItem(STORAGE_KEYS.DAILY_SCENARIO);
    } catch {
      /* ignore */
    }

    if (getIsConfigured() && getSupabase()) {
      const sb = getSupabase()!;
      const ALL = '00000000-0000-0000-0000-000000000000';
      try {
        // ترتيب الحذف يحترم المفاتيح الأجنبية (order_permits مرتبط بالطلبات والتصاريح)
        await sb.from('order_permits').delete().neq('order_id', ALL);
        await sb.from('audit_logs').delete().neq('id', ALL);
        await sb.from('sms_messages').delete().neq('id', ALL);
        await sb.from('sales_orders').delete().neq('id', ALL);
        await sb.from('permits').delete().neq('id', ALL);
        await sb.from('customers').delete().neq('id', ALL);
        await sb.from('financial_accounts').delete().neq('id', ALL);
      } catch (e) {
        console.error('Cloud wipe error:', e);
      }
    }
  }

  static async seedLiveDemo(): Promise<{ permits: number; orders: number; customers: number; sms: number; accounts: number; logs: number }> {
    await this.wipeAllData();
    const demo = buildDemoDataset();

    saveToStorage(STORAGE_KEYS.CUSTOMERS, demo.customers);
    saveToStorage(STORAGE_KEYS.PERMITS, demo.permits);
    saveToStorage(STORAGE_KEYS.ORDERS, demo.orders);
    saveToStorage(STORAGE_KEYS.SMS, demo.smsMessages);
    saveToStorage(STORAGE_KEYS.ACCOUNTS, demo.financialAccounts);
    saveToStorage(STORAGE_KEYS.LOGS, demo.auditLogs);

    if (getIsConfigured() && getSupabase()) {
      const sb = getSupabase()!;
      try {
        await sb.from('customers').insert(
          demo.customers.map((c) => ({
            id: c.id,
            full_name: c.fullName,
            whatsapp_number: c.whatsappNumber,
            additional_phone: c.additionalPhone || null,
            nickname: c.nickname || null,
            notes: c.notes || null,
            total_orders_count: c.totalOrdersCount,
            total_spent: c.totalSpent,
            created_at: c.createdAt,
          }))
        );

        await sb.from('permits').insert(
          demo.permits.map((p) => ({
            id: p.id,
            permit_code: p.permitCode,
            slot_date: p.slotDate,
            slot_hour: p.slotHour,
            slot_minute: p.slotMinute,
            image_url: p.imageUrl,
            status: p.status,
            assigned_to_customer_id: p.assignedToCustomerId || null,
            assigned_customer_name: p.assignedCustomerName || null,
            // الحقول المرجعية UUID إلى profiles(auth) — نسخة العرض المحلية ليست UUID صالحاً
            assigned_by_user_id: null,
            assigned_by_user_name: p.assignedByUserName || null,
            assigned_at: p.assignedAt || null,
            locked_by_user_id: null,
            locked_at: p.lockedAt || null,
            notes: p.notes || null,
            created_at: p.createdAt,
          }))
        );

        // order_number هو BIGSERIAL — لا يُرسل يدوياً؛ نقرأ القيم المعينة ونوحدها محلياً وفي SMS
        const buildOrderRows = (withNewCols: boolean) => demo.orders.map((o) => ({
          id: o.id,
          customer_id: o.customerId,
          customer_name: o.customerName,
          customer_whatsapp: o.customerWhatsapp,
          permits_count: o.permitsCount,
          target_date: o.targetDate,
          target_time: o.targetTime,
          order_type: o.orderType,
          order_status: o.orderStatus,
          delivery_status: o.deliveryStatus,
          unit_price: o.unitPrice,
          total_amount: o.totalAmount,
          paid_amount: o.paidAmount,
          remaining_amount: o.remainingAmount,
          notes: o.notes || null,
          created_by: o.createdBy,
          created_at: o.createdAt,
          ...(withNewCols ? { currency: o.currency || 'SAR', is_archived: !!o.isArchived, archived_at: o.archivedAt || null } : {}),
        }));
        let { data: insertedOrders, error: ordersErr } = await sb
          .from('sales_orders')
          .insert(buildOrderRows(true))
          .select('id, order_number');
        if (ordersErr) {
          // الأعمدة الجديدة قد لا تكون مضافة بعد — أعد البذر بدونها
          const retry = await sb.from('sales_orders').insert(buildOrderRows(false)).select('id, order_number');
          insertedOrders = retry.data;
          ordersErr = retry.error;
        }
        if (ordersErr) console.error('Cloud orders insert error:', ordersErr);

        const orderNumMap: Record<string, number> = {};
        insertedOrders?.forEach((r) => { orderNumMap[r.id] = r.order_number; });

        const syncedOrders = demo.orders.map((o) => ({
          ...o,
          orderNumber: orderNumMap[o.id] ?? o.orderNumber,
        }));
        saveToStorage(STORAGE_KEYS.ORDERS, syncedOrders);

        // ربط الطلبات بالتصاريح سحابياً (order_permits) — بدونه تفقد شاشة الطلبات سجل السحب عند المزامنة
        const orderLinks: Array<{ order_id: string; permit_id: string }> = [];
        syncedOrders.forEach((o) => {
          (o.assignedPermitIds || []).forEach((pid) => orderLinks.push({ order_id: o.id, permit_id: pid }));
        });
        if (orderLinks.length > 0) {
          try {
            const { error: linksErr } = await sb.from('order_permits').insert(orderLinks);
            if (linksErr) console.error('Cloud order_permits insert error:', linksErr);
          } catch (e) {
            console.error('Cloud order_permits insert exception:', e);
          }
        }

        const syncedSms = demo.smsMessages.map((s) => ({
          ...s,
          matchedOrderNumber: s.matchedOrderId ? orderNumMap[s.matchedOrderId] ?? s.matchedOrderNumber : null,
        }));
        saveToStorage(STORAGE_KEYS.SMS, syncedSms);

        await sb.from('sms_messages').insert(
          syncedSms.map((s) => ({
            id: s.id,
            sender: s.sender,
            raw_body: s.rawBody,
            parsed_amount: s.parsedAmount || null,
            parsed_reference_id: s.parsedReferenceId || null,
            parsed_account_number: s.parsedAccountNumber || null,
            parsed_provider: s.parsedProvider || null,
            status: s.status,
            matched_order_id: s.matchedOrderId || null,
            matched_order_number: s.matchedOrderNumber,
            matched_by_user_id: null,
            matched_at: s.matchedAt || null,
            received_at: s.receivedAt,
          }))
        );

        const buildAccRows = (withCurrency: boolean) =>
          demo.financialAccounts.map((a) => ({
            id: a.id,
            account_name: a.accountName,
            account_number: a.accountNumber,
            type: a.type,
            provider: a.provider,
            account_holder_name: a.accountHolderName || null,
            iban: a.iban || null,
            branch_name: a.branchName || null,
            current_balance: a.currentBalance,
            is_active: a.isActive,
            notes: a.notes || null,
            created_at: a.createdAt,
            ...(withCurrency ? { currency: a.currency || null } : {}),
          }));
        let { error: accErr } = await sb.from('financial_accounts').insert(buildAccRows(true));
        if (accErr) {
          // عمود العملة قد لا يكون مضافاً بعد في قاعدة قديمة — أعد البذر بدونه
          const retry = await sb.from('financial_accounts').insert(buildAccRows(false));
          accErr = retry.error;
        }
        if (accErr) console.error('Cloud accounts insert error:', accErr);

        // entity_id في السحابة UUID وكل كياناتنا كذلك — نُرسل مع userName داخل details
        await sb.from('audit_logs').insert(
          demo.auditLogs.map((l) => ({
            id: l.id,
            user_id: null,
            action_type: l.actionType,
            entity_name: l.entityName,
            entity_id: l.entityId,
            details: { ...l.details, userName: l.userName },
            created_at: l.createdAt,
          }))
        );

        console.log('✅ Live demo dataset pushed to cloud');
      } catch (e) {
        console.error('Cloud demo seed error:', e);
      }
    }

    return {
      permits: demo.permits.length,
      orders: demo.orders.length,
      customers: demo.customers.length,
      sms: demo.smsMessages.length,
      accounts: demo.financialAccounts.length,
      logs: demo.auditLogs.length,
    };
  }

  /**
   * الفحص الذاتي التلقائي لمساحة التخزين عند الإقلاع — يفرغ المخلفات ويقلص الصور الضخمة فوراً
   */
  static selfHealStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.DAILY_SCENARIO);
      localStorage.removeItem('rawdah_debug');

      // تنظيف فوري للحسابات والمخلفات التجريبية القديمة من ذاكرة أي جهاز يفتح النظام
      const rawProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (rawProfiles) {
        try {
          const parsed = JSON.parse(rawProfiles);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(p => !DataService.isLegacyDemoProfile(p));
            if (cleaned.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(cleaned));
            }
          }
        } catch { /* ignore */ }
      }

      const rawPermits = localStorage.getItem(STORAGE_KEYS.PERMITS);
      if (rawPermits && rawPermits.length > 400_000) {
        try {
          const parsed = JSON.parse(rawPermits);
          if (Array.isArray(parsed)) {
            const pruned = parsed.map((p, idx) => (idx >= 10 && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image') ? { ...p, imageUrl: '' } : p));
            localStorage.setItem(STORAGE_KEYS.PERMITS, JSON.stringify(pruned));
          }
        } catch {
          // ignore
        }
      }
      const rawLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (rawLogs && rawLogs.length > 100_000) {
        try {
          const parsed = JSON.parse(rawLogs);
          if (Array.isArray(parsed) && parsed.length > 10) {
            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(parsed.slice(0, 10)));
          }
        } catch {
          localStorage.removeItem(STORAGE_KEYS.LOGS);
        }
      }
    } catch {
      // ignore
    }
  }

  /** تصدير نسخة احتياطية شاملة للنظام بصيغة JSON قابلة للتنزيل */
  static exportFullBackup(): { filename: string; content: string } {
    const backupData = {
      system: 'rawdah-reservation-system',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: this.getCurrentUser().fullName,
      data: {
        customers: this.getCustomers(),
        orders: this.getOrders(),
        permits: this.getPermits(),
        financialAccounts: this.getFinancialAccounts(),
        smsMessages: this.getSmsMessages(),
        companySettings: this.getCompanySettings(),
        messageTemplates: this.getMessageTemplates(),
        auditLogs: this.getAuditLogs(),
      }
    };
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `rawdah-full-backup-${dateStr}.json`;
    return {
      filename,
      content: JSON.stringify(backupData, null, 2),
    };
  }

  /** استيراد نسخة احتياطية شاملة والتحقق منها وتطبيقها محلياً وسحابياً */
  static async importFullBackup(jsonString: string): Promise<{ success: boolean; message: string; counts?: Record<string, number> }> {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'super_admin') {
      return { success: false, message: 'عذراً، استيراد واسترجاع النسخ الاحتياطية مقتصر على المدير العام فقط.' };
    }

    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object' || !parsed.data) {
        return { success: false, message: 'الملف غير صالح، لا يحتوي على بنية النسخة الاحتياطية المعتمدة.' };
      }

      const { data } = parsed;
      const counts: Record<string, number> = {};

      if (Array.isArray(data.customers)) {
        saveToStorage(STORAGE_KEYS.CUSTOMERS, data.customers);
        counts['العملاء'] = data.customers.length;
      }
      if (Array.isArray(data.orders)) {
        saveToStorage(STORAGE_KEYS.ORDERS, data.orders);
        counts['الطلبات'] = data.orders.length;
      }
      if (Array.isArray(data.permits)) {
        saveToStorage(STORAGE_KEYS.PERMITS, data.permits);
        counts['التصاريح'] = data.permits.length;
      }
      if (Array.isArray(data.financialAccounts)) {
        saveToStorage(STORAGE_KEYS.ACCOUNTS, data.financialAccounts);
        counts['الحسابات المالية'] = data.financialAccounts.length;
      }
      if (Array.isArray(data.smsMessages)) {
        saveToStorage(STORAGE_KEYS.SMS, data.smsMessages);
        counts['رسائل SMS'] = data.smsMessages.length;
      }
      if (data.companySettings && typeof data.companySettings === 'object') {
        saveToStorage(STORAGE_KEYS.SETTINGS, data.companySettings);
      }
      if (data.messageTemplates && typeof data.messageTemplates === 'object') {
        saveToStorage(STORAGE_KEYS.TEMPLATES, data.messageTemplates);
      }

      this.addAuditLog(currentUser.id, currentUser.fullName, 'IMPORT_BACKUP', 'system', 'backup', {
        exportedAt: parsed.exportedAt,
        counts,
      });

      return {
        success: true,
        message: 'تم استرجاع النسخة الاحتياطية بنجاح وتحديث كافة السجلات!',
        counts,
      };
    } catch (err: any) {
      console.error('Import backup error:', err);
      return { success: false, message: `تعذر قراءة ملف النسخة الاحتياطية: ${err?.message || 'خطأ غير معروف'}` };
    }
  }
}
