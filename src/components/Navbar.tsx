import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Clock, 
  Bell, 
  Cloud,
  LogOut,
  Menu,
  Pencil,
  X
} from 'lucide-react';
import { UserProfile, CompanySettings } from '../types';
import { isSupabaseConfigured } from '../services/supabase';
import { DataService } from '../services/dataService';
import { CloudSetupModal } from './CloudSetupModal';
import { MyProfileModal } from './MyProfileModal';

interface NavbarProps {
  currentUser: UserProfile;
  onLogout: () => void;
  unmatchedSmsCount: number;
  onNavigateToSms: () => void;
  onProfileUpdated: (user: UserProfile) => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  unmatchedSmsCount,
  onNavigateToSms,
  onProfileUpdated,
  isMobileMenuOpen = false,
  onToggleMobileMenu,
}) => {
  const [companySettings, setCompanySettings] = useState<CompanySettings>(DataService.getCompanySettings());
  const [riyadhTime, setRiyadhTime] = useState<string>('');
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isCloudActive, setIsCloudActive] = useState<boolean>(
    Boolean(localStorage.getItem('rawdah_cloud_supabase_url') || import.meta.env.VITE_SUPABASE_URL || isSupabaseConfigured)
  );
  const [lastSync, setLastSync] = useState<string | null>(DataService.getLastCloudSync());

  useEffect(() => {
    // جلب مباشر لأحدث إعدادات المؤسسة من السحابة فوراً
    DataService.syncCompanySettingsFromCloud().then(latest => {
      setCompanySettings(latest);
      if (latest.companyNameAr) {
        document.title = `${latest.companyNameAr} | نظام تصاريح الروضة`;
      }
    });

    // Listen for real-time company settings updates instantly
    const handleUpdate = () => {
      const current = DataService.getCompanySettings();
      setCompanySettings(current);
      setLastSync(DataService.getLastCloudSync());
      if (current.companyNameAr) {
        document.title = `${current.companyNameAr} | نظام تصاريح الروضة`;
      }
    };
    window.addEventListener('rawdah_storage_update', handleUpdate);

    // تحديث حالة السحابة فور تغييرها
    const handleCloudUpdate = () => {
      setIsCloudActive(
        Boolean(localStorage.getItem('rawdah_cloud_supabase_url') || (import.meta as any).env?.VITE_SUPABASE_URL || isSupabaseConfigured)
      );
      const current = DataService.getCompanySettings();
      setCompanySettings(current);
      setLastSync(DataService.getLastCloudSync());
      if (current.companyNameAr) {
        document.title = `${current.companyNameAr} | نظام تصاريح الروضة`;
      }
    };
    window.addEventListener('rawdah_cloud_updated', handleCloudUpdate);

    // Live Asia/Riyadh Clock
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleTimeString('ar-SA', {
        timeZone: 'Asia/Riyadh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const dateFormatted = now.toLocaleDateString('ar-SA', {
        timeZone: 'Asia/Riyadh',
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      setRiyadhTime(`${dateFormatted} - ${formatted}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('rawdah_storage_update', handleUpdate);
      window.removeEventListener('rawdah_cloud_updated', handleCloudUpdate);
    };
  }, []);

  // الربط السحابي يوجّه كل الكتابات القادمة لمشروع آخر — صلاحية المدير العام وحده
  const canManageCloud = currentUser.role === 'super_admin';

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <span className="bg-purple-50 text-purple-800 border border-purple-200 text-xs px-2.5 py-0.5 rounded-full font-bold">المدير العام</span>;
      case 'sales':
        return <span className="bg-sky-50 text-sky-800 border border-sky-200 text-xs px-2.5 py-0.5 rounded-full font-bold">المبيعات</span>;
      case 'inventory':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold">المخزون</span>;
      case 'accountant':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-bold">الحسابات</span>;
      default:
        return null;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#064E3B] text-white border-b-2 border-[#D97706]/60 px-4 md:px-6 py-3 shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between gap-3 md:gap-4">
          
          {/* Left / Start: Mobile Menu Toggle & Logo & Brand */}
          <div className="flex items-center gap-2.5 md:gap-3">
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="md:hidden p-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/50 text-white transition-colors"
                aria-label="القائمة الجانبية"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-amber-300" /> : <Menu className="w-5 h-5 text-amber-300" />}
              </button>
            )}

            <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-emerald-400 p-0.5 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
              <div className="w-full h-full bg-[#064E3B] rounded-[14px] flex items-center justify-center overflow-hidden">
                {companySettings.logoUrl ? (
                  <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-5 h-5 text-amber-300" />
                )}
              </div>
            </div>
            <div>
              <h1 className="text-sm md:text-base font-black text-white tracking-tight leading-tight flex items-center gap-2">
                <span className="truncate max-w-[160px] xs:max-w-[220px] sm:max-w-none">{companySettings.companyNameAr || 'مناسك الخير لتصاريح الروضة الشريفة'}</span>
              </h1>
              <p className="text-[10px] md:text-xs text-emerald-200/90 font-medium flex items-center gap-1.5">
                <span className="hidden xs:inline">نظام التشغيل وإدارة التصاريح</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="text-amber-300 font-bold text-[10px]">مباشر سحابي</span>
              </p>
            </div>
          </div>

          {/* Center: Live Asia/Riyadh Clock */}
          <div className="hidden lg:flex items-center gap-2.5 bg-emerald-900/60 border border-emerald-700/60 px-4 py-1.5 rounded-full text-xs font-mono text-emerald-100 shadow-inner">
            <Clock className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: '10s' }} />
            <span className="text-emerald-200/80 font-sans font-medium">توقيت مكة والرياض:</span>
            <span className="font-bold text-amber-300">{riyadhTime}</span>
          </div>

          {/* Right / End: Cloud Status, Actions & User Switcher */}
          <div className="flex items-center gap-2.5">
            
            {/* Cloud Status Toggle Button */}
            {canManageCloud && (
              <button
                onClick={() => setShowCloudModal(true)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                  isCloudActive
                    ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100 hover:bg-emerald-800'
                    : 'bg-emerald-950/80 border-amber-500/40 text-amber-200 hover:border-amber-400'
                }`}
                title="إعدادات الربط السحابي مع Supabase"
              >
                <Cloud className={`w-4 h-4 ${isCloudActive ? 'text-amber-300' : 'text-slate-300'}`} />
                <span className="hidden sm:inline">
                  {isCloudActive ? 'السحابة متصلة' : 'الربط السحابي'}
                </span>
                {isCloudActive && lastSync && (
                  <span className="hidden md:inline text-[10px] font-bold text-amber-300 bg-emerald-950/80 px-1.5 py-0.5 rounded-md font-mono" title="آخر مزامنة بيانات مع السحابة">
                    {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(lastSync))}
                  </span>
                )}
                <span className={`w-2 h-2 rounded-full ${isCloudActive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
              </button>
            )}

            {/* SMS Notification Bell */}
            <button
              onClick={onNavigateToSms}
              className="relative p-2.5 rounded-xl bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-700/60 text-emerald-100 hover:text-amber-300 transition-all shadow-sm"
              title="رسائل الـ SMS الواردة"
            >
              <Bell className="w-5 h-5" />
              {unmatchedSmsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                  {unmatchedSmsCount}
                </span>
              )}
            </button>

            {/* Current User Display — النقر يفتح الملف الشخصي */}
            <div className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-emerald-900/80 border border-emerald-700/60 text-white shadow-sm">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2.5 group"
                title="ملفي الشخصي — تعديل بياناتي وصورتي وكلمة مروري"
              >
                <span className="relative inline-block shrink-0">
                  <img
                    src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={currentUser.fullName}
                    className="w-8 h-8 rounded-lg object-cover border border-emerald-500/30"
                  />
                  <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-sm">
                    <Pencil className="w-2 h-2 text-white" />
                  </span>
                </span>
                <span className="text-right hidden sm:block">
                  <span className="block text-xs font-bold text-white group-hover:text-amber-300 transition-colors">{currentUser.fullName}</span>
                  <span className="block text-[10px] text-emerald-200/90">{getRoleBadge(currentUser.role)}</span>
                </span>
              </button>
              <button
                onClick={onLogout}
                className="p-2 mr-1 rounded-lg text-emerald-200 hover:text-white hover:bg-rose-600/80 transition-colors"
                title="تسجيل الخروج من النظام"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Cloud Setup Modal */}
      {canManageCloud && (
        <CloudSetupModal
          isOpen={showCloudModal}
          onClose={() => setShowCloudModal(false)}
        />
      )}

      {/* My Profile Modal — خدمة ذاتية لكل موظف */}
      <MyProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        onProfileUpdated={onProfileUpdated}
      />
    </>
  );
};
