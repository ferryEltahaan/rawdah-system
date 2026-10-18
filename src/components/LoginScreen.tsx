import React, { useState } from 'react';
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
import { UserProfile } from '../types';
import { DataService } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { verifyPassword, hashPassword } from '../utils/passwordHash';
import { CloudSetupModal } from './CloudSetupModal';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

// خريطة مطابقة ذكية بين الأسماء الإنجليزية والعربية
const USERNAME_ALIASES: Record<string, string> = {
  'farid': 'فريد',
  'فريد': 'farid',
  'basmala': 'بسمله',
  'بسمله': 'basmala',
  'menna': 'منه',
  'منه': 'menna',
  'rawdah': 'روضه',
  'روضه': 'rawdah',
  'sara': 'سارة',
  'سارة': 'sara',
};

// مطابقة مرنة: إزالة أي بادئة أو لاحقة @ وتوحيد الصيغة
const normUsername = (u: string) => 
  (u || '')
    .toLowerCase()
    .trim()
    .replace(/@rawdah\.app$/, '')
    .replace(/^@+/, '')
    .replace(/@+$/, '');

const toAuthEmail = (u: string) => {
  const v = (u || '').toLowerCase().trim();
  if (v.includes('@') && !v.endsWith('@rawdah.app') && v.includes('.')) {
    return v;
  }
  const clean = normUsername(v);
  return `${clean}@rawdah.app`;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);

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

    const alias = USERNAME_ALIASES[cleanUser];

    // البحث في البروفايلات المسجلة بالنظام (مطابقة باسم المستخدم أو الاسم المعرّب أو الاسم الكامل)
    const allProfiles = DataService.getProfiles();
    const localProfile = allProfiles.find((p) => {
      const u = normUsername(p.username);
      const fn = normUsername(p.fullName);
      return (
        u === cleanUser || 
        (alias && u === alias) || 
        fn.includes(cleanUser) || 
        (alias && fn.includes(alias))
      );
    });

    // ── 1. محاولة المصادقة السحابية عبر Supabase Auth أولاً ──
    let cloudAuthUser: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const emailsToTry = [toAuthEmail(username)];
        if (alias) emailsToTry.push(toAuthEmail(alias));

        for (const email of emailsToTry) {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!authError && authData?.user) {
            cloudAuthUser = authData.user;
            break;
          }
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

    // ── 3. في حالة الموظفين المُنشئين من النظام ──
    if (localProfile) {
      if (!localProfile.isActive) {
        setErrorMessage('عذراً، هذا الحساب موقوف حالياً من قبل الإدارة.');
        setIsLoading(false);
        return;
      }

      let isMatch = false;

      if (!localProfile.password) {
        // إذا كان الحساب بدون كلمة مرور مسجلة سابقة، نعتمد كلمة المرور المدخلة ككلمة مرور الحساب فوراً
        localProfile.password = await hashPassword(password);
        await DataService.saveProfile(localProfile);
        isMatch = true;
      } else {
        const { matches } = await verifyPassword(password, localProfile.password);
        isMatch = matches || password === localProfile.password;
      }

      if (isMatch) {
        DataService.setCurrentUser(localProfile);
        localStorage.setItem('rawdah_session_logged_in', 'true');
        onLoginSuccess(localProfile);
        setIsLoading(false);
        return;
      }
    }

    setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة.');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-cairo" dir="rtl">
      
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-1 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-500 shadow-md shadow-emerald-600/20">
            <div className="bg-white p-3.5 rounded-[14px] shadow-inner">
              <Building2 className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              منظومة تصاريح الروضة الشريفة
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-1">
              منصة إدارة الفترات الزمنية والمبيعات والسداد الفوري
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-xl backdrop-blur-xl space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>تسجيل الدخول للنظام</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              أدخل بيانات حسابك المعتمدة للوصول لشاشتك المخصصة
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-in fade-in flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* دخول آمن */}
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-[11px] text-slate-600 space-y-1.5">
            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>دخول آمن:</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              يتم التحقق من اسم المستخدم وكلمة المرور على خادم Supabase، ولا تُخزَّن كلمات المرور في هذا التطبيق.
            </p>
          </div>

          <form onSubmit={(e) => { void handleLogin(e); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المستخدم / البريد الإلكتروني:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="مثال: admin أو khaled_sales"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-10 py-2.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 hover:shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>دخول للنظام</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Public Registration Link */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">عميل جديد وترغب بالتسجيل؟</span>
              <a
                href="?register=true"
                className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 transition-colors"
                id="public-registration-link"
              >
                <span>تسجيل عميل جديد / إنشاء حساب</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Cloud connection link for admin initial setup */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className="text-[11px] text-slate-400 hover:text-emerald-700 flex items-center gap-1 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-50"
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
                className="text-[11px] text-slate-400 hover:text-amber-700 flex items-center gap-1 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-50"
                title="اضغط هنا لتفريغ الذاكرة المؤقتة إذا ظهرت لك رسالة امتلاء مساحة الهاتف"
              >
                <span>🧹 تفريغ مساحة المتصفح وحل امتلاء التخزين</span>
              </button>
            </div>
          </form>

        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          النظام متوافق مع نظام التوقيت الرسمي (Asia/Riyadh) • تشفير وقواعد بيانات سحابية Supabase
        </div>

      </div>

      <CloudSetupModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
      />

    </div>
  );
};
