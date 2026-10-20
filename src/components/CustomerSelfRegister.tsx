import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Phone, 
  MessageCircle, 
  FileText, 
  CheckCircle2, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  PlusCircle,
  ExternalLink,
  Tag
} from 'lucide-react';
import { CompanySettings } from '../types';
import { DataService } from '../services/dataService';
import { validateWhatsappNumber } from '../utils/phoneValidation';
import confetti from 'canvas-confetti';

export const CustomerSelfRegister: React.FC = () => {
  const [company, setCompany] = useState<CompanySettings>(DataService.getCompanySettings());

  useEffect(() => {
    DataService.syncCompanySettingsFromCloud().then(latest => setCompany(latest));
    const handleUpdate = () => setCompany(DataService.getCompanySettings());
    window.addEventListener('rawdah_storage_update', handleUpdate);
    return () => window.removeEventListener('rawdah_storage_update', handleUpdate);
  }, []);

  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [additionalPhone, setAdditionalPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const cleanPhone = (val: string) => val.replace(/[^\d+]/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanedWhatsapp = cleanPhone(whatsappNumber);
    if (!fullName.trim()) {
      setErrorMessage('يرجى إدخال اسمك الكريم.');
      return;
    }

    const wValidation = validateWhatsappNumber(whatsappNumber);
    if (!wValidation.valid) {
      setErrorMessage(wValidation.error);
      return;
    }

    let normalizedAdditional: string | undefined;
    if (additionalPhone.trim()) {
      const aValidation = validateWhatsappNumber(additionalPhone);
      if (!aValidation.valid) {
        setErrorMessage('رقم الهاتف الإضافي: ' + aValidation.error);
        return;
      }
      normalizedAdditional = aValidation.normalized;
    }

    setIsSubmitting(true);

    try {
      await DataService.saveCustomersBulk([
        {
          fullName: fullName.trim(),
          whatsappNumber: wValidation.normalized,
          additionalPhone: normalizedAdditional,
          nickname: nickname.trim() || undefined,
          notes: notes.trim() ? `[تسجيل ذاتي عبر الرابط] ${notes.trim()}` : '[تسجيل ذاتي عبر رابط الواتساب]',
        }
      ]);

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 }
      });

      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAnother = () => {
    setFullName('');
    setWhatsappNumber('');
    setAdditionalPhone('');
    setNickname('');
    setNotes('');
    setIsSuccess(false);
    setErrorMessage('');
  };

  const companyWhatsappUrl = company.whatsappNumber 
    ? `https://wa.me/${cleanPhone(company.whatsappNumber).replace('+', '')}?text=${encodeURIComponent(`السلام عليكم، قمت بتسجيل بياناتي باسم: ${fullName || 'معتمر جديد'} لتنسيق تصاريح الروضة الشريفة.`)}`
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 font-cairo relative overflow-hidden" dir="rtl">
      
      {/* Subtle Ambient Background Gradients matching website theme */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10 my-6 space-y-6">
        
        {/* Header Branding Card matching Login Screen */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-1 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-500 shadow-md shadow-emerald-600/20">
            <div className="bg-white p-3.5 rounded-[14px] shadow-inner flex items-center justify-center min-w-[56px] min-h-[56px]">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
              ) : (
                <Building2 className="w-8 h-8 text-emerald-600" />
              )}
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {company.companyNameAr || 'منظومة تصاريح الروضة الشريفة'}
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-1">
              تسجيل بيانات المعتمر لتسهيل إصدار وتنسيق التصاريح والمواعيد
            </p>
          </div>
        </div>

        {/* Main Content Card matching the site's rounded-3xl / border-slate-200 */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-xl">
          
          {isSuccess ? (
            <div className="text-center py-2 space-y-5 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900">تم تسجيل بياناتك بنجاح!</h2>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  شكراً لك يا <span className="font-bold text-emerald-700">{fullName}</span>. تم حفظ بياناتك في النظام وسيقوم فريق العمل بالتنسيق معك مباشرة وتأكيد المواعيد والتصاريح.
                </p>
              </div>

              {/* Summary of submitted data */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2.5 text-right">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold border-b border-slate-200 pb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>البيانات المسجلة:</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">الاسم الكامل:</span>
                  <span className="font-bold text-slate-900">{fullName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">رقم الواتساب:</span>
                  <span className="font-mono font-bold text-emerald-700" dir="ltr">{whatsappNumber}</span>
                </div>
                {nickname && (
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">اسم حساب الواتساب / اللقب:</span>
                    <span className="font-bold text-slate-900">{nickname}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {companyWhatsappUrl && (
                  <a
                    href={companyWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black py-3 rounded-2xl text-xs transition-all shadow-md shadow-emerald-500/20"
                  >
                    <MessageCircle className="w-4 h-4 fill-white text-[#25D366]" />
                    <span>تواصل معنا الآن عبر واتساب</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleRegisterAnother}
                  className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-all border border-slate-200 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  <span>تسجيل معتمر آخر أو مرافق</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="border-b border-slate-100 pb-3 mb-1">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span>بيانات المعتمر والتواصل</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  يرجى التأكد من كتابة الاسم ورقم الواتساب بدقة لضمان سرعة إصدار وتنسيق التصريح.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold leading-relaxed">
                  {errorMessage}
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>الاسم الكامل</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="مثال: محمد عبدالله الشمري"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>رقم الواتساب الرئيسي</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">يبدأ بكود الدولة (مثال: +966 أو +20)</span>
                </label>
                <div className="relative">
                  <MessageCircle className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    placeholder="+966 5X XXX XXXX / +20 1X XXXX XXXX"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 text-right focus:outline-none focus:border-emerald-600 focus:bg-white font-mono transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Nickname / WhatsApp Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>اسم حسابك على الواتساب أو اللقب (اختياري)</span>
                  <span className="text-[10px] text-slate-400 font-normal">للتعرف السريع في المحادثات</span>
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="مثال: أبو فهد / Al-Amri"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Additional Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>رقم هاتف إضافي أو بديل (اختياري)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="+966..."
                    value={additionalPhone}
                    onChange={(e) => setAdditionalPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 text-right focus:outline-none focus:border-emerald-600 focus:bg-white font-mono transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Notes / Visit Wishes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>ملاحظات أو مواعيد الزيارة المفضلة (اختياري)</span>
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <textarea
                    rows={2}
                    placeholder="مثال: نفضل موعد بعد صلاة العشاء، عدد الأفراد 3..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-sm resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ البيانات...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>تسجيل البيانات وإرسال الطلب</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>بياناتك محمية ومشفرة وتستخدم فقط لغرض تنظيم وتنسيق الزيارة.</span>
                </p>
              </div>

            </form>
          )}

        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          <p>© {new Date().getFullYear()} {company.companyNameAr || 'منظومة تصاريح الروضة الشريفة'} — جميع الحقوق محفوظة</p>
        </div>

      </div>

    </div>
  );
};
