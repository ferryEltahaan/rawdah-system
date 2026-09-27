import { 
  CompanySettings, 
  FinancialAccount, 
  UserProfile, 
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

// الموظفون الفعليون في النظام (نفس المعرّفات UUID الموجودة في السحابة)
// كلمات المرور هنا هي مصدر الاسترجاع الوحيد لأن جدول profiles لا يخزنها
export const initialProfiles: UserProfile[] = [
  {
    id: 'fe292e3d-9509-43d6-9561-aba950cb8540',
    fullName: 'المدير العام',
    username: 'admin',
    password: 'admin123',
    phoneNumber: '+966500000001',
    whatsappNumber: '+966500000001',
    role: 'super_admin',
    isActive: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    customPermissions: { view: true, create: true, edit: true, delete: true, reports: true },
    createdAt: '2026-09-26T23:48:31.774341+00:00',
  },
  {
    id: 'e48d53af-a5ae-49b2-a5ef-e91307ed02db',
    fullName: 'موظف المبيعات',
    username: 'sales',
    password: 'sales123',
    phoneNumber: '+966500000002',
    whatsappNumber: '+966500000002',
    role: 'sales',
    isActive: true,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    customPermissions: { view: true, create: true, edit: true, delete: false, reports: false },
    createdAt: '2026-09-26T23:50:00.000000+00:00',
  },
  {
    id: 'e3d8cda3-8752-41ef-aaf2-a5694549088c',
    fullName: 'مسؤول المخزون والتصاريح',
    username: 'inventory',
    password: 'inventory123',
    phoneNumber: '+966500000003',
    whatsappNumber: '+966500000003',
    role: 'inventory',
    isActive: true,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
    customPermissions: { view: true, create: true, edit: true, delete: false, reports: false },
    createdAt: '2026-09-26T23:52:00.000000+00:00',
  },
  {
    id: 'e3faa12e-0e95-4b05-bbd3-6ed8993d7ebc',
    fullName: 'المحاسب المالي',
    username: 'accountant',
    password: 'acc123',
    phoneNumber: '+966500000004',
    whatsappNumber: '+966500000004',
    role: 'accountant',
    isActive: true,
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    customPermissions: { view: true, create: true, edit: true, delete: false, reports: true },
    createdAt: '2026-09-26T23:54:00.000000+00:00',
  },
  {
    id: '2af77703-0fb8-4ed4-bd5c-98e4142baa4b',
    fullName: 'سارة المطيري',
    username: 'sara',
    password: 'sara123',
    phoneNumber: '+966500000005',
    whatsappNumber: '+966500000005',
    role: 'sales',
    isActive: true,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    customPermissions: { view: true, create: true, edit: true, delete: false, reports: true },
    createdAt: '2026-09-26T23:56:00.000000+00:00',
  }
];

// Completely empty initial lists
export const initialCustomers: Customer[] = [];

export const generateInitialPermits = (): Permit[] => {
  return [];
};

export const initialOrders: SalesOrder[] = [];

export const initialSmsMessages: SmsMessage[] = [];

export const initialAuditLogs: AuditLog[] = [];
