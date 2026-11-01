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
  Tag,
  Calendar,
  Users
} from 'lucide-react';
import { CompanySettings, SalesOrder } from '../types';
import { DataService } from '../services/dataService';
import { validateWhatsappNumber } from '../utils/phoneValidation';
import { todayRiyadh } from '../utils/csvHelpers';
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
  const [targetDate, setTargetDate] = useState<string>(todayRiyadh());
  const [preferredTime, setPreferredTime] = useState<string>('19:00');
  const [permitsCountMale, setPermitsCountMale] = useState<number>(1);
  const [permitsCountFemale, setPermitsCountFemale] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<SalesOrder | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const cleanPhone = (val: string) => val.replace(/[^\d+]/g, '');

  const totalPermits = (Number(permitsCountMale) || 0) + (Number(permitsCountFemale) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('ظٹط±ط¬ظ‰ ط¥ط¯ط®ط§ظ„ ط§ط³ظ…ظƒ ط§ظ„ظƒط±ظٹظ….');
      return;
    }

    const wValidation = validateWhatsappNumber(whatsappNumber);
    if (!wValidation.valid) {
      setErrorMessage(wValidation.error);
      return;
    }

    if (totalPermits < 1) {
      setErrorMessage('ظٹط±ط¬ظ‰ طھط­ط¯ظٹط¯ طھطµط±ظٹط­ ظˆط§ط­ط¯ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„ (ط±ط¬ط§ظ„ ط£ظˆ ظ†ط³ط§ط،).');
      return;
    }

    let normalizedAdditional: string | undefined;
    if (additionalPhone.trim()) {
      const aValidation = validateWhatsappNumber(additionalPhone);
      if (!aValidation.valid) {
        setErrorMessage('ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ ط§ظ„ط¥ط¶ط§ظپظٹ: ' + aValidation.error);
        return;
      }
      normalizedAdditional = aValidation.normalized;
    }

    setIsSubmitting(true);

    try {
      // 1. طھط³ط¬ظٹظ„ ط£ظˆ طھط­ط¯ظٹط« ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¹ظ…ظٹظ„ ظپظٹ ط§ظ„ظ€ CRM
      const savedCustomer = await DataService.saveCustomer({
        fullName: fullName.trim(),
        whatsappNumber: wValidation.normalized,
        additionalPhone: normalizedAdditional,
        nickname: nickname.trim() || undefined,
        notes: notes.trim() ? `[طھط³ط¬ظٹظ„ ظˆط­ط¬ط² ط°ط§طھظٹ] ${notes.trim()}` : '[طھط³ط¬ظٹظ„ ظˆط­ط¬ط² ط°ط§طھظٹ ط¹ط¨ط± ط§ظ„ط±ط§ط¨ط·]',
      });

      // 2. ط¥ظ†ط´ط§ط، ط·ظ„ط¨ ط¨ظٹط¹ ظپظˆط±ظٹ ظپظٹ ط´ط§ط´ط© ط§ظ„ظ…ط¨ظٹط¹ط§طھ (ط­ط§ظ„ط© searching ط¨ط§ظ†طھط¸ط§ط± ط³ط­ط¨ ط§ظ„طھطµط±ظٹط­)
      const unitPrice = company.defaultPermitPrice || 150;
      const totalAmount = totalPermits * unitPrice;

      const timeLabel = 
        preferredTime === '19:00' ? '19:00 (ط¨ط¹ط¯ ط§ظ„ط¹ط´ط§ط،)' :
        preferredTime === '05:00' ? '05:00 (ط§ظ„ظپط¬ط± ظˆط§ظ„طµط¨ط§ط­)' :
        preferredTime === '14:00' ? '14:00 (ط§ظ„ط¸ظ‡ط± ظˆط§ظ„ط¹طµط±)' : '18:00 (ط£ظٹ ظ…ظˆط¹ط¯ ظ…طھط§ط­)';

      const newOrder = await DataService.createOrder({
        customerId: savedCustomer.id,
        customerName: savedCustomer.fullName,
        customerWhatsapp: savedCustomer.whatsappNumber,
        permitsCount: totalPermits,
        permitsCountMale: permitsCountMale,
        permitsCountFemale: permitsCountFemale,
        targetDate: targetDate || todayRiyadh(),
        targetTime: timeLabel,
        orderType: 'instant',
        orderStatus: 'searching',
        deliveryStatus: 'not_sent',
        unitPrice: unitPrice,
        totalAmount: totalAmount,
        paidAmount: 0,
        currency: 'SAR',
        notes: notes.trim() ? `[ط·ظ„ط¨ ط°ط§طھظٹ]: ${notes.trim()}` : '[ط·ظ„ط¨ ط°ط§طھظٹ ط¹ط¨ط± ط±ط§ط¨ط· ط§ظ„ط­ط¬ط²]',
        createdBy: 'ط¨ظˆط§ط¨ط© ط§ظ„ظ…ط¹طھظ…ط± ط§ظ„ط°ط§طھظٹط©',
      });

      setCreatedOrder(newOrder);

      confetti({
        particleCount: 75,
        spread: 75,
        origin: { y: 0.6 }
      });

      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط­ظپط¸ ط§ظ„ط¨ظٹط§ظ†ط§طھطŒ ظٹط±ط¬ظ‰ ط§ظ„ظ…ط­ط§ظˆظ„ط© ظ…ط±ط© ط£ط®ط±ظ‰.');
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
    setPermitsCountMale(1);
    setPermitsCountFemale(0);
    setCreatedOrder(null);
    setIsSuccess(false);
    setErrorMessage('');
  };

  const companyWhatsappUrl = company.whatsappNumber 
    ? `https://wa.me/${cleanPhone(company.whatsappNumber).replace('+', '')}?text=${encodeURIComponent(
        createdOrder 
          ? `ط§ظ„ط³ظ„ط§ظ… ط¹ظ„ظٹظƒظ…طŒ ظ‚ظ…طھ ط¨طھط³ط¬ظٹظ„ ط·ظ„ط¨ ط­ط¬ط² طھطµط±ظٹط­ ط±ظˆط¶ط© ط±ظ‚ظ… #${createdOrder.orderNumber} ط¨ط§ط³ظ…: ${fullName} ظ„طھط§ط±ظٹط® ${targetDate} (ط§ظ„ط¹ط¯ط¯: ${totalPermits}). ظٹط±ط¬ظ‰ طھط£ظƒظٹط¯ ط§ظ„ط­ط¬ط².`
          : `ط§ظ„ط³ظ„ط§ظ… ط¹ظ„ظٹظƒظ…طŒ ظ‚ظ…طھ ط¨طھط³ط¬ظٹظ„ ط¨ظٹط§ظ†ط§طھظٹ ط¨ط§ط³ظ…: ${fullName || 'ظ…ط¹طھظ…ط± ط¬ط¯ظٹط¯'} ظ„طھظ†ط³ظٹظ‚ طھطµط§ط±ظٹط­ ط§ظ„ط±ظˆط¶ط© ط§ظ„ط´ط±ظٹظپط©.`
      )}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#064E3B] via-[#043d2f] to-[#02231b] flex flex-col md:flex-row relative overflow-hidden font-cairo" dir="rtl">
      
      {/* خلفيات وزخارف إسلامية موحدة لكامل الصفحة */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400/[0.03] via-transparent to-transparent pointer-events-none"></div>

      {/* ── الجانب الأيمن: بطاقة تسجيل طلب المعتمر ── */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-10 lg:p-14 relative z-10 order-2 md:order-1 overflow-y-auto max-h-screen">
        
        <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/40 rounded-3xl p-7 md:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] space-y-6 my-auto">
          
          {isSuccess ? (
            <div className="text-center py-2 space-y-5 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900">تم تسجيل طلبك بنجاح!</h2>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  شكراً لك يا <span className="font-bold text-emerald-700">{fullName}</span>. تم إنشاء طلبك في النظام برقم <span className="font-bold text-slate-900 font-mono text-sm bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">#{createdOrder?.orderNumber}</span> وتوجيهه لفريق العمل لحجز وتخصيص الفترات في المخزون.
                </p>
              </div>

              {/* Summary of submitted data */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2.5 text-right">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold border-b border-slate-200 pb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>تفاصيل الحجز المسجل:</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">رقم الطلب:</span>
                  <span className="font-mono font-bold text-emerald-700">#{createdOrder?.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">الاسم الكامل:</span>
                  <span className="font-bold text-slate-900">{fullName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">رقم الواتساب:</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">{whatsappNumber}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">تاريخ الزيارة المطلوب:</span>
                  <span className="font-bold text-slate-900">{targetDate}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">عدد التصاريح:</span>
                  <span className="font-bold text-emerald-700">{totalPermits} تصريح ({permitsCountMale} رجال، {permitsCountFemale} نساء)</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-bold">الحالة:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3 h-3 animate-spin" />
                    <span>جاري تخصيص الفترات في المخزون</span>
                  </span>
                </div>
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
                    <span>تأكيد الحجز فوراً عبر واتساب المؤسسة</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleRegisterAnother}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-all"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>تسجيل طلب جديد لزائر آخر</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#064E3B]" />
                  <span>بيانات المعتمر وتفاصيل الحجز</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  يرجى التأكد من كتابة الاسم ورقم الواتساب وتحديد عدد الأفراد بدقة
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-in fade-in flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>الاسم الكامل *</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="مثال: محمد عبدالله الشمري"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:border-[#064E3B] focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>رقم الواتساب الرئيسي *</span>
                  <span className="text-[10px] text-emerald-700 font-bold">يبدأ بكود الدولة (مثال: 966+ أو 20+)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+966 5X XXX XXXX / +20 1X XXXX XXXX"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:border-[#064E3B] focus:bg-white transition-all shadow-sm font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#064E3B]" />
                    <span>تاريخ الزيارة المطلوب *</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={todayRiyadh()}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-[#064E3B] focus:bg-white transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#064E3B]" />
                    <span>الفترة المفضلة</span>
                  </label>
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-[#064E3B] focus:bg-white transition-all shadow-sm"
                  >
                    <option value="19:00">المساء (بعد العشاء 19:00 - 23:00)</option>
                    <option value="05:00">الفجر والصباح الباكر (05:00 - 09:00)</option>
                    <option value="14:00">الظهيرة والعصر (13:00 - 17:00)</option>
                    <option value="any">أي فترة متاح حجزها رسمياً</option>
                  </select>
                </div>
              </div>

              {/* Male and Female Permits breakdown */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#064E3B]" />
                    <span>عدد التصاريح المطلوبة *</span>
                  </span>
                  <span className="text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-full font-bold text-[11px]">
                    الإجمالي: {totalPermits} تصريح
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">رجال (ذكور):</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={permitsCountMale}
                      onChange={(e) => setPermitsCountMale(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:outline-none focus:border-[#064E3B]"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">نساء (إناث):</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={permitsCountFemale}
                      onChange={(e) => setPermitsCountFemale(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 text-center font-bold focus:outline-none focus:border-[#064E3B]"
                    />
                  </div>
                </div>
              </div>

              {/* Nickname / WhatsApp Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>اسم حسابك على الواتساب أو اللقب (اختياري)</span>
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="مثال: أبو فهد / Al-Amri"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#064E3B] focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Notes / Visit Wishes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>ملاحظات إضافية (اختياري)</span>
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <textarea
                    rows={2}
                    placeholder="مثال: أي توضيحات إضافية تفضل إبلاغنا بها..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#064E3B] focus:bg-white transition-all shadow-sm resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#064E3B] via-[#04634b] to-[#064E3B] hover:brightness-110 text-white font-black text-sm shadow-[0_8px_20px_rgba(6,78,59,0.35)] flex items-center justify-center gap-2 transition-all border-y border-amber-400/50 disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>جاري تسجيل الطلب وحجز الموعد...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-amber-300" />
                    <span>تأكيد تسجيل الحجز وإرسال الطلب</span>
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

      </div>

      {/* ── الجانب الأيسر (Desktop): واجهة الشعار والهوية الموحدة بانسيابية تامة ── */}
      <div className="w-full md:w-1/2 min-h-[420px] md:min-h-screen relative flex flex-col justify-center items-center text-center p-8 md:p-14 overflow-hidden order-1 md:order-2">

        {/* قلب الهوية: الشعار واسم المؤسسة */}
        <div className="relative z-10 max-w-lg mx-auto space-y-8 flex flex-col items-center my-auto">
          
          {/* إطار الشعار الفخم والمذهب */}
          <div className="relative group transition-transform hover:scale-105 duration-300">
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-400 to-amber-600 rounded-3xl blur-lg opacity-40 group-hover:opacity-60 transition duration-300"></div>
            
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl p-1 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-2xl flex items-center justify-center">
              <div className="w-full h-full bg-[#05382b] rounded-[22px] flex items-center justify-center overflow-hidden border border-amber-300/40 p-3">
                {company.logoUrl ? (
                  <img 
                    src={company.logoUrl} 
                    alt={company.companyNameAr || "شعار المؤسسة"} 
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

          {/* اسم المؤسسة والوصف */}
          <div className="space-y-3 text-center px-4 w-full">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.3] pb-1.5 bg-gradient-to-b from-[#FFFFFF] via-[#FDE68A] to-[#D97706] bg-clip-text text-transparent drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
              {company.companyNameAr || 'مناسك الخير لتصاريح الروضة الشريفة'}
            </h1>
            
            <div className="pt-2">
              <p className="text-xs md:text-sm text-amber-200/90 font-bold tracking-wider max-w-md mx-auto leading-relaxed">
                {company.companyNameEn || 'Rawdah Permits Enterprise'}
              </p>
              <p className="text-[11px] text-emerald-100/70 font-medium tracking-wide mt-1">
                بوابة تسجيل المعتمر وحجز موعد تصريح الروضة الشريفة
              </p>
            </div>
          </div>

          {/* بطاقات ميزات النظام لإثراء الشاشة وملء الفراغ بفخامة */}
          <div className="grid grid-cols-2 gap-3.5 pt-4 w-full max-w-md mx-auto">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/40 backdrop-blur-md text-right space-y-1 hover:border-amber-400/40 transition-colors">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>فترات الـ 20 دقيقة</span>
              </div>
              <p className="text-[11px] text-emerald-100/75 leading-relaxed">
                إدارة دقيقة لـ 72 فترة يومية متوافقة مع بوابات الحرم الشريف.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/40 backdrop-blur-md text-right space-y-1 hover:border-amber-400/40 transition-colors">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>سداد وتسليم فوري</span>
              </div>
              <p className="text-[11px] text-emerald-100/75 leading-relaxed">
                تأكيد فوري عبر واتساب وإصدار تذاكر الدخول بالعملتين (SAR/EGP).
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
