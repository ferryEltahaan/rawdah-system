import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  User, 
  ShieldCheck, 
  ArrowLeft, 
  Sparkles, 
  Eye, 
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { DataService } from '../services/dataService';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const profiles = DataService.getProfiles();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    setTimeout(() => {
      const found = profiles.find(
        p => p.username.toLowerCase() === username.toLowerCase().trim()
      );

      if (found) {
        if (!found.isActive) {
          setErrorMessage('عذراً، هذا الحساب موقوف حالياً من قبل الإدارة.');
          setIsLoading(false);
          return;
        }
        if (found.password && found.password !== password) {
          setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة.');
          setIsLoading(false);
          return;
        }
        DataService.setCurrentUser(found);
        onLoginSuccess(found);
      } else {
        setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة.');
      }
      setIsLoading(false);
    }, 400);
  };

  // Quick 1-click login helper for testing permissions
  const handleQuickRoleLogin = (role: UserRole) => {
    setErrorMessage('');
    const profile = profiles.find(p => p.role === role) || profiles[0];
    if (!profile?.isActive) {
      setErrorMessage('عذراً، هذا الحساب موقوف حالياً من قبل الإدارة.');
      return;
    }
    DataService.setCurrentUser(profile);
    onLoginSuccess(profile);
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

          {/* بيانات الدخول التجريبية المعتمدة */}
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-[11px] text-slate-600 space-y-1.5">
            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>بيانات الدخول التجريبية المعتمدة:</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-slate-700" dir="ltr">
              <span>admin / admin123</span>
              <span>sales / sales123</span>
              <span>inventory / inventory123</span>
              <span>accountant / acc123</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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

          {/* Quick Permission Testing Panel */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>تجربة الدخول السريع لاختبار الصلاحيات:</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickRoleLogin('super_admin')}
                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 border border-purple-200 text-right text-xs transition-all text-purple-900 group shadow-2xs"
              >
                <div className="font-bold flex items-center justify-between">
                  <span>👑 المدير العام</span>
                  <span className="text-[10px] text-purple-700 font-bold">Admin</span>
                </div>
                <div className="text-[10px] text-purple-700 font-medium">كامل الصلاحيات</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRoleLogin('sales')}
                className="p-2.5 rounded-xl bg-sky-50 hover:bg-sky-100/80 border border-sky-200 text-right text-xs transition-all text-sky-900 group shadow-2xs"
              >
                <div className="font-bold flex items-center justify-between">
                  <span>💼 موظف المبيعات</span>
                  <span className="text-[10px] text-sky-700 font-bold">Sales</span>
                </div>
                <div className="text-[10px] text-sky-700 font-medium">حجز وطلبات وعملاء فقط</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRoleLogin('inventory')}
                className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-right text-xs transition-all text-emerald-900 group shadow-2xs"
              >
                <div className="font-bold flex items-center justify-between">
                  <span>📦 مسؤول المخزون</span>
                  <span className="text-[10px] text-emerald-700 font-bold">Inventory</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-medium">رفع وإدارة الفترات فقط</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRoleLogin('accountant')}
                className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-right text-xs transition-all text-amber-900 group shadow-2xs"
              >
                <div className="font-bold flex items-center justify-between">
                  <span>💳 المحاسب المالي</span>
                  <span className="text-[10px] text-amber-700 font-bold">Accounts</span>
                </div>
                <div className="text-[10px] text-amber-700 font-medium">رسائل SMS والحسابات</div>
              </button>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          النظام متوافق مع نظام التوقيت الرسمي (Asia/Riyadh) • تشفير وقواعد بيانات سحابية Supabase
        </div>

      </div>

    </div>
  );
};
