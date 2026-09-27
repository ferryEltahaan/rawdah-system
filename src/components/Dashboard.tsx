import React, { useState, useEffect } from 'react';
import { 
  Ticket, 
  ShoppingBag, 
  MessageSquareCode, 
  TrendingUp, 
  Clock, 
  ArrowUpRight, 
  Sparkles,
  Zap
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { currencySymbol, getOrderCurrency } from '../utils/currency';
import { UserProfile } from '../types';

interface DashboardProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onNavigate }) => {
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
