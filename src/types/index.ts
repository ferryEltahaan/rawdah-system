// ==============================================================================
// Types for Rawdah Reservation System
// ==============================================================================

export type UserRole = 'super_admin' | 'sales' | 'inventory' | 'accountant';

export interface CustomPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  reports: boolean;
}

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  password: string;
  phoneNumber: string;
  whatsappNumber: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  customPermissions: CustomPermissions;
  createdAt: string;
}

export type CurrencyCode = 'SAR' | 'EGP';

export type AccountType = 'wallet' | 'bank';
export type AccountProvider = 
  | 'vodafone_cash' 
  | 'orange_cash' 
  | 'etisalat_cash' 
  | 'instapay' 
  | 'al_rajhi' 
  | 'al_ahli' 
  | 'riyad_bank' 
  | 'other';

export interface FinancialAccount {
  id: string;
  type: AccountType;
  provider: AccountProvider;
  accountName: string;
  accountNumber: string;
  accountHolderName?: string;
  iban?: string;
  branchName?: string;
  currentBalance: number;
  isActive: boolean;
  currency?: CurrencyCode; // عملة الحساب — تُستنتج من المزود إن لم تُحدد
  notes?: string;
  createdAt: string;
}

export interface CompanySettings {
  id: string;
  companyNameAr: string;
  companyNameEn: string;
  address: string;
  primaryPhone: string;
  secondaryPhone?: string;
  whatsappNumber: string;
  email: string;
  logoUrl?: string;
  taxNumber?: string;
  commercialRegistry?: string;
  invoiceFooterNote: string;
  currency: string;
}

export interface Customer {
  id: string;
  fullName: string;
  whatsappNumber: string;
  additionalPhone?: string;
  nickname?: string; // اسم الحساب أو النيك نيم في الواتساب
  notes?: string;
  totalOrdersCount: number;
  totalSpent: number;
  createdAt: string;
}

export type PermitStatus = 'available' | 'locked' | 'assigned' | 'returned' | 'cancelled';

export interface Permit {
  id: string;
  permitCode: string;
  slotDate: string; // YYYY-MM-DD
  slotHour: number; // 0..23
  slotMinute: number; // 0, 20, 40
  slotFormatted: string; // e.g. "00:20", "14:40"
  imageUrl: string;
  status: PermitStatus;
  assignedToCustomerId?: string;
  assignedCustomerName?: string;
  assignedByUserId?: string;
  assignedByUserName?: string;
  assignedAt?: string;
  lockedByUserId?: string;
  lockedAt?: string;
  notes?: string;
  createdAt: string;
}

export type OrderType = 'instant' | 'scheduled'; // فوري / حجز موعد
export type OrderStatus = 'confirmed' | 'searching' | 'unconfirmed' | 'cancelled'; // مؤكد / جاري البحث / غير مؤكد / ملغي
export type DeliveryStatus = 'sent' | 'waiting' | 'not_sent'; // تم إرساله / انتظار / لم يتم الإرسال

export interface SalesOrder {
  id: string;
  orderNumber: number;
  customerId: string;
  customerName: string;
  customerWhatsapp: string;
  permitsCount: number;
  targetDate: string;
  targetTime: string; // e.g. "14:20"
  orderType: OrderType;
  orderStatus: OrderStatus;
  deliveryStatus: DeliveryStatus;
  unitPrice: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency?: CurrencyCode; // عملة الطلب — الافتراضي ر.س عند الغياب
  isArchived?: boolean; // أرشفة تلقائية عند اكتمال السداد وانقضاء الموعد
  archivedAt?: string;
  assignedPermitIds?: string[];
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export type SmsStatus = 'unmatched' | 'matched' | 'ignored';

export interface SmsMessage {
  id: string;
  sender: string;
  rawBody: string;
  parsedAmount?: number;
  parsedReferenceId?: string;
  parsedAccountNumber?: string;
  parsedProvider?: AccountProvider;
  status: SmsStatus;
  matchedOrderId?: string;
  matchedOrderNumber?: number;
  matchedByUserId?: string;
  matchedAt?: string;
  receivedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  actionType: 'CLAIM_PERMIT' | 'RETURN_PERMIT' | 'MATCH_SMS' | 'CREATE_ORDER' | 'UPDATE_ORDER' | 'UPLOAD_PERMITS' | 'DELETE_PERMIT' | 'DELETE_PROFILE' | 'UPDATE_PERMISSIONS' | 'ARCHIVE_ORDER' | 'UPDATE_CUSTOMER' | 'UPDATE_PROFILE' | 'TOGGLE_EMPLOYEE_STATUS';
  entityName: string;
  entityId: string;
  details: Record<string, any>;
  createdAt: string;
}
