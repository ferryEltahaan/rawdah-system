import {
  CompanySettings,
  FinancialAccount,
  Customer,
  Permit,
  SalesOrder,
  SmsMessage,
  AuditLog
} from '../types';

export const initialCompanySettings: CompanySettings = {
  id: 'comp-1',
  companyNameAr: 'مؤسسة حجز تصاريح الروضة الشريفة',
  companyNameEn: 'Rawdah Permits Enterprise',
  address: 'المدينة المنورة - المنطقة المركزية',
  primaryPhone: '+966500000000',
  secondaryPhone: '',
  whatsappNumber: '+966500000000',
  email: 'info@rawdah-system.com',
  logoUrl: '',
  taxNumber: '',
  commercialRegistry: '',
  invoiceFooterNote: 'تقبل الله زيارتكم وطاعتكم ونسألكم صالح الدعاء في الروضة الشريفة',
  currency: 'SAR',
};

export const initialFinancialAccounts: FinancialAccount[] = [
  {
    id: 'acc-1',
    type: 'wallet',
    provider: 'vodafone_cash',
    accountName: 'فودافون كاش',
    accountNumber: '01000000000',
    accountHolderName: 'محفظة الحجوزات',
    currentBalance: 0.00,
    isActive: true,
    notes: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-2',
    type: 'wallet',
    provider: 'instapay',
    accountName: 'إنستاباي InstaPay',
    accountNumber: 'rawdah@instapay',
    accountHolderName: '',
    currentBalance: 0.00,
    isActive: true,
    notes: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-3',
    type: 'bank',
    provider: 'al_rajhi',
    accountName: 'مصرف الراجحي',
    accountNumber: '482000000000000',
    accountHolderName: 'مؤسسة حجز التصاريح',
    iban: '',
    currentBalance: 0.00,
    isActive: true,
    notes: '',
    createdAt: new Date().toISOString(),
  }
];

// لا توجد حسابات افتراضية داخل حزمة الكود.
// كل موظف (ومستخدم Auth الخاص به) يُنشئه المدير من لوحة Supabase — الخطوات في
// database/schema.sql القسم 10. وجود أي بيانات موظفين هنا يعني شحن بصمات أو
// معرّفات قابلة للاستخراج من الحزمة العامة، فتُجلب القائمة من السحابة فقط.

// Completely empty initial lists
export const initialCustomers: Customer[] = [];

export const generateInitialPermits = (): Permit[] => {
  return [];
};

export const initialOrders: SalesOrder[] = [];

export const initialSmsMessages: SmsMessage[] = [];

export const initialAuditLogs: AuditLog[] = [];
