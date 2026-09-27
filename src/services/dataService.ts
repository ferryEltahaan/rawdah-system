import {
  Permit,
  SalesOrder,
  Customer,
  SmsMessage,
  UserProfile,
  FinancialAccount,
  CompanySettings,
  AuditLog,
  AccountProvider,
  CurrencyCode
} from '../types';
import {
  initialCompanySettings,
  initialFinancialAccounts,
  initialProfiles,
  initialCustomers,
  generateInitialPermits,
  initialOrders,
  initialSmsMessages,
  initialAuditLogs
} from './mockData';
import { buildDemoDataset, buildDailyPaymentScenario, DailyScenarioTexts } from './demoData';
import { accountCurrency, currencySymbol, getOrderCurrency, providerCurrency } from '../utils/currency';
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
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Failed to load ${key} from storage:`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new Event('rawdah_storage_update'));
    return true;
  } catch (e) {
    console.error(`Failed to save ${key} to storage:`, e);
    const isQuotaError =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22);
    if (isQuotaError) {
      window.dispatchEvent(
        new CustomEvent('rawdah_storage_error', {
          detail: {
            key,
            message:
              'مساحة التخزين المحلية ممتلئة — لم يُحفظ آخر تغيير على هذا الجهاز. احذف بعض الصور أو البيانات القديمة ثم أعد المحاولة.',
          },
        })
      );
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
  if (t.includes('vf-') || t.includes('vodafone') || t.includes('فودافون')) return 'vodafone_cash';
  if (t.includes('orange') || t.includes('أورانج') || t.includes('اورنج')) return 'orange_cash';
  if (t.includes('etisalat') || t.includes('اتصالات')) return 'etisalat_cash';
  if (t.includes('instapay') || t.includes('انستاباي')) return 'instapay';
  if (t.includes('rajhi') || t.includes('راجحي')) return 'al_rajhi';
  if (t.includes('ahli') || t.includes('snb') || t.includes('الأهلي') || t.includes('الاهلي')) return 'al_ahli';
  if (t.includes('riyad') || t.includes('الرياض')) return 'riyad_bank';
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

// أعمدة العملة/الأرشفة قد لا تكون مضافة بعد في جدول sales_orders السحابي —
// نجرّب معها أولاً، وعند فشل الإدراج/التحديث نعيد المحاولة بدونها حتى لا يفشل الحفظ كلياً
const NEW_ORDER_COLUMNS = ['currency', 'is_archived', 'archived_at'];

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
      const profiles = loadFromStorage<UserProfile[]>(STORAGE_KEYS.PROFILES, initialProfiles);
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
      // 1. Sync Company Settings
      const { data: settings } = await sb.from('company_settings').select('*').limit(1);
      if (settings && settings.length > 0) {
        const s = settings[0];
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
        };
        saveToStorage(STORAGE_KEYS.SETTINGS, mapped);
      }

      // 2. Sync Customers
      const { data: custs } = await sb.from('customers').select('*').order('created_at', { ascending: false });
      if (custs !== null && custs !== undefined) {
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
        saveToStorage(STORAGE_KEYS.CUSTOMERS, mappedCusts);
      }

      // 3. Sync Permits
      const { data: permList } = await sb.from('permits').select('*').order('created_at', { ascending: false });
      if (permList !== null && permList !== undefined) {
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
          createdAt: p.created_at,
        }));
        saveToStorage(STORAGE_KEYS.PERMITS, mappedPermits);
      }

      // 4. Sync Orders
      const { data: orderList } = await sb.from('sales_orders').select('*').order('created_at', { ascending: false });
      if (orderList !== null && orderList !== undefined) {
        // جلب أسماء العملاء
        const customers = this.getCustomers();
        const custMap: Record<string, Customer> = {};
        customers.forEach(c => { custMap[c.id] = c; });

        // روابط التصاريح بالطلبات من جدول الوصل order_permits
        const linksByOrder: Record<string, string[]> = {};
        const { data: linkRows } = await sb.from('order_permits').select('order_id, permit_id');
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
            notes: o.notes,
            createdBy: o.created_by || '',
            assignedPermitIds: linksByOrder[o.id] || undefined,
            createdAt: o.created_at,
          };
        });
        saveToStorage(STORAGE_KEYS.ORDERS, mappedOrders);
      }

      // 5. Sync SMS Messages
      const { data: smsList } = await sb.from('sms_messages').select('*').order('received_at', { ascending: false }).limit(200);
      if (smsList !== null && smsList !== undefined) {
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
      const { data: profileList } = await sb.from('profiles').select('*').order('created_at', { ascending: true });
      if (profileList && profileList.length > 0) {
        const storedProfiles = loadFromStorage<UserProfile[]>(STORAGE_KEYS.PROFILES, initialProfiles);
        const localPasswords: Record<string, string> = {};
        storedProfiles.forEach(p => { localPasswords[p.id] = p.password; });

        const mappedProfiles: UserProfile[] = profileList.map(p => ({
          id: p.id,
          fullName: p.full_name,
          username: p.username || '',
          // كلمات المرور لا تُخزن أبداً في السحابة — نحافظ على المحلية
          password: localPasswords[p.id] || initialProfiles.find(d => d.username === p.username)?.password || '',
          phoneNumber: p.phone_number || '',
          whatsappNumber: p.whatsapp_number || '',
          role: p.role,
          isActive: p.is_active ?? true,
          avatarUrl: p.avatar_url || undefined,
          customPermissions: p.custom_permissions || { view: true, create: true, edit: true, delete: false, reports: false },
          createdAt: p.created_at,
        }));

        // الموظفون المحليون غير الموجودين سحابياً (بالمعرّف أو باسم المستخدم) يُدمجون ولا يُمسحون عند المزامنة
        const cloudIds = new Set(profileList.map(p => p.id));
        const cloudUsernames = new Set(
          profileList.map(p => (p.username || '').toLowerCase()).filter(Boolean)
        );
        const localOnlyProfiles = storedProfiles.filter(p =>
          !cloudIds.has(p.id) && !(p.username && cloudUsernames.has(p.username.toLowerCase()))
        );

        saveToStorage(STORAGE_KEYS.PROFILES, [...mappedProfiles, ...localOnlyProfiles]);
      }

      // رفع الموظفين المحليين غير الموجودين سحابياً — بعد إسقاط قيد auth.users أصبح الإدراج في الجدول ممكناً
      const cloudProfileIds = new Set((profileList || []).map(p => p.id));
      const cloudProfileUsernames = new Set(
        (profileList || []).map(p => (p.username || '').toLowerCase()).filter(Boolean)
      );
      const missingProfilesOnCloud = this.getProfiles().filter(p =>
        !cloudProfileIds.has(p.id) && !(p.username && cloudProfileUsernames.has(p.username.toLowerCase()))
      );
      let pushedProfilesCount = 0;
      for (const p of missingProfilesOnCloud) {
        try {
          const { error: pushError } = await sb.from('profiles').upsert({
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
          if (pushError) {
            console.error('Cloud profile push error:', pushError);
          } else {
            pushedProfilesCount += 1;
          }
        } catch (e) {
          console.error('Cloud profile push exception:', e);
        }
      }
      if (pushedProfilesCount > 0) {
        console.log(`⬆️ Pushed ${pushedProfilesCount} local profiles to cloud`);
      }

      // 7. Sync Financial Accounts
      const { data: accList } = await sb.from('financial_accounts').select('*').order('created_at', { ascending: true });
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
        saveToStorage(STORAGE_KEYS.ACCOUNTS, mappedAccounts);
      }

      // 8. Sync Audit Logs (آخر 500 سجل فقط — جدول السحابة لا يخزن اسم المستخدم، نسترجعه من الملفات)
      const { data: logList } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (logList !== null && logList !== undefined) {
        const nameMap: Record<string, string> = {};
        this.getProfiles().forEach(p => { nameMap[p.id] = p.fullName; });

        const mappedLogs: AuditLog[] = logList.map(l => {
          const { userName: detailsUserName, ...restDetails } = l.details || {};
          return {
            id: l.id,
            userId: l.user_id || '',
            userName: l.user_name || detailsUserName || nameMap[l.user_id] || '',
            actionType: l.action_type,
            entityName: l.entity_name,
            entityId: l.entity_id || '',
            details: restDetails,
            createdAt: l.created_at,
          };
        });

        // دمج اتحادي بدل الاستبدال: سجل أُنشئ لحظة تنفيذ المزامنة (أو لم تنجح مزامنته بعد) لا يُمسح محلياً
        const cloudIds = new Set(mappedLogs.map(l => l.id));
        const localOnlyLogs = this.getAuditLogs().filter(l => !cloudIds.has(l.id));
        const merged = [...localOnlyLogs, ...mappedLogs]
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 500);
        saveToStorage(STORAGE_KEYS.LOGS, merged);
      }

      console.log('✅ Supabase Cloud Data synchronized successfully!');
    } catch (e) {
      console.error('Failed to sync from cloud:', e);
    }
  }

  // --- Company Settings ---
  static getCompanySettings(): CompanySettings {
    return loadFromStorage(STORAGE_KEYS.SETTINGS, initialCompanySettings);
  }

  static async updateCompanySettings(settings: Partial<CompanySettings>): Promise<{ settings: CompanySettings; localSaved: boolean }> {
    const current = this.getCompanySettings();
    const updated = { ...current, ...settings };
    const localSaved = saveToStorage(STORAGE_KEYS.SETTINGS, updated);

    // Push to Supabase Cloud directly
    if (getIsConfigured() && getSupabase()) {
      const sb = getSupabase()!;
      try {
        // نستخدم id محدداً ثابتاً (row واحدة دائماً) — إذا لم يكن موجوداً يُنشأ تلقائياً
        const rowId = updated.id || '00000000-0000-0000-0000-000000000001';

        const { data, error } = await sb.from('company_settings').upsert({
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
        }, { onConflict: 'id' }).select();

        if (error) {
          // الحفظ المحلي تم بالفعل — نكتفي بتسجيل خطأ السحابة دون مقاطعة المستخدم
          console.error('Cloud update error in Supabase:', error);
        } else {
          console.log('✅ Company settings saved to Cloud:', data);
          // حدِّث الـ id المحلي بالـ id الفعلي من السحابة
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

  // --- Financial Accounts ---
  static getFinancialAccounts(): FinancialAccount[] {
    return loadFromStorage(STORAGE_KEYS.ACCOUNTS, []);
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

  static getProfiles(): UserProfile[] {
    const stored = loadFromStorage<UserProfile[]>(STORAGE_KEYS.PROFILES, initialProfiles);
    // دمج ترقيعي: الحسابات المحفوظة قبل إضافة كلمة المرور تستكملها من الافتراضية بنفس المستخدم
    return stored.map(p => {
      if (p.password) return p;
      const fallback = initialProfiles.find(d => d.id === p.id || d.username === p.username);
      return { ...p, password: fallback?.password || '' };
    });
  }

  static getCurrentUser(): UserProfile {
    return loadFromStorage(STORAGE_KEYS.CURRENT_USER, initialProfiles[0]);
  }

  static setCurrentUser(user: UserProfile): void {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
  }

  static async saveProfile(data: Omit<UserProfile, 'id' | 'createdAt'> & { id?: string }): Promise<{ profile: UserProfile; localSaved: boolean }> {
    const profiles = this.getProfiles();
    const id = data.id || generateUUID();
    const existing = profiles.find(p => p.id === id);

    const newProfile: UserProfile = {
      ...data,
      id,
      // عند التعديل بدون إدخال كلمة مرور جديدة نُبقي القديمة
      password: data.password || existing?.password || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    const idx = profiles.findIndex(p => p.id === id);
    if (idx >= 0) {
      profiles[idx] = newProfile;
    } else {
      profiles.push(newProfile);
    }
    const localSaved = saveToStorage(STORAGE_KEYS.PROFILES, profiles);

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
    const target = profiles.find(p => p.id === id);
    if (!target) return { localSaved: true, notFound: true, cloudFailed: false };

    const localSaved = saveToStorage(STORAGE_KEYS.PROFILES, profiles.filter(p => p.id !== id));
    if (!localSaved) return { localSaved: false, notFound: false, cloudFailed: false };

    let cloudFailed = false;
    if (getIsConfigured() && getSupabase()) {
      // جدول profiles السحابي مفتاحه UUID ومرتبط بـ auth.users، فالموظفون المحليون (معرّفاتهم نصية) لا وجود لهم فيه
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { error } = await getSupabase()!.from('profiles').delete().eq('id', id);
          if (error) {
            cloudFailed = true;
            console.error('Cloud profile delete error:', error);
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

    if (!stored || !stored.password || stored.password !== currentPassword) {
      return { success: false, error: 'wrong_current' };
    }

    const { profile, localSaved } = await this.saveProfile({ ...stored, password: newPassword });
    if (!localSaved) return { success: false, error: 'local_save_failed' };

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
    return loadFromStorage(STORAGE_KEYS.CUSTOMERS, []);
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
            // assigned_by_user_id مرجع UUID إلى profiles(auth) — معرّف المستخدم المحلي ليس UUID صالحاً
            assigned_by_user_id: null,
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

    // ربط التصريح بالطلب إن اختير — محلياً في الطلب، وسحابياً في جدول الوصل order_permits
    let linkedOrderNumber: number | undefined;
    let orderAutoConfirmed = false;
    if (orderId) {
      const orders = this.getOrders();
      const orderIndex = orders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        linkedOrderNumber = orders[orderIndex].orderNumber;
        const linkedIds = orders[orderIndex].assignedPermitIds || [];
        // تخصيص تصريح للعميل = تأكيد الطلب تلقائياً (ما لم يكن ملغياً)
        orderAutoConfirmed =
          orders[orderIndex].orderStatus !== 'confirmed' && orders[orderIndex].orderStatus !== 'cancelled';
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
            .insert({ order_id: orderId, permit_id: permitId });
          if (linkError) console.error('Cloud order permit link error:', linkError);
          if (orderAutoConfirmed) {
            await getSupabase()!.from('sales_orders').update({ order_status: 'confirmed' }).eq('id', orderId);
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

  static async createOrder(orderData: Omit<SalesOrder, 'id' | 'orderNumber' | 'remainingAmount' | 'createdAt'>): Promise<SalesOrder> {
    const currentUser = this.getCurrentUser();
    const orders = this.getOrders();
    const nextOrderNumber = orders.length > 0 ? Math.max(...orders.map(o => o.orderNumber)) + 1 : 1001;

    const newOrder: SalesOrder = {
      ...orderData,
      id: generateUUID(),
      orderNumber: nextOrderNumber,
      remainingAmount: orderData.totalAmount - orderData.paidAmount,
      createdAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    // البيع يتم احتسابه هنا (الطلب) لا عند سحب التصريح — بمبلغ الطلب الفعلي
    this.updateCustomerOrderStats(newOrder.customerId, 1, newOrder.totalAmount);

    // Push order to Cloud
    await cloudInsertOrderResilient({
      id: newOrder.id,
      // order_number هو BIGSERIAL — يُولَّد تلقائياً في Supabase
      customer_id: newOrder.customerId,
      customer_name: newOrder.customerName,
      customer_whatsapp: newOrder.customerWhatsapp,
      permits_count: newOrder.permitsCount,
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

  static updateOrderStatus(orderId: string, status: SalesOrder['orderStatus']): void {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.orderStatus = status;
      saveToStorage(STORAGE_KEYS.ORDERS, orders);
      this.addAuditLog(this.getCurrentUser().id, this.getCurrentUser().fullName, 'UPDATE_ORDER', 'sales_orders', orderId, { status });
      // Cloud update
      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.from('sales_orders').update({ order_status: status }).eq('id', orderId).then(({ error }) => {
          if (error) console.error('Cloud updateOrderStatus error:', error);
        });
      }
    }
  }

  static updateDeliveryStatus(orderId: string, deliveryStatus: SalesOrder['deliveryStatus']): void {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.deliveryStatus = deliveryStatus;
      saveToStorage(STORAGE_KEYS.ORDERS, orders);
      this.addAuditLog(this.getCurrentUser().id, this.getCurrentUser().fullName, 'UPDATE_ORDER', 'sales_orders', orderId, { deliveryStatus });
      // Cloud update
      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.from('sales_orders').update({ delivery_status: deliveryStatus }).eq('id', orderId).then(({ error }) => {
          if (error) console.error('Cloud updateDeliveryStatus error:', error);
        });
      }
    }
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

    const amountRegex = /(?:مبلغ|استلام|تحويل|بمبلغ|قيمة|amount|received)\s*[:]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
    const matchAmount = rawBody.match(amountRegex);
    if (matchAmount && matchAmount[1]) {
      parsedAmount = parseFloat(matchAmount[1]);
    } else {
      const anyNum = rawBody.match(/([0-9]{2,6}(?:\.[0-9]{1,2})?)/);
      if (anyNum) parsedAmount = parseFloat(anyNum[1]);
    }

    const refRegex = /(?:رقم العملية|مرجع|المرجع|العملية|ref|reference|txn|id)\s*[:]?\s*([A-Za-z0-9_-]{5,20})/i;
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

    sms.status = 'matched';
    sms.matchedOrderId = orderId;
    sms.matchedOrderNumber = order.orderNumber;
    sms.matchedByUserId = currentUser.id;
    sms.matchedAt = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.SMS, messages);

    order.paidAmount += sms.parsedAmount || 0;
    order.remainingAmount = Math.max(0, order.totalAmount - order.paidAmount);
    if (order.paidAmount >= order.totalAmount) {
      order.orderStatus = 'confirmed';
    }
    saveToStorage(STORAGE_KEYS.ORDERS, orders);

    const accounts = this.getFinancialAccounts();
    const orderCurrency = getOrderCurrency(order);
    // نفضّل الخزنة المطابقة لنفس العملة، وكل عملة لها خزنتها
    const account =
      accounts.find(a => a.provider === sms.parsedProvider && accountCurrency(a) === orderCurrency) ||
      accounts.find(a => a.provider === sms.parsedProvider);
    let currencyWarning = '';
    if (account) {
      if (accountCurrency(account) !== orderCurrency) {
        currencyWarning = ` — تنبيه: عملة الخزنة (${currencySymbol(accountCurrency(account))}) تخالف عملة الطلب (${currencySymbol(orderCurrency)})`;
      }
      account.currentBalance += sms.parsedAmount || 0;
      saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);

      // Push updated balance to cloud
      if (getIsConfigured() && getSupabase()) {
        getSupabase()!.from('financial_accounts').update({
          current_balance: account.currentBalance,
        }).eq('id', account.id).then(({ error }) => {
          if (error) console.error('Cloud account balance update error:', error);
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
          details: { ...details, userName },
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
    saveToStorage(STORAGE_KEYS.PROFILES, initialProfiles);
    saveToStorage(STORAGE_KEYS.CUSTOMERS, initialCustomers);
    saveToStorage(STORAGE_KEYS.PERMITS, generateInitialPermits());
    saveToStorage(STORAGE_KEYS.ORDERS, initialOrders);
    saveToStorage(STORAGE_KEYS.SMS, initialSmsMessages);
    saveToStorage(STORAGE_KEYS.LOGS, initialAuditLogs);
    saveToStorage(STORAGE_KEYS.CURRENT_USER, initialProfiles[0]);
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
}
