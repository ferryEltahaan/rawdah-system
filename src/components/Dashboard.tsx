import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  ShoppingBag,
  MessageSquareCode,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Sparkles,
  Zap,
  Send,
  Copy,
  FileText,
  Banknote,
  Bell
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { currencySymbol, getOrderCurrency } from '../utils/currency';
import { UserProfile, SalesOrder } from '../types';
import { useToast } from './Toast';

interface DashboardProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onNavigate }) => {
  const toast = useToast();
  const [permits, setPermits] = useState(DataService.getPermits());
  const [orders, setOrders] = useState(DataService.getOrders());
  const [customers, setCustomers] = useState(DataService.getCustomers());
  const [sms, setSms] = useState(DataService.getSmsMessages());
  const [logs, setLogs] = useState(DataService.getAuditLogs().slice(0, 6));

  const refreshData = () => {
    setPermits(DataService.getPermits());
    setOrders(DataService.getOrders());
    setCustomers(DataService.getCustomers());
    setSms(DataService.getSmsMessages());
    setLogs(DataService.getAuditLogs().slice(0, 6));
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

  const availablePermits = permits.filter(p => p.status === 'available').length;
  const assignedPermits = permits.filter(p => p.status === 'assigned').length;
  const unmatchedSms = sms.filter(s => s.status === 'unmatched').length;

  // المبالغ المحصلة مقسمة حسب العملة — الأرشيف يبقى محتسباً في التحصيل التاريخي
  const paidByCurrency = { SAR: 0, EGP: 0 };
  orders.forEach(o => { paidByCurrency[getOrderCurrency(o)] += o.paidAmount; });

  const activeOrdersCount = orders.filter(o => !o.isArchived).length;
  const archivedOrdersCount = orders.length - activeOrdersCount;

  // إحصاءات حية لفترات اليوم الحالي (بتوقيت الرياض) من بيانات المخزون الفعلية
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const liveSlots = React.useMemo(() => {
    const slotMap = new Map<string, { slot: string; label: string; sortKey: number; total: number; available: number }>();
    permits
      .filter(p => p.slotDate === todayStr)
      .forEach(p => {
        const key = `${p.slotHour}:${p.slotMinute}`;
        const existing = slotMap.get(key);
        if (existing) {
          existing.total += 1;
          if (p.status === 'available') existing.available += 1;
        } else {
          slotMap.set(key, {
            slot: `${String(p.slotHour).padStart(2, '0')}:${String(p.slotMinute).padStart(2, '0')}`,
            label: new Date(2000, 0, 1, p.slotHour, p.slotMinute).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' }),
            sortKey: p.slotHour * 60 + p.slotMinute,
            total: 1,
            available: p.status === 'available' ? 1 : 0,
          });
        }
      });
    return Array.from(slotMap.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(0, 6);
  }, [permits, todayStr]);

  // === التقرير اليومي للمالك ===
  const [showReportPreview, setShowReportPreview] = useState(false);
  const ownerReport = useMemo(() => DataService.buildOwnerDailyReport(), [orders, permits, sms]);
  // تحصيل اليوم لكل موظف — عشان المالك يحاسب كل واحد على اللي قبضه آخر اليوم
  const collectorsReport = useMemo(() => DataService.getDailyCollectorReport(), [orders, logs]);
  // العملاء غير المسددين — بيظهروا لوحدهم للمتابعة
  const unpaidFollowUp = useMemo(
    () => orders
      .filter(o => !o.isArchived && o.orderStatus !== 'cancelled' && o.remainingAmount > 0)
      .sort((a, b) => (a.targetDate > b.targetDate ? 1 : -1)),
    [orders]
  );

  const handleRemindUnpaid = (order: SalesOrder) => {
    const phone = (order.customerWhatsapp || '').replace(/[^0-9]/g, '');
    if (!phone) {
      toast.warning('لا يوجد رقم واتساب مسجل لهذا العميل.');
      return;
    }
    const cur = getOrderCurrency(order);
    const text = `السلام عليكم ${order.customerName}،
تذكير ودّي بسداد المبلغ المتبقي لطلب تصريح الروضة الشريفة رقم #${order.orderNumber}:

• المبلغ المتبقي: ${order.remainingAmount} ${currencySymbol(cur)}
• موعد الزيارة: ${order.targetDate} الساعة ${order.targetTime}

يرجى إرسال التحويل، وسيتم تأكيد الحجز فور وصوله. تقبل الله زيارتكم وطاعتكم.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    DataService.recordPaymentReminder(order.id);
    refreshData();
    toast.success(order.lastReminderAt ? 'تمت إعادة إرسال تذكير السداد وتسجيله.' : 'تم إرسال تذكير السداد وتسجيله.');
  };
  const riyadhHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', hourCycle: 'h23' }).format(new Date())
  );
  const isReportTime = riyadhHour >= 16;

  const handleSendOwnerReport = () => {
    const url = DataService.getOwnerReportWhatsappUrl();
    if (!url) {
      toast.error('أضف رقم واتساب الشركة أولاً من الإعدادات — هيكون هو رقم استلام التقرير.');
      return;
    }
    window.open(url, '_blank');
  };

  const handleCopyOwnerReport = async () => {
    try {
      await navigator.clipboard.writeText(ownerReport.text);
      toast.success('تم نسخ نص التقرير — الصقه في أي محادثة واتساب.');
    } catch {
      toast.error('تعذر النسخ من المتصفح.');
    }
  };

  return (
    <div className="space-y-6">

      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 border border-emerald-700/40 rounded-3xl p-6 md:p-8 shadow-lg text-white">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-emerald-100 border border-white/20 text-xs px-3.5 py-1 rounded-full font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>نظام التشغيل وإدارة تصاريح الروضة الشريفة</span>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            أهلاً بك، <span className="text-amber-300">{currentUser.fullName}</span> 👋
          </h2>
          
          <p className="text-xs md:text-sm text-emerald-50 leading-relaxed">
            النظام يعمل بكفاءة مع التوقيت المعتمد (Asia/Riyadh). تتبع الفترات الزمنية بدقة 20 دقيقة، واقفل التصاريح لمنع التعارض مع الموظفين.
          </p>
        </div>

        {/* Decorative background circle */}
        <div className="absolute left-[-20px] top-[-20px] bottom-[-20px] w-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Available Permits */}
        <div 
          onClick={() => onNavigate('permits')}
          className="bg-white border border-slate-200 hover:border-emerald-500/50 p-5 rounded-3xl cursor-pointer transition-all hover:shadow-md group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">التصاريح المتاحة للحجز</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 group-hover:scale-110 transition-transform">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-700 mb-1">
            {availablePermits}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>من إجمالي {permits.length} تصريح</span>
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">فتح المخزون <ArrowUpRight className="w-3 h-3" /></span>
          </div>
        </div>

        {/* Orders */}
        <div 
          onClick={() => onNavigate('orders')}
          className="bg-white border border-slate-200 hover:border-blue-500/50 p-5 rounded-3xl cursor-pointer transition-all hover:shadow-md group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">إجمالي الطلبات والمبيعات</span>
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-blue-700 mb-1">
            {orders.length}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>{activeOrdersCount} نشط{archivedOrdersCount > 0 ? ` • ${archivedOrdersCount} مؤرشف` : ''}</span>
            <span className="text-blue-700 font-bold flex items-center gap-0.5">عرض الطلبات <ArrowUpRight className="w-3 h-3" /></span>
          </div>
        </div>

        {/* SMS Pending Matches */}
        <div 
          onClick={() => onNavigate('sms')}
          className="bg-white border border-slate-200 hover:border-amber-500/50 p-5 rounded-3xl cursor-pointer transition-all hover:shadow-md group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">رسائل SMS بانتظار السداد</span>
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 group-hover:scale-110 transition-transform">
              <MessageSquareCode className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-amber-700 mb-1">
            {unmatchedSms}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>تحويلات واردة جديدة</span>
            <span className="text-amber-700 font-bold flex items-center gap-0.5">مطابقة وسداد <ArrowUpRight className="w-3 h-3" /></span>
          </div>
        </div>

        {/* Total Collected Revenue */}
        <div 
          onClick={() => onNavigate('accounts')}
          className="bg-white border border-slate-200 hover:border-emerald-500/50 p-5 rounded-3xl cursor-pointer transition-all hover:shadow-md group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">إجمالي المبالغ المحصلة</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mb-1 flex items-baseline gap-1 flex-wrap">
            {paidByCurrency.SAR.toLocaleString()} <span className="text-xs font-normal text-emerald-700 font-bold">ر.س</span>
            {paidByCurrency.EGP > 0 && (
              <>
                <span className="text-slate-300 text-sm mx-0.5">+</span>
                {paidByCurrency.EGP.toLocaleString()} <span className="text-xs font-normal text-amber-700 font-bold">ج.م</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>عبر المحافظ والبنوك</span>
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">كشف الحسابات <ArrowUpRight className="w-3 h-3" /></span>
          </div>
        </div>

      </div>

      {/* التقرير اليومي للمالك — ملخص اليوم على واتساب من غير فتح النظام */}
      <div className={`rounded-3xl border p-5 shadow-sm space-y-4 ${isReportTime ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${isReportTime ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">التقرير اليومي للمالك</h3>
              <p className="text-[11px] text-slate-500">
                ملخص اليوم جاهز للإرسال على واتساب — {isReportTime ? 'وقت الإرسال المثالي آخر اليوم' : `يظهر التنبيه تلقائياً بعد الساعة 4 عصراً بتوقيت الرياض (الآن ${riyadhHour}:00)`}
              </p>
            </div>
          </div>
          {isReportTime && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full self-start sm:self-auto">
              ⏰ وقت مراجعة وإرسال تقرير اليوم
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
            <div className="text-[10px] font-bold text-blue-700 mb-1">حجز اليوم</div>
            <div className="text-lg font-black font-mono text-blue-900">
              {orders.filter(o => o.targetDate === todayStr && o.orderStatus !== 'cancelled').length} طلب
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="text-[10px] font-bold text-emerald-700 mb-1">تحصيل اليوم (رسائل مطابقة)</div>
            <div className="text-lg font-black font-mono text-emerald-900">
              {sms.filter(m => m.status === 'matched' && new Date(m.receivedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }) === todayStr).length} رسالة
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
            <div className="text-[10px] font-bold text-rose-700 mb-1">متأخرات السداد</div>
            <div className="text-lg font-black font-mono text-rose-900">
              {orders.filter(o => !o.isArchived && o.orderStatus !== 'cancelled' && o.remainingAmount > 0 && o.targetDate < todayStr).length} طلب
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-600 mb-1">تصاريح متاحة</div>
            <div className="text-lg font-black font-mono text-slate-900">{availablePermits}</div>
          </div>
        </div>

        {/* تحصيل اليوم لكل موظف — المالك يحاسب كل واحد على اللي قبضه وعلى شغله */}
        {collectorsReport.length > 0 && (
          <div className="bg-white/70 border border-slate-200 rounded-2xl p-3 space-y-2">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              تحصيل اليوم لكل موظف — عشان تحاسبهم آخر اليوم
            </div>
            <div className="space-y-1.5">
              {collectorsReport.map(c => (
                <div key={c.userId} className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate">{c.userName}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{c.paymentsCount} سداد · سحب {c.permitsClaimed} تصريح{c.ordersCreated ? ` · أنشأ ${c.ordersCreated} طلب` : ''}</span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-700 shrink-0">
                    {[c.collectedSAR > 0 && `${c.collectedSAR.toLocaleString('en-US')} ر.س`, c.collectedEGP > 0 && `${c.collectedEGP.toLocaleString('en-US')} ج.م`].filter(Boolean).join(' + ') || 'بدون تحصيل'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showReportPreview && (
          <pre className="bg-slate-900 text-emerald-200 rounded-2xl p-4 text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto" dir="rtl">
            {ownerReport.text}
          </pre>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSendOwnerReport}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Send className="w-4 h-4" />
            إرسال للمالك على واتساب
          </button>
          <button
            onClick={handleCopyOwnerReport}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Copy className="w-4 h-4" />
            نسخ النص
          </button>
          <button
            onClick={() => setShowReportPreview(v => !v)}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 underline"
          >
            {showReportPreview ? 'إخفاء المعاينة' : 'معاينة نص التقرير'}
          </button>
        </div>
      </div>

      {/* عملاء غير مسددين — بيظهروا لوحدهم للمتابعة بضغطة تذكير */}
      {unpaidFollowUp.length > 0 && (
        <div className="rounded-3xl border p-5 shadow-sm space-y-3 bg-white border-rose-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">عملاء غير مسددين — للمتابعة</h3>
                <p className="text-[11px] text-slate-500">{unpaidFollowUp.length} طلب به مبلغ متبقي — تذكير سداد لكل عميل بضغطة</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline shrink-0"
            >
              الذهاب للطلبات
            </button>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {unpaidFollowUp.map(o => {
              const cur = getOrderCurrency(o);
              return (
                <div key={o.id} className="flex items-center justify-between gap-2 bg-rose-50/50 border border-rose-100 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {o.customerName} <span className="text-slate-400 font-mono">#{o.orderNumber}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      متبقي <span className="font-mono font-bold text-rose-700">{o.remainingAmount} {currencySymbol(cur)}</span> · موعد {o.targetDate}
                      {o.lastReminderAt && ` · آخر تذكير ${new Date(o.lastReminderAt).toLocaleDateString('ar-EG', { timeZone: 'Asia/Riyadh' })}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemindUnpaid(o)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-bold transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    تذكير سداد
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Start Onboarding Guide for New Setup / Operations */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 border border-slate-700/60 rounded-3xl p-6 shadow-xl text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">دليل التشغيل السريع وخط سير النظام</h3>
              <p className="text-[11px] text-slate-300">أربع خطوات أساسية لتشغيل دورة العمل الحية اليومية بكفاءة تامة</p>
            </div>
          </div>
          <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full self-start sm:self-auto">
            جاهزية النظام: {((permits.length > 0 ? 1 : 0) + (orders.length > 0 ? 1 : 0) + (customers.length > 0 ? 1 : 0) + 1) * 25}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Step 1: Accounts */}
          <div 
            onClick={() => onNavigate('accounts')}
            className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 cursor-pointer transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 font-mono">01</span>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">الخزائن</span>
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">تهيئة المحافظ والبنوك</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">إضافة أرقام فودافون كاش، إنستاباي، وحسابات الراجحي لاستقبال التحويلات.</p>
          </div>

          {/* Step 2: Permits */}
          <div 
            onClick={() => onNavigate('permits')}
            className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 cursor-pointer transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 font-mono">02</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${permits.length > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
                {permits.length > 0 ? `✓ ${permits.length} تصريح` : 'مطلوب'}
              </span>
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">رفع مخزون الفترات</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">رفع وتغذية تصاريح الروضة لفترات اليوم الـ 24 ساعة (رجال / نساء).</p>
          </div>

          {/* Step 3: Orders */}
          <div 
            onClick={() => onNavigate('orders')}
            className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 cursor-pointer transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 font-mono">03</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${orders.length > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
                {orders.length > 0 ? `✓ ${orders.length} طلب` : 'مطلوب'}
              </span>
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">إنشاء حجوزات المعتمرين</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">تسجيل بيانات المعتمر، اختيار الفترة، وحجز وقفل التصاريح فوراً.</p>
          </div>

          {/* Step 4: SMS Forwarder */}
          <div 
            onClick={() => onNavigate('sms')}
            className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/50 cursor-pointer transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 font-mono">04</span>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">محرك آلي</span>
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">مطابقة السداد والترحيل</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">استقبال رسائل SMS ومطابقتها آلياً لتأكيد الحجز وتغذية الخزائن.</p>
          </div>
        </div>
      </div>

      {/* Quick Visual Slots Preview & Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Quick Time Slots Overview */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">حالة مخزون فترات اليوم (بيانات حية)</h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
              {todayStr}
            </span>
          </div>

          {liveSlots.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-xs text-slate-500 font-medium">لا توجد تصاريح مرفوعة بمخزون اليوم بعد.</p>
              <button
                onClick={() => onNavigate('permits')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
              >
                الانتقال لرفع تصاريح اليوم
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {liveSlots.map(s => {
                const availablePct = s.total > 0 ? Math.round((s.available / s.total) * 100) : 0;
                return (
                  <div
                    key={s.slot}
                    onClick={() => onNavigate('permits')}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-50/50 cursor-pointer transition-all text-right"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-emerald-800 text-sm">{s.slot}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        s.available > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {s.available} متاح
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mb-2">{s.label} — من أصل {s.total}</div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${availablePct > 30 ? 'bg-emerald-500' : availablePct > 0 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${availablePct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Latest Real-time Activity Timeline */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">أحدث العمليات وسجل الحركات</h3>
            </div>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs font-bold text-amber-700 hover:text-amber-800"
            >
              عرض السجل
            </button>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{log.userName}: </span>
                  <span className="text-slate-600 font-mono text-[11px]">{log.actionType}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(log.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
