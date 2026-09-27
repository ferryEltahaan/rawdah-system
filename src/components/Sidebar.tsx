import React from 'react';
import { 
  LayoutDashboard, 
  Ticket, 
  ShoppingBag, 
  Users, 
  MessageSquareCode, 
  WalletCards, 
  Building, 
  UserCog, 
  History,
  LogOut,
  ShieldAlert
} from 'lucide-react';
import { UserRole, CustomPermissions } from '../types';

export type NavTab = 
  | 'dashboard' 
  | 'permits' 
  | 'orders' 
  | 'customers' 
  | 'sms' 
  | 'accounts' 
  | 'settings' 
  | 'employees' 
  | 'audit';

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  requiredPermission: keyof CustomPermissions;
  allowedRoles: UserRole[];
}

export const NAV_TAB_LABELS: Record<NavTab, string> = {
  dashboard: 'لوحة المؤشرات العامة',
  permits: 'مخزون الفترات (24 ساعة)',
  orders: 'طلبات البيع والحجوزات',
  customers: 'العملاء وحسابات الواتساب',
  sms: 'رسائل الـ SMS والسداد',
  accounts: 'المحافظ والحسابات البنكية',
  employees: 'فريق العمل والصلاحيات',
  settings: 'إعدادات وبيانات المؤسسة',
  audit: 'سجل العمليات والتدقيق',
};

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: NAV_TAB_LABELS.dashboard,
    icon: <LayoutDashboard className="w-5 h-5" />,
    requiredPermission: 'view',
    allowedRoles: ['super_admin', 'sales', 'inventory', 'accountant'],
  },
  {
    id: 'permits',
    label: NAV_TAB_LABELS.permits,
    icon: <Ticket className="w-5 h-5" />,
    requiredPermission: 'view',
    allowedRoles: ['super_admin', 'sales', 'inventory'],
  },
  {
    id: 'orders',
    label: NAV_TAB_LABELS.orders,
    icon: <ShoppingBag className="w-5 h-5" />,
    requiredPermission: 'view',
    allowedRoles: ['super_admin', 'sales', 'accountant'],
  },
  {
    id: 'customers',
    label: NAV_TAB_LABELS.customers,
    icon: <Users className="w-5 h-5" />,
    requiredPermission: 'view',
    allowedRoles: ['super_admin', 'sales'],
  },
  {
    id: 'sms',
    label: NAV_TAB_LABELS.sms,
    icon: <MessageSquareCode className="w-5 h-5" />,
    requiredPermission: 'view',
    allowedRoles: ['super_admin', 'accountant'],
  },
  {
    id: 'accounts',
    label: NAV_TAB_LABELS.accounts,
    icon: <WalletCards className="w-5 h-5" />,
    requiredPermission: 'reports',
    allowedRoles: ['super_admin', 'accountant'],
  },
  {
    id: 'employees',
    label: NAV_TAB_LABELS.employees,
    icon: <UserCog className="w-5 h-5" />,
    requiredPermission: 'view',
    allowedRoles: ['super_admin'],
  },
  {
    id: 'settings',
    label: NAV_TAB_LABELS.settings,
    icon: <Building className="w-5 h-5" />,
    requiredPermission: 'view',
    allowedRoles: ['super_admin'],
  },
  {
    id: 'audit',
    label: NAV_TAB_LABELS.audit,
    icon: <History className="w-5 h-5" />,
    requiredPermission: 'reports',
    allowedRoles: ['super_admin', 'accountant'],
  },
];

export const canAccessTab = (tab: NavTab, role: UserRole, permissions: CustomPermissions): boolean => {
  const item = NAV_ITEMS.find(i => i.id === tab);
  if (!item) return false;
  if (!item.allowedRoles.includes(role)) return false;
  return role === 'super_admin' || Boolean(permissions[item.requiredPermission]);
};

export const getVisibleNavTabs = (role: UserRole, permissions: CustomPermissions): NavTab[] =>
  NAV_ITEMS.filter(item => canAccessTab(item.id, role, permissions)).map(item => item.id);

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unmatchedSmsCount: number;
  availablePermitsCount: number;
  userRole: UserRole;
  userPermissions: CustomPermissions;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  unmatchedSmsCount,
  availablePermitsCount,
  userRole,
  userPermissions,
  onLogout,
  isMobileOpen = false,
  onCloseMobile
}) => {
  // يظهر فقط ما يجتاز بوابة الدور + صلاحياته المخصصة (المدير العام بصلاحيات كاملة دائماً)
  const visibleItems = NAV_ITEMS.filter(item => canAccessTab(item.id, userRole, userPermissions));

  const getBadge = (item: NavItem): { text: string | number; className: string } | null => {
    if (item.id === 'permits' && availablePermitsCount > 0) {
      return {
        text: `${availablePermitsCount} متاح`,
        className: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
      };
    }
    if (item.id === 'sms' && unmatchedSmsCount > 0) {
      return { text: unmatchedSmsCount, className: 'bg-amber-500 text-white font-bold' };
    }
    return null;
  };

  const handleSelect = (id: NavTab) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const menuContent = (
    <div className="flex flex-col justify-between h-full space-y-4">
      <div className="space-y-1.5">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>شاشات الصلاحية</span>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {visibleItems.length} مفعّلة
          </span>
        </div>

        {visibleItems.length === 0 && (
          <div className="mx-1 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-1.5">
            <ShieldAlert className="w-5 h-5 text-rose-500 mx-auto" />
            <p className="text-[11px] font-bold text-rose-800 leading-relaxed">
              صلاحياتك الحالية لا تسمح بعرض أي شاشة. تواصل مع المدير العام لمنحك صلاحية «عرض» أو «التقارير».
            </p>
          </div>
        )}

        {visibleItems.map(item => {
          const isActive = activeTab === item.id;
          const badge = getBadge(item);
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/25'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600'} transition-colors`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.className}`}>
                  {badge.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Logout Button */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible md and up) */}
      <aside className="hidden md:flex w-64 bg-white border-l border-slate-200/80 p-4 flex-col justify-between shrink-0 min-h-[calc(100vh-65px)] shadow-sm">
        {menuContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm md:hidden animate-in fade-in"
          onClick={onCloseMobile}
        >
          <div 
            className="fixed top-0 right-0 bottom-0 w-72 bg-white p-5 shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right-full duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800">قائمة النظام</span>
              <button 
                onClick={onCloseMobile}
                className="p-1 text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            {menuContent}
          </div>
        </div>
      )}
    </>
  );
};
