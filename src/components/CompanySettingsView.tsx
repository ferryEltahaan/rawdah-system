import React, { useState } from 'react';
import {
  Building,
  Save,
  CheckCircle2,
  Loader2,
  Database,
  Sparkles,
  Trash2,
  CalendarCheck
} from 'lucide-react';
import { CompanySettings } from '../types';
import { DataService } from '../services/dataService';
import { useToast } from './Toast';
import { ImageUploadField } from './ImageUploadField';
import confetti from 'canvas-confetti';

// أدوات البذر والمسح متاحة في وضع التطوير فقط أو عند تفعيلها صراحةً بمتغير البيئة
const showDemoTools = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_TOOLS === 'true';

const CURRENCY_OPTIONS = [
  { code: 'SAR', label: 'ريال سعودي (ر.س)' },
  { code: 'EGP', label: 'جنيه مصري (ج.م)' },
  { code: 'USD', label: 'دولار أمريكي ($)' },
  { code: 'AED', label: 'درهم إماراتي (د.إ)' },
];

export const CompanySettingsView: React.FC = () => {
  const toast = useToast();
  const [settings, setSettings] = useState<CompanySettings>(DataService.getCompanySettings());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSeedingScenario, setIsSeedingScenario] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const handleGenerateDemo = async () => {
    const ok = await toast.confirm(
      'سيتم مسح جميع البيانات الحالية (العملاء، الطلبات، التصاريح، الرسائل، السجلات) وتوليد بيانات حية واقعية جديدة بالكامل ومزامنتها مع السحابة.',
      { title: 'توليد تجربة حية شاملة', confirmLabel: 'مسح وتوليد الآن' }
    );
    if (!ok) return;

    setIsGenerating(true);
    try {
      const result = await DataService.seedLiveDemo();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      toast.success(
        `تم توليد التجربة الحية بنجاح: ${result.permits} تصريحاً، ${result.orders} طلبات، ${result.customers} عملاء، ${result.sms} رسائل، ${result.accounts} حسابات مالية`
      );
      window.dispatchEvent(new Event('rawdah_storage_update'));
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء توليد البيانات التجريبية، راجع وحدة التحكم.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSeedDailyScenario = async () => {
    const ok = await toast.confirm(
      'سيتم إعداد سيناريو السداد اليومي المخصص (10 عملاء بطلبات اليوم مستحقة السداد بالجنيه والريال)، مع نصوص رسائل SMS جاهزة للاختبار.',
      { title: 'توليد سيناريو السداد اليومي', confirmLabel: 'تجهيز السيناريو الآن' }
    );
    if (!ok) return;

    setIsSeedingScenario(true);
    try {
      const result = await DataService.seedDailyPaymentScenario();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
      toast.success(`تم تجهيز سيناريو السداد اليومي: ${result.orders} طلبات، ${result.customers} عملاء، وجاهز في صندوق الرسائل.`);
      window.dispatchEvent(new Event('rawdah_storage_update'));
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تجهيز سيناريو السداد.');
    } finally {
      setIsSeedingScenario(false);
    }
  };

  const handleWipeAll = async () => {
    const ok = await toast.confirm(
      'سيتم مسح جميع البيانات نهائياً (العملاء، الطلبات، التصاريح، الرسائل، السجلات) من الجهاز والسحابة.\nهذا الإجراء لا يمكن التراجع عنه.',
      { title: 'مسح جميع البيانات نهائياً', confirmLabel: 'نعم، امسح نهائياً', danger: true }
    );
    if (!ok) return;

    setIsWiping(true);
    try {
      await DataService.wipeAllData();
      toast.success('تم مسح جميع البيانات بنجاح من الجهاز والسحابة.');
      window.dispatchEvent(new Event('rawdah_storage_update'));
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء مسح البيانات، راجع وحدة التحكم.');
    } finally {
      setIsWiping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const { localSaved } = await DataService.updateCompanySettings(settings);

    setIsSaving(false);
    // عند فشل الحفظ المحلي (امتلاء المساحة) تظهر رسالة الخطأ من مستمع أخطاء التخزين
    if (!localSaved) return;

    confetti({ particleCount: 35, spread: 60 });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-4 py-2 rounded-2xl flex items-center gap-2 font-bold animate-in fade-in shadow-sm">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Data Management & Live Demo (وضع التطوير فقط) */}
      {showDemoTools && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>إدارة البيانات والتجربة الحية</span>
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              توليد مجموعة بيانات واقعية متكاملة (عملاء، تصاريح، طلبات، رسائل بنكية، حسابات، سجلات) لاختبار النظام بشكل كامل، أو مسح جميع البيانات نهائياً.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleGenerateDemo}
              disabled={isGenerating || isSeedingScenario || isWiping}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-4 py-3 rounded-2xl text-xs shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? 'جاري التوليد...' : 'توليد تجربة شاملة'}</span>
            </button>

            <button
              type="button"
              onClick={handleSeedDailyScenario}
              disabled={isGenerating || isSeedingScenario || isWiping}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-4 py-3 rounded-2xl text-xs shadow-md shadow-teal-700/20 hover:shadow-lg transition-all"
            >
              {isSeedingScenario ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
              <span>{isSeedingScenario ? 'جاري الإعداد...' : 'سيناريو السداد اليومي (10 عملاء)'}</span>
            </button>

            <button
              type="button"
              onClick={handleWipeAll}
              disabled={isGenerating || isSeedingScenario || isWiping}
              className="flex items-center justify-center gap-2 bg-white border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-60 disabled:cursor-not-allowed font-bold px-4 py-3 rounded-2xl text-xs transition-all"
            >
              {isWiping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{isWiping ? 'جاري المسح...' : 'مسح البيانات نهائياً'}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
