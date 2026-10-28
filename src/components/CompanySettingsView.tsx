import React, { useState, useEffect } from 'react';
import {
  Building,
  Save,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { CompanySettings, MessageTemplates } from '../types';
import { DataService, initialMessageTemplates } from '../services/dataService';
import { useToast } from './Toast';
import { ImageUploadField } from './ImageUploadField';
import { currencySymbol } from '../utils/currency';
import confetti from 'canvas-confetti';

// أدوات البذر والمسح متاحة للمدير العام فقط (سواء في التطوير أو الإنتاج)


const CURRENCY_OPTIONS = [
  { code: 'SAR', label: 'ريال سعودي (ر.س)' },
  { code: 'EGP', label: 'جنيه مصري (ج.م)' },
  { code: 'USD', label: 'دولار أمريكي ($)' },
  { code: 'AED', label: 'درهم إماراتي (د.إ)' },
];

export const CompanySettingsView: React.FC = () => {
  const toast = useToast();
  const [settings, setSettings] = useState<CompanySettings>(DataService.getCompanySettings());
  const [templates, setTemplates] = useState<MessageTemplates>(DataService.getMessageTemplates());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // جلب مباشر من السحابة لضمان عرض أحدث بيانات المؤسسة وقوالب الرسائل
    DataService.syncCompanySettingsFromCloud().then(latest => {
      setSettings(latest);
    });
    DataService.syncMessageTemplatesFromCloud().then(latest => {
      if (latest) setTemplates(latest);
    });

    const handleUpdate = () => {
      setSettings(DataService.getCompanySettings());
      setTemplates(DataService.getMessageTemplates());
    };

    window.addEventListener('rawdah_storage_update', handleUpdate);
    return () => window.removeEventListener('rawdah_storage_update', handleUpdate);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const { settings: savedSettings, localSaved } = await DataService.updateCompanySettings(settings);
    setSettings(savedSettings);
    await DataService.updateMessageTemplates(templates);

    setIsSaving(false);
    if (!localSaved) return;

    confetti({ particleCount: 35, spread: 60 });
    setSavedSuccess(true);
    toast.success('تم الحفظ والتحديث السحابي لبيانات المؤسسة وقوالب الرسائل بنجاح!');
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600" />
            <span>بيانات وإعدادات المؤسسة الأساسية</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            بيانات المنشأة، أرقام التواصل والواتساب، الشعار، وملاحظات الفواتير والتقارير.
          </p>
        </div>

        {savedSuccess && (
          <div role="status" aria-live="polite" data-testid="settings-save-success" className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-4 py-2 rounded-2xl flex items-center gap-2 font-bold animate-in fade-in shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>تم الحفظ والتحديث السحابي بنجاح!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6 shadow-sm">
        
        {/* Brand & Names */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-emerald-800 border-b border-slate-100 pb-2">
            1. الهوية والاسم التجاري
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المؤسسة (بالعربي):</label>
              <input
                type="text"
                required
                value={settings.companyNameAr}
                onChange={(e) => setSettings({ ...settings, companyNameAr: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المؤسسة (بالإنجليزي):</label>
              <input
                type="text"
                value={settings.companyNameEn}
                onChange={(e) => setSettings({ ...settings, companyNameEn: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>
          </div>

          <ImageUploadField
            label="شعار المؤسسة (Logo)"
            value={settings.logoUrl || ''}
            onChange={(logoUrl) => setSettings({ ...settings, logoUrl })}
            previewShape="square"
            maxDimension={512}
            hint="يظهر الشعار في ترويسة سندات الطباعة والفواتير. تُضغط الصورة تلقائياً قبل الحفظ."
          />
        </div>

        {/* Contact info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-emerald-800 border-b border-slate-100 pb-2">
            2. أرقام التواصل والواتساب
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الواتساب الرئيسي للتواصل:</label>
              <input
                type="text"
                value={settings.whatsappNumber}
                onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-emerald-600 font-mono focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الهاتف الأساسي:</label>
              <input
                type="text"
                value={settings.primaryPhone}
                onChange={(e) => setSettings({ ...settings, primaryPhone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-emerald-600 font-mono focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم هاتف إضافي:</label>
              <input
                type="text"
                value={settings.secondaryPhone || ''}
                onChange={(e) => setSettings({ ...settings, secondaryPhone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-emerald-600 font-mono focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">البريد الإلكتروني:</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">العنوان والموقع:</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Legal & Invoices */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-emerald-800 border-b border-slate-100 pb-2">
            3. الفواتير والتقارير
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الرقم الضريبي (إن وجد):</label>
              <input
                type="text"
                value={settings.taxNumber || ''}
                onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">السجل التجاري (إن وجد):</label>
              <input
                type="text"
                value={settings.commercialRegistry || ''}
                onChange={(e) => setSettings({ ...settings, commercialRegistry: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">عملة التعامل:</label>
              <select
                value={settings.currency || 'SAR'}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              >
                {!CURRENCY_OPTIONS.some(c => c.code === settings.currency) && settings.currency && (
                  <option value={settings.currency}>{settings.currency}</option>
                )}
                {CURRENCY_OPTIONS.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">تُطبع هذه العملة في سندات الحجز والتقارير المالية.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سعر التصريح الواحد ({currencySymbol((settings.currency as any) || 'SAR')}):
              </label>
              <input
                type="number"
                min={0}
                value={settings.defaultPermitPrice ?? 150}
                onChange={(e) => setSettings({ ...settings, defaultPermitPrice: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
              <p className="text-[11px] text-slate-500 mt-1">السعر الافتراضي للتصريح عند إنشاء طلب حجز جديد.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">نص التذييل في الفاتورة والرسائل:</label>
            <textarea
              rows={2}
              value={settings.invoiceFooterNote}
              onChange={(e) => setSettings({ ...settings, invoiceFooterNote: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
            />
          </div>
        </div>

        {/* Message Templates */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>4. قوالب رسائل الواتساب والتواصل مع العملاء</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setTemplates(initialMessageTemplates);
                toast.info('تمت استعادة نصوص القوالب الافتراضية، اضغط حفظ لتطبيقها.');
              }}
              className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition-colors self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة القوالب الافتراضية</span>
            </button>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 text-xs text-emerald-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>الرموز الذكية المتاحة للاستخدام داخل القوالب (تُستبدل تلقائياً ببيانات الطلب والعميل):</span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono pt-1">
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{customerName}"} : اسم العميل</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{orderNumber}"} : رقم الطلب</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{targetDate}"} : تاريخ الزيارة</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{targetTime}"} : وقت الفترة</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{permitsCount}"} : عدد التصاريح</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{totalAmount}"} : إجمالي المبلغ</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{paidAmount}"} : المبلغ المدفوع</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{remainingAmount}"} : المتبقي</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{"{currency}"} : العملة</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                أ. رسالة تأكيد الحجز وموعد الزيارة:
              </label>
              <textarea
                rows={7}
                value={templates.confirmationHeader}
                onChange={(e) => setTemplates({ ...templates, confirmationHeader: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono leading-relaxed focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                dir="rtl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                ب. رسالة أكواد وصور التصاريح:
              </label>
              <textarea
                rows={7}
                value={templates.permitCodesHeader}
                onChange={(e) => setTemplates({ ...templates, permitCodesHeader: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono leading-relaxed focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                dir="rtl"
              />
              <p className="text-[11px] text-slate-500">
                ملاحظة: رمز {"{permitCodesList}"} سيُستبدل تلقائياً بأكواد التصاريح وروابط صورها.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                ج. رسالة تأكيد استلام كامل المبلغ (مسدد):
              </label>
              <textarea
                rows={6}
                value={templates.paymentDemandPaid}
                onChange={(e) => setTemplates({ ...templates, paymentDemandPaid: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono leading-relaxed focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                dir="rtl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                د. رسالة المطالبة بالسداد (بانتظار السداد):
              </label>
              <textarea
                rows={6}
                value={templates.paymentDemandPending}
                onChange={(e) => setTemplates({ ...templates, paymentDemandPending: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono leading-relaxed focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                dir="rtl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              هـ. ختام الرسالة والدعاء للعميل:
            </label>
            <input
              type="text"
              value={templates.footerText}
              onChange={(e) => setTemplates({ ...templates, footerText: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              dir="rtl"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold px-7 py-3.5 rounded-2xl text-xs shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'جاري الحفظ في السحابة...' : 'حفظ وتحديث بيانات المؤسسة'}</span>
          </button>
        </div>

      </form>

      {/* أدوات البيانات التجريبية محذوفة من الإنتاج — لا تعيد إضافتها */}

    </div>
  );
};
