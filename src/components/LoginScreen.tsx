import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  User, 
  ShieldCheck, 
  ArrowLeft, 
  Eye, 
  EyeOff
} from 'lucide-react';
import { UserProfile } from '../types';
import { DataService } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { hashPassword, verifyPassword } from '../utils/passwordHash';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

// مطابقة مرنة: البروفايلات المتزامنة من السحابة قد تخزّن اسم المستخدم كبريد كامل
// (admin@rawdah.app) بينما تسجّل الدخول بالاسم المختصر (admin) — نوحّد الصيغتين
const normUsername = (u: string) => u.toLowerCase().trim().replace(/@rawdah\.app$/, '');
const toAuthEmail = (u: string) => {
  const v = u.toLowerCase().trim();
  return v.includes('@') ? v : `${v}@rawdah.app`;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    // مهلة قصيرة لإتاحة رسم حالة التحميل
    await new Promise((resolve) => setTimeout(resolve, 400));

    let found = DataService.getProfiles().find(
      (p) => normUsername(p.username) === normUsername(username)
    );

    // ── 1) المصادقة الحقيقية عبر Supabase Auth (بعد تهيئة مستخدمي Auth من لوحة التحكم) ──
    if (isSupabaseConfigured && supabase && found) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: toAuthEmail(username),
          password,
        });
        if (!error) {
          // جلسة مصادقة سارية الآن — مزامنة كاملة تجلب الموظفين بأحدث حالة
          await DataService.syncFromCloud();
          found =
            DataService.getProfiles().find(
              (p) => normUsername(p.username) === normUsername(username)
            ) || found;
          if (!found.isActive) {
            await supabase.auth.signOut();
            setErrorMessage('عذراً، هذا الحساب موقوف حالياً من قبل الإدارة.');
            setIsLoading(false);
            return;
          }
          DataService.setCurrentUser(found);
          onLoginSuccess(found);
          setIsLoading(false);
          return;
        }
        // فشل المصادقة السحابية (مستخدم Auth غير مُهيأ بعد أو كلمة مرور خاطئة)
        // → نتابع للتحقق المحلي الاحتياطي حتى لا يتعطل الدخول في فترة الانتقال
      } catch {
        // انقطاع شبكة أثناء المصادقة → نتابع محلياً
      }
    }

    // ── 2) التحقق المحلي الاحتياطي (كلمات المرور المُبصمة في التخزين المحلي) ──
    if (found) {
      if (!found.isActive) {
        setErrorMessage('عذراً، هذا الحساب موقوف حالياً من قبل الإدارة.');
        setIsLoading(false);
        return;
      }
      // بوابة أمنية: حساب من غير بصمة كلمة مرور لا يُسمح له بالدخول إطلاقاً —
      // وإلا صار أي باسورد مقبول لو فشل الـ Auth السحابي (ثغرة تجاوز)
      if (!found.password) {
        setErrorMessage('هذا الحساب لا يحتوي على كلمة مرور محفوظة. تواصل مع الإدارة لإعادة تعيين كلمة المرور.');
        setIsLoading(false);
        return;
      }
      const { matches, needsMigration } = await verifyPassword(password, found.password);
      if (!matches) {
        setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة.');
        setIsLoading(false);
        return;
      }
      // ترحيل تدريجي: استبدال النص الصريح القديم ببصمة مشفرة فور أول دخول ناجح
      if (needsMigration) {
        const upgraded = { ...found, password: await hashPassword(password) };
        await DataService.saveProfile(upgraded);
        DataService.setCurrentUser(upgraded);
        onLoginSuccess(upgraded);
        setIsLoading(false);
        return;
      }
      DataService.setCurrentUser(found);
      onLoginSuccess(found);
    } else {
      setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
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

          {/* بيانات الدخول */}
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-[11px] text-slate-600 space-y-1.5">
            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>دخول آمن:</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              أدخل اسم المستخدم وكلمة المرور المعتمدين من الإدارة. كلمات المرور مشفرة ولا تظهر لأي شخص.
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
          </form>

        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          النظام متوافق مع نظام التوقيت الرسمي (Asia/Riyadh) • تشفير وقواعد بيانات سحابية Supabase
        </div>

      </div>

    </div>
  );
};
