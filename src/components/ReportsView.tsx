import React, { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, Users, Wallet, Ticket,
  Calendar, Download, RefreshCw, Clock, UserCheck,
  AlertCircle, CheckCircle2, XCircle, ChevronDown, Filter,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { UserProfile } from '../types';
import { currencySymbol } from '../utils/currency';
import { downloadCsv } from '../utils/csvHelpers';

interface ReportsViewProps {
  currentUser: UserProfile;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

function startOf(range: DateRange, from?: string): string {
  const now = new Date();
  if (range === 'today') return todayStr();
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  }
  if (range === 'month') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return from ?? todayStr();
}

function inRange(dateStr: string, from: string, to: string): boolean {
  return dateStr >= from && dateStr <= to;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtNum(n: number): string {
  return n.toLocaleString('ar-SA');
}

// مخطط عمودي بسيط بـ CSS خالص
function BarChartSimple({ data, maxVal, color = '#059669' }: {
  data: { label: string; value: number }[];
  maxVal: number;
  color?: string;
}) {
  if (data.length === 0) return <div className="text-center text-slate-400 text-xs py-6">لا توجد بيانات</div>;
  return (
    <div className="flex items-end gap-1.5 h-32 w-full overflow-x-auto pb-1">
      {data.map((d, i) => {
        const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
        return (
          <div key={i} className="flex flex-col items-center flex-1 min-w-[28px] gap-1">
            <span className="text-[10px] font-bold text-slate-600">{d.value > 0 ? fmtNum(d.value) : ''}</span>
            <div
              className="w-full rounded-t-lg transition-all duration-500"
              style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: color, opacity: 0.85 + (i % 3) * 0.05 }}
            />
            <span className="text-[9px] text-slate-500 text-center leading-tight w-full">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// بطاقة مؤشر KPI
function KpiCard({ icon, label, value, sub, color, trend }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${color}`}>
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl bg-white/60">{icon}</div>
        {trend === 'up' && <ArrowUpRight className="w-4 h-4 text-emerald-600" />}
        {trend === 'down' && <ArrowDownRight className="w-4 h-4 text-rose-500" />}
        {trend === 'neutral' && <Minus className="w-4 h-4 text-slate-400" />}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-600">{label}</p>
        <p className="text-xl font-black text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUser: _ }) => {
  const [range, setRange] = useState<DateRange>('month');
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const from = range === 'custom' ? customFrom : startOf(range);
  const to = range === 'custom' ? customTo : todayStr();

  const orders = useMemo(() => DataService.getOrders(), []);
  const permits = useMemo(() => DataService.getPermits(), []);
  const users = useMemo(() => DataService.getProfiles(), []);
  const settings = useMemo(() => DataService.getCompanySettings(), []);
  const currency = settings.currency || 'SAR';
  const sym = currencySymbol(currency as any);

  const today = todayStr();

  // ─── 1. تقارير التصاريح المرفوعة ───────────────────────────────────────────
  const permitsToday = permits.filter(p => (p.createdAt || '').slice(0, 10) === today);
  const permitsInRange = permits.filter(p => inRange((p.createdAt || '').slice(0, 10), from, to));
  const permitsThisMonth = permits.filter(p =>
    (p.createdAt || '').slice(0, 7) === today.slice(0, 7)
  );
  const availablePermits = permits.filter(p => p.status === 'available');
  const assignedPermits = permits.filter(p => p.status === 'assigned');
  const expiredPermits = permits.filter(p => p.status === 'expired' || (p.status === 'available' && p.slotDate < today));
  const cancelledPermits = permits.filter(p => p.status === 'cancelled');

  // ─── 2. مبيعات الموظفين ────────────────────────────────────────────────────
  const ordersInRange = orders.filter(o =>
    inRange((o.createdAt || '').slice(0, 10), from, to) && o.orderStatus !== 'cancelled'
  );

  const employeeSales = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number; paid: number; permits: number }> = {};
    ordersInRange.forEach(o => {
      const key = o.createdBy;
      if (!map[key]) map[key] = { name: o.createdBy, count: 0, total: 0, paid: 0, permits: 0 };
      map[key].count++;
      map[key].total += o.totalAmount;
      map[key].paid += o.paidAmount;
      map[key].permits += o.permitsCount;
    });
    // حاول تحسين الاسم من قائمة المستخدمين
    users.forEach((u: any) => {
      if (map[u.id]) map[u.id].name = u.fullName;
      if (map[u.username]) map[u.username].name = u.fullName;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [ordersInRange, users]);

  // ─── 3. التحصيلات اليومية ──────────────────────────────────────────────────
  const dailyCollections = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      (o.payments || []).forEach(pay => {
        const d = (pay.at || '').slice(0, 10);
        if (inRange(d, from, to)) {
          map[d] = (map[d] || 0) + pay.amount;
        }
      });
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  }, [orders, from, to]);

  const totalCollected = dailyCollections.reduce((s, d) => s + d.amount, 0);
  const maxDaily = Math.max(...dailyCollections.map(d => d.amount), 1);

  // ─── 4. أرصدة تحت التحصيل ──────────────────────────────────────────────────
  const pendingOrders = orders
    .filter(o => o.remainingAmount > 0 && o.orderStatus !== 'cancelled')
    .sort((a, b) => b.remainingAmount - a.remainingAmount);
  const totalPending = pendingOrders.reduce((s, o) => s + o.remainingAmount, 0);

  // ─── 5. الأكواد المنتهية وغير المباعة ─────────────────────────────────────
  const unsoldExpired = expiredPermits.filter(p => p.status === 'available' || p.status === 'expired');
  const expiredByDate = useMemo(() => {
    const map: Record<string, number> = {};
    unsoldExpired.forEach(p => {
      const m = (p.slotDate || '').slice(0, 7);
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);
  }, [unsoldExpired]);

  // ─── 6. تحليل الفترات الأكثر بيعاً ────────────────────────────────────────
  const slotAnalysis = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    ordersInRange.forEach(o => {
      const key = o.targetTime || 'غير محدد';
      if (!map[key]) map[key] = { count: 0, amount: 0 };
      map[key].count += o.permitsCount;
      map[key].amount += o.totalAmount;
    });
    return Object.entries(map)
      .map(([time, v]) => ({ time, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [ordersInRange]);
  const maxSlot = Math.max(...slotAnalysis.map(s => s.count), 1);

  // ─── 7. تحليل الذكور والإناث ───────────────────────────────────────────────
  const genderStats = useMemo(() => {
    let male = 0, female = 0, unknown = 0;
    ordersInRange.forEach(o => {
      if ((o.permitsCountMale ?? -1) >= 0 && (o.permitsCountFemale ?? -1) >= 0) {
        male += o.permitsCountMale ?? 0;
        female += o.permitsCountFemale ?? 0;
      } else {
        unknown += o.permitsCount;
      }
    });
    return { male, female, unknown, total: male + female + unknown };
  }, [ordersInRange]);

  const genderPct = (n: number) => genderStats.total > 0 ? Math.round((n / genderStats.total) * 100) : 0;

  // ─── إحصائيات الطلبات في النطاق مقسمة بالعملة ────────────────────────────────
  const revenueByCur = useMemo(() => {
    const map = { SAR: 0, EGP: 0 };
    ordersInRange.forEach(o => {
      const c = (o.currency === 'EGP' ? 'EGP' : 'SAR') as 'SAR' | 'EGP';
      map[c] = Math.round((map[c] + o.totalAmount) * 100) / 100;
    });
    return map;
  }, [ordersInRange]);

  const paidByCur = useMemo(() => {
    const map = { SAR: 0, EGP: 0 };
    ordersInRange.forEach(o => {
      const c = (o.currency === 'EGP' ? 'EGP' : 'SAR') as 'SAR' | 'EGP';
      map[c] = Math.round((map[c] + o.paidAmount) * 100) / 100;
    });
    return map;
  }, [ordersInRange]);

  const remainByCur = useMemo(() => {
    const map = { SAR: 0, EGP: 0 };
    ordersInRange.forEach(o => {
      const c = (o.currency === 'EGP' ? 'EGP' : 'SAR') as 'SAR' | 'EGP';
      map[c] = Math.round((map[c] + o.remainingAmount) * 100) / 100;
    });
    return map;
  }, [ordersInRange]);

  const ordersRevenue = ordersInRange.reduce((s, o) => s + o.totalAmount, 0);
  const ordersPaid = ordersInRange.reduce((s, o) => s + o.paidAmount, 0);
  const ordersRemain = Math.max(0, ordersRevenue - ordersPaid);
  const ordersPermits = ordersInRange.reduce((s, o) => s + o.permitsCount, 0);

  const formatMultiCur = (map: { SAR: number; EGP: number }) => {
    const parts: string[] = [];
    if (map.SAR > 0 || (map.SAR === 0 && map.EGP === 0)) {
      parts.push(`${fmtNum(map.SAR)} ر.س`);
    }
    if (map.EGP > 0) {
      parts.push(`${fmtNum(map.EGP)} ج.م`);
    }
    return parts.join(' + ');
  };

  // ─── تصدير CSV ─────────────────────────────────────────────────────────────
  const exportEmployeeSales = () => {
    downloadCsv(
      `مبيعات_الموظفين_${from}_${to}.csv`,
      ['الموظف', 'عدد الطلبات', 'عدد التصاريح', 'إجمالي المبيعات', 'المحصّل', 'المتبقي'],
      employeeSales.map(e => [e.name, e.count, e.permits, e.total, e.paid, e.total - e.paid]),
      [1, 2, 3, 4, 5]
    );
  };

  const exportPending = () => {
    downloadCsv(
      `أرصدة_تحت_التحصيل_${today}.csv`,
      ['رقم الطلب', 'العميل', 'الواتساب', 'الإجمالي', 'المسدد', 'المتبقي', 'تاريخ الطلب'],
      pendingOrders.map(o => [o.orderNumber, o.customerName, o.customerWhatsapp, o.totalAmount, o.paidAmount, o.remainingAmount, o.createdAt?.slice(0, 10)]),
      [0, 3, 4, 5]
    );
  };

  const rangeLabels: Record<DateRange, string> = {
    today: 'اليوم',
    week: 'آخر 7 أيام',
    month: 'هذا الشهر',
    custom: 'فترة مخصصة',
  };

  const sections = [
    { id: 'permits', label: '📋 تقارير التصاريح المرفوعة' },
    { id: 'employees', label: '👷 مبيعات الموظفين' },
    { id: 'collections', label: '💰 التحصيلات اليومية' },
    { id: 'pending', label: '⏳ أرصدة تحت التحصيل' },
    { id: 'expired', label: '❌ الأكواد المنتهية وغير المباعة' },
    { id: 'slots', label: '🕐 تحليل الفترات الأكثر بيعاً' },
    { id: 'gender', label: '👥 تحليل الذكور والإناث' },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            التقارير والتحليلات
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">تقارير شاملة لأداء المبيعات والتصاريح والتحصيلات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['today', 'week', 'month', 'custom'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                range === r
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range */}
      {range === 'custom' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-emerald-600" />
          <label className="text-xs font-bold text-slate-700">من:</label>
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
          />
          <label className="text-xs font-bold text-slate-700">إلى:</label>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
          />
          <span className="text-[11px] text-slate-500">الفترة: {from} ← {to}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
          label="إجمالي المبيعات"
          value={formatMultiCur(revenueByCur)}
          sub={`${ordersInRange.length} طلب`}
          color="bg-emerald-50 border-emerald-200"
          trend="up"
        />
        <KpiCard
          icon={<Wallet className="w-4 h-4 text-blue-600" />}
          label="المحصّل"
          value={formatMultiCur(paidByCur)}
          sub={`إجمالي السداد المعتمد`}
          color="bg-blue-50 border-blue-200"
          trend="up"
        />
        <KpiCard
          icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
          label="تحت التحصيل"
          value={formatMultiCur(remainByCur)}
          sub={`${pendingOrders.length} طلب`}
          color="bg-amber-50 border-amber-200"
          trend={(remainByCur.SAR > 0 || remainByCur.EGP > 0) ? 'down' : 'neutral'}
        />
        <KpiCard
          icon={<Ticket className="w-4 h-4 text-violet-600" />}
          label="التصاريح المباعة"
          value={fmtNum(ordersPermits)}
          sub={`من ${fmtNum(permits.length)} إجمالي`}
          color="bg-violet-50 border-violet-200"
          trend="up"
        />
      </div>

      {/* Sections */}
      {sections.map(sec => (
        <div key={sec.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveSection(activeSection === sec.id ? null : sec.id)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm font-black text-slate-800">{sec.label}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${activeSection === sec.id ? 'rotate-180' : ''}`} />
          </button>

          {activeSection === sec.id && (
            <div className="border-t border-slate-100 p-5">

              {/* ── Section 1: التصاريح ── */}
              {sec.id === 'permits' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <KpiCard icon={<Calendar className="w-4 h-4 text-emerald-600" />} label="مرفوع اليوم" value={fmtNum(permitsToday.length)} color="bg-emerald-50 border-emerald-200" />
                    <KpiCard icon={<Calendar className="w-4 h-4 text-blue-600" />} label="مرفوع هذا الشهر" value={fmtNum(permitsThisMonth.length)} color="bg-blue-50 border-blue-200" />
                    <KpiCard icon={<Calendar className="w-4 h-4 text-violet-600" />} label="في الفترة المختارة" value={fmtNum(permitsInRange.length)} color="bg-violet-50 border-violet-200" />
                    <KpiCard icon={<Ticket className="w-4 h-4 text-slate-600" />} label="إجمالي المرفوع" value={fmtNum(permits.length)} color="bg-slate-50 border-slate-200" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                      <p className="text-xs font-bold text-emerald-700">متاح</p>
                      <p className="text-2xl font-black text-emerald-800">{fmtNum(availablePermits.length)}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
                      <p className="text-xs font-bold text-blue-700">محجوز</p>
                      <p className="text-2xl font-black text-blue-800">{fmtNum(assignedPermits.length)}</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-center">
                      <p className="text-xs font-bold text-rose-700">منتهي/ملغي</p>
                      <p className="text-2xl font-black text-rose-800">{fmtNum(expiredPermits.length + cancelledPermits.length)}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                      <p className="text-xs font-bold text-amber-700">نسبة البيع</p>
                      <p className="text-2xl font-black text-amber-800">
                        {permits.length > 0 ? Math.round((assignedPermits.length / permits.length) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 2: مبيعات الموظفين ── */}
              {sec.id === 'employees' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">الفترة: {from} إلى {to}</p>
                    <button onClick={exportEmployeeSales} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors">
                      <Download className="w-3.5 h-3.5" /> تصدير CSV
                    </button>
                  </div>
                  {employeeSales.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">لا توجد مبيعات في هذه الفترة</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-right p-3 font-bold text-slate-700">#</th>
                            <th className="text-right p-3 font-bold text-slate-700">الموظف</th>
                            <th className="text-right p-3 font-bold text-slate-700">الطلبات</th>
                            <th className="text-right p-3 font-bold text-slate-700">التصاريح</th>
                            <th className="text-right p-3 font-bold text-slate-700">إجمالي المبيعات</th>
                            <th className="text-right p-3 font-bold text-slate-700">المحصّل</th>
                            <th className="text-right p-3 font-bold text-slate-700">المتبقي</th>
                            <th className="text-right p-3 font-bold text-slate-700">نسبة التحصيل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeSales.map((e, i) => {
                            const remain = e.total - e.paid;
                            const pct = e.total > 0 ? Math.round((e.paid / e.total) * 100) : 0;
                            return (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                                <td className="p-3 font-bold text-slate-800">{e.name}</td>
                                <td className="p-3 text-center">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">{e.count}</span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className="bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full font-bold">{e.permits}</span>
                                </td>
                                <td className="p-3 font-bold text-slate-800">{fmtNum(e.total)} {sym}</td>
                                <td className="p-3 font-bold text-emerald-700">{fmtNum(e.paid)} {sym}</td>
                                <td className="p-3 font-bold text-rose-600">{remain > 0 ? `${fmtNum(remain)} ${sym}` : '-'}</td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="font-bold text-slate-700 text-[10px]">{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-100">
                          <tr>
                            <td colSpan={2} className="p-3 font-black text-slate-800">المجموع</td>
                            <td className="p-3 text-center font-black text-slate-800">{ordersInRange.length}</td>
                            <td className="p-3 text-center font-black text-slate-800">{ordersPermits}</td>
                            <td className="p-3 font-black text-slate-800">{fmtNum(ordersRevenue)} {sym}</td>
                            <td className="p-3 font-black text-emerald-700">{fmtNum(ordersPaid)} {sym}</td>
                            <td className="p-3 font-black text-rose-600">{ordersRemain > 0 ? `${fmtNum(ordersRemain)} ${sym}` : '-'}</td>
                            <td className="p-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Section 3: التحصيلات اليومية ── */}
              {sec.id === 'collections' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <KpiCard icon={<Wallet className="w-4 h-4 text-emerald-600" />} label="إجمالي المحصّل في الفترة" value={`${fmtNum(totalCollected)} ${sym}`} color="bg-emerald-50 border-emerald-200" />
                    <KpiCard icon={<Calendar className="w-4 h-4 text-blue-600" />} label="عدد أيام التحصيل" value={fmtNum(dailyCollections.length)} sub="يوم فيه تحصيل" color="bg-blue-50 border-blue-200" />
                  </div>
                  {dailyCollections.length > 0 ? (
                    <>
                      <p className="text-[11px] font-bold text-slate-600">التحصيلات اليومية (أحدث 30 يوم):</p>
                      <BarChartSimple
                        data={dailyCollections.slice(-30).map(d => ({
                          label: d.date.slice(5),
                          value: d.amount,
                        }))}
                        maxVal={maxDaily}
                        color="#059669"
                      />
                      <div className="overflow-x-auto max-h-56">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-white">
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-right p-2 font-bold text-slate-700">التاريخ</th>
                              <th className="text-right p-2 font-bold text-slate-700">المحصّل</th>
                              <th className="text-left p-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...dailyCollections].reverse().map((d, i) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-2 font-mono text-slate-700">{fmtDate(d.date)}</td>
                                <td className="p-2 font-bold text-emerald-700">{fmtNum(d.amount)} {sym}</td>
                                <td className="p-2">
                                  <div className="w-24 bg-slate-200 rounded-full h-1.5">
                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(d.amount / maxDaily) * 100}%` }} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-400 text-xs py-8">لا توجد تحصيلات مسجلة في هذه الفترة</div>
                  )}
                </div>
              )}

              {/* ── Section 4: أرصدة تحت التحصيل ── */}
              {sec.id === 'pending' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-rose-700">{fmtNum(totalPending)} {sym}</span>
                      <span className="text-[11px] text-slate-500">إجمالي تحت التحصيل ({pendingOrders.length} طلب)</span>
                    </div>
                    <button onClick={exportPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition-colors">
                      <Download className="w-3.5 h-3.5" /> تصدير CSV
                    </button>
                  </div>
                  {pendingOrders.length === 0 ? (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700">ممتاز! لا توجد أرصدة متبقية غير محصّلة.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white">
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-right p-2.5 font-bold text-slate-700">#طلب</th>
                            <th className="text-right p-2.5 font-bold text-slate-700">العميل</th>
                            <th className="text-right p-2.5 font-bold text-slate-700">الإجمالي</th>
                            <th className="text-right p-2.5 font-bold text-slate-700">المسدد</th>
                            <th className="text-right p-2.5 font-bold text-slate-700">المتبقي</th>
                            <th className="text-right p-2.5 font-bold text-slate-700">تاريخ الطلب</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingOrders.map((o, i) => (
                            <tr key={o.id} className={`border-b border-slate-100 hover:bg-rose-50 transition-colors ${i < 3 ? 'bg-rose-50/40' : ''}`}>
                              <td className="p-2.5 font-mono font-bold text-slate-700">#{o.orderNumber}</td>
                              <td className="p-2.5 font-semibold text-slate-800">{o.customerName}</td>
                              <td className="p-2.5 text-slate-700">{fmtNum(o.totalAmount)} {sym}</td>
                              <td className="p-2.5 text-emerald-700 font-bold">{fmtNum(o.paidAmount)} {sym}</td>
                              <td className="p-2.5 text-rose-700 font-black">{fmtNum(o.remainingAmount)} {sym}</td>
                              <td className="p-2.5 text-slate-500 font-mono">{o.createdAt?.slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Section 5: الأكواد المنتهية وغير المباعة ── */}
              {sec.id === 'expired' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-center">
                      <XCircle className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-rose-700">أكواد منتهية/ملغية</p>
                      <p className="text-2xl font-black text-rose-800">{fmtNum(unsoldExpired.length)}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                      <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-amber-700">ملغية</p>
                      <p className="text-2xl font-black text-amber-800">{fmtNum(cancelledPermits.length)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                      <Ticket className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-700">نسبة الهدر</p>
                      <p className="text-2xl font-black text-slate-800">
                        {permits.length > 0 ? Math.round((unsoldExpired.length / permits.length) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                  {expiredByDate.length > 0 && (
                    <>
                      <p className="text-[11px] font-bold text-slate-600">توزيع الأكواد المنتهية حسب الشهر:</p>
                      <BarChartSimple
                        data={expiredByDate.map(([m, c]) => ({ label: m.slice(5), value: c }))}
                        maxVal={Math.max(...expiredByDate.map(([, c]) => c), 1)}
                        color="#f43f5e"
                      />
                    </>
                  )}
                  {unsoldExpired.length === 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700">لا توجد أكواد منتهية غير مباعة.</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Section 6: تحليل الفترات ── */}
              {sec.id === 'slots' && (
                <div className="space-y-4">
                  <p className="text-[11px] text-slate-500">عدد التصاريح المباعة لكل فترة زمنية في الفترة المختارة</p>
                  {slotAnalysis.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">لا توجد بيانات</div>
                  ) : (
                    <>
                      <BarChartSimple
                        data={slotAnalysis.slice(0, 12).map(s => ({ label: s.time, value: s.count }))}
                        maxVal={maxSlot}
                        color="#7c3aed"
                      />
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-right p-2.5 font-bold text-slate-700">الفترة</th>
                              <th className="text-right p-2.5 font-bold text-slate-700">عدد التصاريح</th>
                              <th className="text-right p-2.5 font-bold text-slate-700">إجمالي القيمة</th>
                              <th className="text-left p-2.5 font-bold text-slate-700">النسبة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slotAnalysis.map((s, i) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-violet-50 transition-colors">
                                <td className="p-2.5 font-mono font-black text-violet-800 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" />{s.time}
                                </td>
                                <td className="p-2.5 font-bold text-slate-800">{fmtNum(s.count)}</td>
                                <td className="p-2.5 text-emerald-700 font-bold">{fmtNum(s.amount)} {sym}</td>
                                <td className="p-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                      <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${(s.count / maxSlot) * 100}%` }} />
                                    </div>
                                    <span className="text-[10px] font-bold text-violet-700">
                                      {ordersPermits > 0 ? Math.round((s.count / ordersPermits) * 100) : 0}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Section 7: الذكور والإناث ── */}
              {sec.id === 'gender' && (
                <div className="space-y-4">
                  {genderStats.total === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">لا توجد بيانات في هذه الفترة</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
                          <p className="text-2xl font-black text-blue-800">{fmtNum(genderStats.male)}</p>
                          <p className="text-xs font-bold text-blue-600 mt-1">👨 ذكور</p>
                          <p className="text-[11px] text-blue-500">{genderPct(genderStats.male)}%</p>
                        </div>
                        <div className="rounded-xl bg-pink-50 border border-pink-200 p-4 text-center">
                          <p className="text-2xl font-black text-pink-800">{fmtNum(genderStats.female)}</p>
                          <p className="text-xs font-bold text-pink-600 mt-1">👩 إناث</p>
                          <p className="text-[11px] text-pink-500">{genderPct(genderStats.female)}%</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                          <p className="text-2xl font-black text-slate-700">{fmtNum(genderStats.unknown)}</p>
                          <p className="text-xs font-bold text-slate-500 mt-1">غير محدد</p>
                          <p className="text-[11px] text-slate-400">{genderPct(genderStats.unknown)}%</p>
                        </div>
                      </div>

                      {/* Progress bar gender */}
                      <div className="space-y-2">
                        <div className="flex h-6 rounded-xl overflow-hidden">
                          {genderStats.male > 0 && (
                            <div
                              className="bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold transition-all"
                              style={{ width: `${genderPct(genderStats.male)}%` }}
                            >
                              {genderPct(genderStats.male) > 10 ? `${genderPct(genderStats.male)}% ذكور` : ''}
                            </div>
                          )}
                          {genderStats.female > 0 && (
                            <div
                              className="bg-pink-400 flex items-center justify-center text-[10px] text-white font-bold transition-all"
                              style={{ width: `${genderPct(genderStats.female)}%` }}
                            >
                              {genderPct(genderStats.female) > 10 ? `${genderPct(genderStats.female)}% إناث` : ''}
                            </div>
                          )}
                          {genderStats.unknown > 0 && (
                            <div
                              className="bg-slate-300 flex items-center justify-center text-[10px] text-slate-600 font-bold transition-all"
                              style={{ width: `${genderPct(genderStats.unknown)}%` }}
                            >
                              {genderPct(genderStats.unknown) > 10 ? `${genderPct(genderStats.unknown)}% غير محدد` : ''}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> ذكور</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-400 inline-block" /> إناث</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-300 inline-block" /> غير محدد</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
                        💡 <strong>ملاحظة:</strong> الطلبات التي تظهر كـ «غير محدد» لم يُسجَّل فيها عدد الذكور والإناث بشكل منفصل.
                        يمكن تحديثها من شاشة الطلبات.
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      ))}

      {/* Footer note */}
      <div className="text-center text-[11px] text-slate-400 pb-4">
        <RefreshCw className="w-3 h-3 inline ml-1" />
        البيانات محدّثة تلقائياً من آخر حالة للنظام
      </div>
    </div>
  );
};
