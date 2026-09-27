import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab, NAV_TAB_LABELS, getVisibleNavTabs } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { ToastProvider, useToast } from './components/Toast';
import { DataService } from './services/dataService';
import { UserProfile, UserRole } from './types';

// تحميل كسول لكل واجهات التبويبات — تقليل حجم الحزمة الأولية ورفع سرعة الإقلاع
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const PermitsInventory = React.lazy(() => import('./components/PermitsInventory').then(m => ({ default: m.PermitsInventory })));
const OrdersManagement = React.lazy(() => import('./components/OrdersManagement').then(m => ({ default: m.OrdersManagement })));
const CustomersCRM = React.lazy(() => import('./components/CustomersCRM').then(m => ({ default: m.CustomersCRM })));
const SmsInbox = React.lazy(() => import('./components/SmsInbox').then(m => ({ default: m.SmsInbox })));
const FinancialAccountsView = React.lazy(() => import('./components/FinancialAccountsView').then(m => ({ default: m.FinancialAccountsView })));
const EmployeesAndRolesView = React.lazy(() => import('./components/EmployeesAndRolesView').then(m => ({ default: m.EmployeesAndRolesView })));
const CompanySettingsView = React.lazy(() => import('./components/CompanySettingsView').then(m => ({ default: m.CompanySettingsView })));
const AuditLogViewer = React.lazy(() => import('./components/AuditLogViewer').then(m => ({ default: m.AuditLogViewer })));

const TabLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    <span className="text-xs font-bold">جاري تحميل الواجهة...</span>
  </div>
);

const SESSION_KEY = 'rawdah_session_logged_in';

const ROLE_PREFERRED_TAB: Record<UserRole, NavTab> = {
  super_admin: 'dashboard',
  sales: 'orders',
  inventory: 'permits',
  accountant: 'sms',
};

const resolveInitialTab = (user: UserProfile, allowedTabs: NavTab[]): NavTab => {
  const preferred = ROLE_PREFERRED_TAB[user.role];
  if (allowedTabs.length === 0) return preferred;
  return allowedTabs.includes(preferred) ? preferred : allowedTabs[0];
};

const AppContent: React.FC = () => {
  const toast = useToast();
  // ✅ استعادة الجلسة من localStorage عند كل تحميل — مع رفض الحسابات الموقوفة أو المحذوفة
  const savedUser = DataService.getCurrentUser();
  const freshUser = savedUser
    ? DataService.getProfiles().find(p => p.id === savedUser.id)
    : undefined;
  const hadStoredSession = localStorage.getItem(SESSION_KEY) === 'true';
  const initialUser = hadStoredSession && freshUser?.isActive ? freshUser : null;
  // جلسة محفوظة لحساب موقوف/محذوف: تُمسح نهائياً فلا تعود للعمل حتى بإعادة التفعيل
  if (hadStoredSession && !initialUser) localStorage.removeItem(SESSION_KEY);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(Boolean(initialUser));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(initialUser);
  const [activeTab, setActiveTab] = useState<NavTab>(() =>
    initialUser
      ? resolveInitialTab(initialUser, getVisibleNavTabs(initialUser.role, initialUser.customPermissions))
      : 'dashboard'
  );
  const [unmatchedSmsCount, setUnmatchedSmsCount] = useState<number>(0);
  const [availablePermitsCount, setAvailablePermitsCount] = useState<number>(0);

  const allowedTabs = useMemo<NavTab[]>(
    () => (currentUser ? getVisibleNavTabs(currentUser.role, currentUser.customPermissions) : []),
    [currentUser]
  );
  const allowedTabsKey = allowedTabs.join(',');

  // الشاشة المعروضة فعلياً تُحسم أثناء الرندر — لا تظهر شاشة ممنوعة ولا للحظة واحدة
  const effectiveTab: NavTab | null =
    allowedTabs.length === 0 ? null : allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];

  const updateCounts = () => {
    const sms = DataService.getSmsMessages();
    setUnmatchedSmsCount(sms.filter(s => s.status === 'unmatched').length);

    const permits = DataService.getPermits();
    setAvailablePermitsCount(permits.filter(p => p.status === 'available').length);
  };

  useEffect(() => {
    // Initial Cloud Sync — يُزامن البيانات من Supabase عند بدء التشغيل
    DataService.syncFromCloud().then(() => {
      updateCounts();
    });

    updateCounts();

    const handleStorageUpdate = () => {
      updateCounts();
      // عند تغيّر البيانات (محلياً أو من مزامنة سحابية) يُعاد جلب الموظف الحالي من قائمة الموظفين (المصدر الموثوق)
      if (isLoggedIn) {
        const snapshot = DataService.getCurrentUser();
        if (!snapshot) return;
        const current = DataService.getProfiles().find(p => p.id === snapshot.id);
        // إيقاف الحساب أثناء الجلسة (من جهاز آخر عبر المزامنة) ينهي الجلسة فوراً
        if (current && !current.isActive) {
          localStorage.removeItem(SESSION_KEY);
          setCurrentUser(null);
          setIsLoggedIn(false);
          toast.error(`تم إيقاف حساب «${current.fullName}» من قبل الإدارة — تم تسجيل خروجك تلقائياً.`);
          return;
        }
        setCurrentUser(current ?? snapshot);
      }
    };

    window.addEventListener('rawdah_storage_update', handleStorageUpdate);
    // عند تحديث إعدادات السحابة يُعاد التزامن كاملاً
    const handleCloudUpdate = () => {
      DataService.syncFromCloud().then(() => updateCounts());
    };
    window.addEventListener('rawdah_cloud_updated', handleCloudUpdate);

    return () => {
      window.removeEventListener('rawdah_storage_update', handleStorageUpdate);
      window.removeEventListener('rawdah_cloud_updated', handleCloudUpdate);
    };
  }, [isLoggedIn]);

  // عند تغيّر صلاحيات المستخدم أثناء جلسته: إن لم تعد شاشته الحالية متاحة يُنقل لأول شاشة مسموحة مع تنبيه
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    if (allowedTabs.length === 0 || allowedTabs.includes(activeTab)) return;
    setActiveTab(allowedTabs[0]);
    toast.warning(`تم تحويلك إلى «${NAV_TAB_LABELS[allowedTabs[0]]}» — صلاحية الشاشة السابقة لم تعد متاحة لحسابك.`);
  }, [allowedTabsKey, isLoggedIn, currentUser]);

  const handleLoginSuccess = (user: UserProfile) => {
    DataService.setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, 'true'); // ✅ حفظ الجلسة
    setCurrentUser(user);
    setIsLoggedIn(true);
    const tabs = getVisibleNavTabs(user.role, user.customPermissions);
    const resolved = resolveInitialTab(user, tabs);
    setActiveTab(resolved);
    if (tabs.length > 0 && resolved !== ROLE_PREFERRED_TAB[user.role]) {
      toast.info(`تم فتح «${NAV_TAB_LABELS[resolved]}» — شاشة دورك الافتراضية غير متاحة بصلاحياتك الحالية.`);
    }
    updateCounts();
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY); // ✅ مسح الجلسة
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  // بوابة التنقل الموحّدة: كل محاولة لفتح شاشة غير مسموحة تُرفض مع تنبيه واضح
  const handleNavigate = (tab: NavTab) => {
    if (allowedTabs.includes(tab)) {
      setActiveTab(tab);
      return;
    }
    toast.warning(`لا تملك صلاحية الوصول إلى «${NAV_TAB_LABELS[tab]}» — تواصل مع المدير العام.`);
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  if (!isLoggedIn || !currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-cairo pb-16 md:pb-0" dir="rtl">
      
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        unmatchedSmsCount={unmatchedSmsCount}
        onNavigateToSms={() => handleNavigate('sms')}
        onProfileUpdated={(user) => setCurrentUser(user)}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        <Sidebar
          activeTab={effectiveTab ?? activeTab}
          onSelectTab={setActiveTab}
          unmatchedSmsCount={unmatchedSmsCount}
          availablePermitsCount={availablePermitsCount}
          userRole={currentUser.role}
          userPermissions={currentUser.customPermissions}
          onLogout={handleLogout}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-60px)] md:max-h-[calc(100vh-65px)]">
          <div className="max-w-7xl mx-auto">
            {effectiveTab === null ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <ShieldAlert className="w-7 h-7 text-rose-500" />
                </div>
                <h2 className="text-sm font-black text-slate-800">لا توجد شاشات متاحة لحسابك حالياً</h2>
                <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                  صلاحياتك الحالية لا تسمح بالوصول إلى أي شاشة في النظام. تواصل مع المدير العام لمنحك صلاحية «عرض» أو «التقارير»، ثم أعد تسجيل الدخول.
                </p>
              </div>
            ) : (
              <Suspense fallback={<TabLoadingFallback />}>
                {effectiveTab === 'dashboard' && (
                  <Dashboard 
                    currentUser={currentUser} 
                    onNavigate={handleNavigate} 
                  />
                )}

                {effectiveTab === 'permits' && (
                  <PermitsInventory 
                    currentUser={currentUser} 
                  />
                )}

                {effectiveTab === 'orders' && (
                  <OrdersManagement 
                    currentUser={currentUser}
                    onNavigateToPermits={() => handleNavigate('permits')}
                    onNavigateToSms={() => handleNavigate('sms')}
                  />
                )}

                {effectiveTab === 'customers' && (
                  <CustomersCRM 
                    currentUser={currentUser} 
                  />
                )}

                {effectiveTab === 'sms' && (
                  <SmsInbox 
                    currentUser={currentUser}
                    onNavigateToOrders={() => handleNavigate('orders')}
                  />
                )}

                {effectiveTab === 'accounts' && (
                  <FinancialAccountsView />
                )}

                {effectiveTab === 'employees' && (
                  <EmployeesAndRolesView />
                )}

                {effectiveTab === 'settings' && (
                  <CompanySettingsView />
                )}

                {effectiveTab === 'audit' && (
                  <AuditLogViewer />
                )}
              </Suspense>
            )}
          </div>
        </main>

      </div>

      {/* Mobile Bottom Navigation Bar (1-touch mobile accessibility) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {allowedTabs.includes('dashboard') && (
          <button
            onClick={() => handleNavigate('dashboard')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
              effectiveTab === 'dashboard' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-base">📊</span>
            <span className="text-[10px]">الرئيسية</span>
          </button>
        )}

        {allowedTabs.includes('permits') && (
          <button
            onClick={() => handleNavigate('permits')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
              effectiveTab === 'permits' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-base">🎟️</span>
            <span className="text-[10px]">الفترات</span>
          </button>
        )}

        {allowedTabs.includes('orders') && (
          <button
            onClick={() => handleNavigate('orders')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
              effectiveTab === 'orders' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-base">🛍️</span>
            <span className="text-[10px]">الطلبات</span>
          </button>
        )}

        {allowedTabs.includes('sms') && (
          <button
            onClick={() => handleNavigate('sms')}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors relative ${
              effectiveTab === 'sms' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-base">💬</span>
            <span className="text-[10px]">الرسائل</span>
            {unmatchedSmsCount > 0 && (
              <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-amber-500"></span>
            )}
          </button>
        )}

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span className="text-base">☰</span>
          <span className="text-[10px]">المزيد</span>
        </button>
      </nav>

    </div>
  );
};

export const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
