import React, { useEffect, useState } from 'react';
import {
  UserCog,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { DataService } from '../services/dataService';
import { useToast } from './Toast';
import { ImageUploadField } from './ImageUploadField';

interface MyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onProfileUpdated: (user: UserProfile) => void;
}

const ROLE_TITLES: Record<UserRole, string> = {
  super_admin: 'المدير العام (Super Admin)',
  sales: 'مسؤول المبيعات (Sales)',
  inventory: 'مسؤول المخزون والتصاريح (Inventory)',
  accountant: 'المحاسب المالي (Accountant)',
};

export const MyProfileModal: React.FC<MyProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
}) => {
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFullName(currentUser.fullName);
    setUsername(currentUser.username);
    setPhoneNumber(currentUser.phoneNumber);
    setWhatsappNumber(currentUser.whatsappNumber);
    setAvatarUrl(currentUser.avatarUrl || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.warning('الاسم الكامل مطلوب.');
      return;
    }
    if (!username.trim()) {
      toast.warning('اسم المستخدم مطلوب — يُستخدم لتسجيل الدخول.');
      return;
    }

    setIsSaving(true);
    try {
      const { profile, localSaved, usernameTaken } = await DataService.updateOwnProfile({
        fullName: fullName.trim(),
        username: username.trim(),
        phoneNumber: phoneNumber.trim(),
        whatsappNumber: whatsappNumber.trim(),
        avatarUrl,
      });

      if (usernameTaken) {
        toast.error(`اسم المستخدم «${username.trim()}» مستخدم بالفعل — اختر اسماً آخر.`);
        return;
      }
      // عند فشل الحفظ المحلي (امتلاء المساحة) يظهر تنبيه الخطأ تلقائياً من نظام الإشعارات
      if (!localSaved) return;

      onProfileUpdated(profile);
      toast.success('تم حفظ بياناتك الشخصية بنجاح.');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.warning('أكمل حقول كلمة المرور الثلاثة.');
      return;
    }
    if (newPassword.length < 4) {
      toast.warning('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('تأكيد كلمة المرور لا يطابق الكلمة الجديدة.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { success, error } = await DataService.changeOwnPassword(currentPassword, newPassword);
      if (!success) {
        if (error === 'wrong_current') {
          toast.error('كلمة المرور الحالية غير صحيحة.');
        }
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('تم تغيير كلمة المرور بنجاح — استخدمها في تسجيل الدخول القادم.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const passwordInputClass =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-emerald-600" />
            <span>ملفي الشخصي</span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* معلومات ثابتة للعرض */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
          <img
            src={avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
            alt={currentUser.fullName}
            className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500/40"
          />
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900">{currentUser.fullName}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                {ROLE_TITLES[currentUser.role]}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                currentUser.isActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {currentUser.isActive ? 'الحساب نشط' : 'موقوف'}
              </span>
            </div>
          </div>
        </div>

        {/* بياناتي وصورتي */}
        <form onSubmit={handleSaveInfo} className="space-y-3">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <UserCog className="w-4 h-4 text-emerald-600" />
            <span>بياناتي وصورتي</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل:</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم (للدخول):</label>
              <input
                type="text"
                required
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
              <input
                type="text"
                dir="ltr"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+966..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الواتساب:</label>
              <input
                type="text"
                dir="ltr"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+966..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left"
              />
            </div>
          </div>

          <ImageUploadField
            label="صورتي الشخصية"
            value={avatarUrl}
            onChange={setAvatarUrl}
            previewShape="circle"
            maxDimension={256}
            hint="تظهر صورتك في الشريط العلوي وبطاقة الموظف — اختر صورة من جهازك وتُضغط تلقائياً قبل الحفظ."
          />

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-md shadow-emerald-600/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ بياناتي'}</span>
            </button>
          </div>
        </form>

        {/* تغيير كلمة المرور */}
        <form onSubmit={handleChangePassword} className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>تغيير كلمة المرور</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords(v => !v)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? 'إخفاء' : 'إظهار'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الحالية:</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              dir="ltr"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={passwordInputClass}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة:</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="4 أحرف على الأقل"
                className={passwordInputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد الكلمة الجديدة:</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={passwordInputClass}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-md shadow-indigo-600/20"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isChangingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}</span>
            </button>
          </div>
        </form>

        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-2.5 leading-relaxed">
          الدور والصلاحيات وحالة الحساب تُدار من المدير العام فقط. أي تعديل هنا يُسجَّل في سجل التدقيق ويُزامن ملفك مع قاعدة البيانات السحابية — وكلمة المرور تبقى على هذا الجهاز ولا تُرسل للسحابة أبداً.
        </p>
      </div>
    </div>
  );
};
