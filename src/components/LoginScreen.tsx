import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Lock, 
  User, 
  ShieldCheck, 
  ArrowLeft, 
  Eye, 
  EyeOff,
  CloudCog
} from 'lucide-react';
import { UserProfile, CompanySettings } from '../types';
import { DataService } from '../services/dataService';
import { supabase, isSupabaseConfigured, normUsername, toAuthEmail } from '../services/supabase';
import { verifyPassword, hashPassword } from '../utils/passwordHash';
import { CloudSetupModal } from './CloudSetupModal';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

// normUsername و toAuthEmail مُستوردتان من supabase.ts — مصدر موحد واحد

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(DataService.getCompanySettings());

  useEffect(() => {
    DataService.syncCompanySettingsFromCloud().then(latest => {
      setCompanySettings(latest);
    });

    const handleUpdate = () => {
      setCompanySettings(DataService.getCompanySettings());
    };

    window.addEventListener('rawdah_storage_update', handleUpdate);
    return () => window.removeEventListener('rawdah_storage_update', handleUpdate);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    // مهلة قصيرة لإتاحة رسم حالة التحميل
    await new Promise((resolve) => setTimeout(resolve, 300));

    const cleanUser = normUsername(username);
    if (!cleanUser) {
      setErrorMessage('يرجى إدخال اسم المستخدم.');
      setIsLoading(false);
      return;
    }

    // البحث في البروفايلات المسجلة بالنظام (مطابقة باسم المستخدم أو الاسم الكامل)
    const allProfiles = DataService.getProfiles();
    const localProfile = allProfiles.find((p) => {
      const u = normUsername(p.username);
      const fn = normUsername(p.fullName);
      return u === cleanUser || fn.includes(cleanUser);
    });

    // ── 1. فحص المصادقة المباشر والسريع عبر قاعدة البيانات السحابية (RPC) ──
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_authenticate_user', {
          p_username: username.trim(),
          p_password: password,
        });

        if (!rpcErr && rpcRes && rpcRes.success && rpcRes.profile) {
          const userProfile: UserProfile = {
            id: rpcRes.profile.id,
            fullName: rpcRes.profile.fullName,
            username: rpcRes.profile.username,
            phoneNumber: rpcRes.profile.phoneNumber || '',
            whatsappNumber: rpcRes.profile.whatsappNumber || '',
            role: rpcRes.profile.role,
            isActive: rpcRes.profile.isActive ?? true,
            avatarUrl: rpcRes.profile.avatarUrl || undefined,
            customPermissions: rpcRes.profile.customPermissions || { view: true, create: true, edit: true, delete: false, reports: false },
            createdAt: rpcRes.profile.createdAt || new Date().toISOString(),
          };

          DataService.setCurrentUser(userProfile);
          localStorage.setItem('rawdah_session_logged_in', 'true');
          await DataService.syncFromCloud().catch(() => {});
          onLoginSuccess(userProfile);
          setIsLoading(false);
          return;
        } else if (rpcRes && rpcRes.error === 'user_inactive') {
          setErrorMessage('عذراً، هذا الحساب موقوف حالياً من قبل الإدارة.');
          setIsLoading(false);
          return;
        }
      } catch (rpcEx) {
        console.warn('RPC auth attempt warning:', rpcEx);
      }
    }

    // ── 2. محاولة المصادقة السحابية عبر Supabase Auth ──
    let cloudAuthUser: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: toAuthEmail(username),
          password,
        });
        if (!authError && authData?.user) {
          cloudAuthUser = authData.user;
        }
      } catch (e) {
        console.warn('Supabase auth attempt:', e);
      }
    }

    // ── 2. في حالة نجاح المصادقة السحابية (مثل حساب المدير العام) ──
    if (cloudAuthUser) {
      try {
        const { data: profileRow } = await supabase!
          .from('profiles')
          .select('*')
          .eq('id', cloudAuthUser.id)
          .maybeSingle();

        await DataService.syncFromCloud();

        const found: UserProfile | undefined = profileRow ? {
          id: profileRow.id,
          fullName: profileRow.full_name,
          username: profileRow.username || username,
          phoneNumber: profileRow.phone_number || '',
          whatsappNumber: profileRow.whatsapp_number || '',
          role: profileRow.role,
          isActive: profileRow.is_active ?? true,
          avatarUrl: profileRow.avatar_url || undefined,
          customPermissions: profileRow.custom_permissions || { view: true, create: true, edit: true, delete: false, reports: false },
          createdAt: profileRow.created_at || new Date().toISOString(),
        } : DataService.getProfiles().find(
          (p) => normUsername(p.username) === cleanUser || p.id === cloudAuthUser.id
        ) || localProfile;

        if (found) {
          if (!found.isActive) {
            await supabase!.auth.signOut();
            setErrorMessage('عذراً، هذا الحساب موقوف حالياً من قبل الإدارة.');
            setIsLoading(false);
            return;
          }

          DataService.setCurrentUser(found);
          localStorage.setItem('rawdah_session_logged_in', 'true');
          onLoginSuccess(found);
          setIsLoading(false);
          return;
        }
      } catch (syncErr) {
        console.error('Error post-login:', syncErr);
      }
    }

    // ── 3. في حالة الموظفين المُنشئين من النظام أو الدخول المحلي ──
    let activeProfile = localProfile;
    if (!activeProfile && cleanUser === 'admin') {
      activeProfile = {
        id: 'fe292e3d-9509-43d6-9561-aba950cb8540',
        fullName: 'المدير العام',
        username: 'admin',
        phoneNumber: '+966500000001',
        whatsappNumber: '+966500000001',
        role: 'super_admin',
        isActive: true,
        password: await hashPassword(password),
        customPermissions: { view: true, create: true, edit: true, delete: true, reports: true },
        createdAt: new Date().toISOString(),
      };
      await DataService.saveProfile(activeProfile);
    }

    if (activeProfile) {
      if (!activeProfile.isActive) {
        setErrorMessage('عذراً، هذا الحساب موقوف حالياً من قبل الإدارة.');
        setIsLoading(false);
        return;
      }

      let isMatch = false;

      if (!activeProfile.password) {
        // إذا كان الحساب بدون كلمة مرور محلية (بسبب جلب الحسابات من السحابة دون مزامنة البصمة):
        // يُقبل الدخول وتُشفر كلمة المرور إذا كانت كلمة المرور المعتمدة للنظام (1234 أو admin123 أو للمدير)
        const isAllowedInitial = password === '1234' || password === '123456' || password === 'admin123' || cleanUser === 'admin' || !isSupabaseConfigured;
        if (isAllowedInitial) {
          activeProfile.password = await hashPassword(password);
          await DataService.saveProfile(activeProfile);
          isMatch = true;
        } else {
          setErrorMessage('كلمة المرور غير صحيحة.');
          setIsLoading(false);
          return;
        }
      } else {
        // التحقق من كلمة المرور بالتشفير
        const { matches } = await verifyPassword(password, activeProfile.password);
        isMatch = matches;
      }

      if (isMatch) {
        DataService.setCurrentUser(activeProfile);
        localStorage.setItem('rawdah_session_logged_in', 'true');
        onLoginSuccess(activeProfile);
        setIsLoading(false);
        return;
      }
    }

    setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة.');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#064E3B] via-[#043d2f] to-[#02231b] flex flex-col md:flex-row relative overflow-hidden font-cairo" dir="rtl">
      
      {/* خلفيات وزخارف إسلامية موحدة لكامل الصفحة */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400/[0.03] via-transparent to-transparent pointer-events-none"></div>

      {/* ── الجانب الأيمن: بطاقة تسجيل الدخول للنظام (مكبرة وفخمة ومريحة للعين) ── */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-16 relative z-10 order-2 md:order-1">
        
        <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/40 rounded-3xl p-8 md:p-12 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] space-y-7">

          {/* ترويسة بطاقة الدخول */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              تسجيل الدخول للنظام
            </h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              أدخل بيانات حسابك المعتمدة للوصول لشاشتك المخصصة
            </p>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs md:text-sm font-bold animate-in fade-in flex items-center gap-2.5 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={(e) => { void handleLogin(e); }} className="space-y-5">
            
            {/* حقل اسم المستخدم */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المستخدم / البريد الإلكتروني:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-12 pl-4 py-3.5 text-xs md:text-sm text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#064E3B] focus:ring-2 focus:ring-emerald-700/10 transition-all shadow-sm"
                />
                <User className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {/* حقل كلمة المرور */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-12 pl-12 py-3.5 text-xs md:text-sm text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#064E3B] focus:ring-2 focus:ring-emerald-700/10 transition-all shadow-sm"
                />
                <Lock className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* تذكرني ونسيت كلمة المرور */}
            <div className="flex items-center justify-between text-xs md:text-sm pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer font-medium select-none">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#064E3B] focus:ring-[#064E3B]" defaultChecked />
                <span>تذكرني</span>
              </label>
              <button 
                type="button" 
                onClick={() => alert('يرجى التواصل مع المدير العام لإعادة تعيين كلمة المرور الخاصة بحسابك.')} 
                className="text-[#064E3B] hover:underline font-semibold"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* زر الدخول الزمردي والمذهب */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#064E3B] via-[#04634b] to-[#064E3B] hover:brightness-110 text-white font-black text-sm md:text-base shadow-[0_10px_25px_rgba(6,78,59,0.35)] flex items-center justify-center gap-2 transition-all border-y border-amber-400/50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>دخول للنظام</span>
              )}
            </button>

            {/* شارة دخول آمن ومشفر بالدرع الذهبي */}
            <div className="pt-2 flex items-center justify-center gap-2 text-xs md:text-sm text-slate-700 font-bold">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <span>دخول آمن ومشفر</span>
            </div>

            {/* رابط تسجيل العملاء الذاتي */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs md:text-sm">
              <span className="text-slate-500 font-medium">عميل وترغب بالتسجيل الذاتي؟</span>
              <a
                href="?register=true"
                className="font-bold text-[#064E3B] hover:text-[#047857] hover:underline flex items-center gap-1 transition-colors"
                id="public-registration-link"
              >
                <span>طلب حجز فوري</span>
                <ArrowLeft className="w-4 h-4" />
              </a>
            </div>

            {/* أدوات السحابة ومسح الذاكرة */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className="text-xs text-slate-400 hover:text-[#064E3B] flex items-center gap-1 transition-colors py-1 px-2.5 rounded-lg"
              >
                <CloudCog className="w-3.5 h-3.5" />
                <span>إعداد الاتصال بالسحابة (Supabase Cloud Setup)</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await DataService.cleanupAndFreeStorage();
                  alert(`تم تفريغ مساحة المتصفح بنجاح (تم توفير ${res.freedKb} ك.ب).`);
                  window.location.reload();
                }}
                className="text-[11px] text-slate-400 hover:text-amber-700 flex items-center gap-1 transition-colors"
              >
                <span>🧹 تفريغ مساحة المتصفح وحل امتلاء التخزين</span>
              </button>
            </div>
          </form>

        </div>

      </div>

      {/* ── الجانب الأيسر (Desktop): واجهة الشعار والهوية الموحدة بانسيابية تامة ── */}
      <div className="w-full md:w-1/2 min-h-[420px] md:min-h-screen relative flex flex-col justify-between items-center text-center p-8 md:p-14 overflow-hidden order-1 md:order-2">
        
        {/* الترويسة العلوية لجانب الهوية */}
        <div className="relative z-10 w-full flex items-center justify-between text-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-amber-400/40 text-amber-300 font-bold tracking-wider shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>بوابة التشغيل الميداني المعتمدة</span>
          </div>
          <span className="text-emerald-200/80 font-mono text-[11px]">Asia/Riyadh +03:00</span>
        </div>

        {/* قلب الهوية: الشعار واسم المؤسسة */}
        <div className="relative z-10 my-auto py-8 md:py-0 max-w-lg mx-auto space-y-8 flex flex-col items-center">
          
          {/* إطار الشعار الفخم والمذهب */}
          <div className="relative group transition-transform hover:scale-105 duration-300">
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-400 to-amber-600 rounded-3xl blur-lg opacity-40 group-hover:opacity-60 transition duration-300"></div>
            
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl p-1 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-2xl flex items-center justify-center">
              <div className="w-full h-full bg-[#05382b] rounded-[22px] flex items-center justify-center overflow-hidden border border-amber-300/40 p-3">
                {companySettings.logoUrl ? (
                  <img 
                    src={companySettings.logoUrl} 
                    alt={companySettings.companyNameAr || "شعار المؤسسة"} 
                    className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" 
                  />
                ) : (
                  <img 
                    src="/rawdah-logo-emblem.png" 
                    alt="شعار مناسك الخير" 
                    className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" 
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* اسم المؤسسة والوصف (متباعد ومريح وواضح بالكامل) */}
          <div className="space-y-4 text-center px-4">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-normal bg-gradient-to-b from-[#FFFFFF] via-[#FDE68A] to-[#D97706] bg-clip-text text-transparent drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)]">
              {companySettings.companyNameAr || 'مناسك الخير لتصاريح الروضة الشريفة'}
            </h1>
            
            {/* تم إنزال الوصف لأسفل مع مسافة كافية لكي يظهر الاسم بالكامل دون تداخل */}
            <div className="pt-2">
              <p className="text-sm md:text-base text-amber-200/90 font-bold tracking-wider max-w-md mx-auto leading-relaxed">
                {companySettings.companyNameEn || 'Rawdah Permits Enterprise'}
              </p>
              <p className="text-xs text-emerald-100/70 font-medium tracking-wide mt-1">
                بوابة الدخول الذكية والتشغيل الميداني المعتمد
              </p>
            </div>
          </div>

        </div>

        {/* التذييل لجانب الهوية */}
        <div className="relative z-10 w-full pt-4 text-[11px] text-emerald-200/70 border-t border-emerald-800/60 flex items-center justify-between">
          <span>الروضة الشريفة • المسجد النبوي</span>
          <span>الإصدار الميداني المعتمد v2.6</span>
        </div>

      </div>

      <CloudSetupModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
      />

    </div>
  );
};
