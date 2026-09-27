import React, { useState, useEffect } from 'react';
import { 
  MessageSquareCode, 
  CreditCard, 
  CheckCircle2, 
  Smartphone, 
  Search, 
  Check, 
  Zap,
  Layers,
  Sparkles,
  Users,
  AlertTriangle,
  CalendarCheck,
  Loader2
} from 'lucide-react';
import { SmsMessage, SalesOrder, UserProfile } from '../types';
import { DataService, AutoMatchOutcome, BatchIngestResult, DailyPaymentSummary } from '../services/dataService';
import { currencySymbol, getOrderCurrency, providerCurrency } from '../utils/currency';
import { useToast } from './Toast';
import confetti from 'canvas-confetti';

interface SmsInboxProps {
  currentUser: UserProfile;
  onNavigateToOrders: () => void;
}

export const SmsInbox: React.FC<SmsInboxProps> = ({ currentUser, onNavigateToOrders }) => {
  const toast = useToast();
  const [messages, setMessages] = useState<SmsMessage[]>(DataService.getSmsMessages());
  const [orders, setOrders] = useState<SalesOrder[]>(DataService.getOrders());
  const [summary, setSummary] = useState<DailyPaymentSummary>(DataService.getDailyPaymentSummary());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Matching Modal
  const [matchingSms, setMatchingSms] = useState<SmsMessage | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // Simulation / Add SMS Modal
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simulateSender, setSimulateSender] = useState('VF-Cash');
  const [simulateBody, setSimulateBody] = useState('');

  // Batch Ingest Modal + Engine busy flags
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchBody, setBatchBody] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);

  const refreshData = () => {
    setMessages(DataService.getSmsMessages());
    setOrders(DataService.getOrders());
    setSummary(DataService.getDailyPaymentSummary());
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

  // Sample templates for quick testing
  const sampleSmsTemplates = [
    {
      sender: 'VF-Cash',
      text: 'تم استلام مبلغ 300.00 جنيه من 01099887766 في محفظتك. رقم العملية: 994812304. الرصيد الحالي 15,200.00 جنيه.',
    },
    {
      sender: 'InstaPay',
      text: 'تم تحويل 450.00 EGP لحسابك بنجاح من حساب amr.khaled@instapay مرجع: IPN-998231',
    },
    {
      sender: 'AlRajhiBank',
      text: 'حوالة واردة سريعة بمبلغ 150.00 ر.س من: سعد الغامدي إلى حسابك المنتهي بـ 5678. المرجع: TXN772391',
    },
    {
      sender: 'Orange-Cash',
      text: 'تم استلام مبلغ 150.00 جنيه من 01223344556. رقم العملية: ORG887412.',
    }
  ];

  const handleSimulateSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulateBody) return;

    const { outcome } = await DataService.addIncomingSms(simulateSender, simulateBody);
    refreshData();
    setShowSimulateModal(false);
    setSimulateBody('');
    outcomeToast(outcome, true);
  };

  const outcomeToast = (o: AutoMatchOutcome, celebrate: boolean) => {
    if (o.matched) {
      if (celebrate) confetti({ particleCount: 45, spread: 65, origin: { y: 0.6 } });
      if (o.currencyWarning) {
        toast.warning(`تمت مطابقة السداد تلقائياً للطلب رقم #${o.orderNumber}${o.currencyWarning}`);
      } else {
        toast.success(
          `تمت مطابقة السداد تلقائياً للطلب رقم #${o.orderNumber} — العميل ${o.customerName} بمبلغ ${o.amount ?? 0} ${o.currency ? currencySymbol(o.currency) : ''}`
        );
      }
      return;
    }
    if (o.reason === 'customer_not_found') {
      toast.warning('مرسل غير معروف — لم يُتعرف على العميل من الرسالة، وهي الآن بانتظار المطابقة اليدوية.');
    } else {
      toast.warning(`تم التعرف على العميل ${o.customerName} لكن لا يوجد طلب مفتوح بنفس عملة الرسالة — بانتظار المطابقة اليدوية.`);
    }
  };

  const batchToast = (res: BatchIngestResult) => {
    if (res.total === 0) {
      toast.info('لا توجد رسائل غير مطابقة حالياً.');
      return;
    }
    const parts: string[] = [];
    if (res.unknownSender > 0) parts.push(`${res.unknownSender} من مرسلين غير معروفين`);
    if (res.identifiedNoOrder > 0) parts.push(`${res.identifiedNoOrder} لعملاء بلا طلب مفتوح بنفس العملة`);
    const detail = parts.length > 0 ? ` — وتعذّرت مطابقة ${res.total - res.matched}: ${parts.join(' و')}` : '';
    if (res.matched === res.total) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      toast.success(`تمت مطابقة ${res.total}/${res.total} رسالة تلقائياً — كل السداد أُقفل.`);
    } else {
      toast.warning(`طابقت المحرك التلقائي ${res.matched} من ${res.total} رسالة${detail}.`);
    }
  };

  const handleBatchSms = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = DataService.parseSmsBatchText(batchBody);
    if (items.length === 0) {
      toast.warning('لم يُعثر على رسائل صالحة في النص الملصوق.');
      return;
    }

    setIsBatchProcessing(true);
    try {
      const res = await DataService.addIncomingSmsBatch(items);
      refreshData();
      setShowBatchModal(false);
      setBatchBody('');
      batchToast(res);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleAutoMatchAll = async () => {
    setIsAutoMatching(true);
    try {
      const res = await DataService.autoMatchAllUnmatched();
      refreshData();
      batchToast(res);
    } finally {
      setIsAutoMatching(false);
    }
  };

  const handleMatchPayment = async () => {
    if (!matchingSms || !selectedOrderId) return;
    const res = await DataService.matchSmsToOrder(matchingSms.id, selectedOrderId);
    if (res.success) {
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 }
      });
      if (res.message.includes('تنبيه')) {
        toast.warning(res.message);
      } else {
        toast.success(res.message);
      }
      refreshData();
      setMatchingSms(null);
      setSelectedOrderId('');
    } else {
      toast.error(res.message);
    }
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = 
      msg.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.rawBody.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (msg.parsedReferenceId && msg.parsedReferenceId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || msg.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getProviderLabel = (provider?: string) => {
    switch (provider) {
      case 'vodafone_cash':
        return <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-2 py-0.5 rounded-full font-bold">فودافون كاش</span>;
      case 'instapay':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] px-2 py-0.5 rounded-full font-bold">إنستاباي InstaPay</span>;
      case 'orange_cash':
        return <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] px-2 py-0.5 rounded-full font-bold">أورانج كاش</span>;
      case 'etisalat_cash':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold">اتصالات كاش</span>;
      case 'al_rajhi':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full font-bold">مصرف الراجحي</span>;
      case 'al_ahli':
        return <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] px-2 py-0.5 rounded-full font-bold">البنك الأهلي SNB</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-medium">رسالة بنكية</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs mb-1">
            <Zap className="w-4 h-4" />
            <span>محرك المطابقة التلقائية لرسائل التحويل البنكي والمحافظ الإلكترونية</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <MessageSquareCode className="w-5 h-5 text-amber-600" />
            <span>مركز رسائل الـ SMS والسداد الذكي</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {messages.some(m => m.status === 'unmatched') && (
            <button
              onClick={handleAutoMatchAll}
              disabled={isAutoMatching}
              className="flex items-center gap-2 bg-white border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 font-bold px-4 py-2.5 rounded-2xl text-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isAutoMatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>
                {isAutoMatching
                  ? 'جاري تشغيل المطابقة...'
                  : `تشغيل المطابقة التلقائية (${messages.filter(m => m.status === 'unmatched').length})`}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-4 py-2.5 rounded-2xl text-xs transition-all"
          >
            <Layers className="w-4 h-4" />
            <span>استقبال دفعي لعدة رسائل</span>
          </button>
          <button
            onClick={() => setShowSimulateModal(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-amber-500/20 transition-all"
          >
            <Smartphone className="w-4 h-4" />
            <span>تجربة استقبال رسالة SMS جديدة</span>
          </button>
        </div>
      </div>

      {/* Integration Guide Alert */}
      <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 border border-amber-200">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-950">الربط التلقائي عبر هاتف الأندرويد (SMS Webhook Forwarder)</h4>
            <p className="text-[11px] text-amber-800 mt-0.5">
              يمكن ربط أي تطبيق مثل "SMS Forwarder" على هاتف الشركة لترحيل رسائل فودافون كاش وإنستاباي والراجحي فورياً للنظام.
            </p>
          </div>
        </div>

        <div className="bg-white px-3 py-1.5 rounded-xl border border-amber-200 font-mono text-[11px] text-emerald-700 font-bold flex items-center gap-2 shadow-sm">
          <span>Webhook: /api/v1/sms/incoming</span>
        </div>
      </div>

      {/* Daily Payment Summary */}
      {(summary.ordersCount > 0 || summary.matchedTodayCount > 0 || summary.unknownSenderMessages.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900">ملخص السداد اليومي</h3>
              <span className="text-[11px] text-slate-500 font-bold">
                {new Date(`${summary.date}T12:00:00`).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <button
              onClick={onNavigateToOrders}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-4"
            >
              عرض شاشة الطلبات ←
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black text-slate-900 font-mono">{summary.ordersCount}</div>
              <div className="text-[10px] font-bold text-slate-500 mt-1">طلبات مستحقة اليوم</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black text-emerald-700 font-mono">{summary.matchedTodayCount}</div>
              <div className="text-[10px] font-bold text-emerald-600 mt-1">رسائل مطابقة اليوم</div>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black text-teal-700 font-mono">{summary.paidCustomers.length}</div>
              <div className="text-[10px] font-bold text-teal-600 mt-1">عملاء سددوا بالكامل</div>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black text-rose-700 font-mono">{summary.unpaidCustomers.length}</div>
              <div className="text-[10px] font-bold text-rose-600 mt-1">لم يسددوا بعد</div>
            </div>
          </div>

          {summary.unpaidCustomers.length > 0 && (
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>فيه {summary.unpaidCustomers.length} عميل ما دفعوش — المتبقي عليهم اليوم:</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {summary.unpaidCustomers.map(r => (
                  <div key={`${r.customerId}-${r.currency}`} className="flex items-center justify-between bg-white border border-rose-100 rounded-xl px-3 py-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900">{r.customerName}</span>
                      <span className="text-[10px] text-slate-500 font-mono mr-2">({r.whatsappNumber})</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">طلبات: {r.orderNumbers.map(n => `#${n}`).join('، ')}</div>
                    </div>
                    <span className="text-xs font-black font-mono text-rose-700 shrink-0">
                      {r.totalRemaining} {currencySymbol(r.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.unpaidCustomers.length === 0 && summary.ordersCount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-800 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>كل العملاء المستحقين اليوم سددوا بالكامل — لا متأخرات.</span>
            </div>
          )}

          {(summary.unknownSenderMessages.length > 0 || summary.identifiedUnmatchedMessages.length > 0) && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2">
              {summary.unknownSenderMessages.length > 0 && (
                <div className="text-xs text-amber-900 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{summary.unknownSenderMessages.length} رسالة من مرسلين غير معروفين بانتظار المطابقة اليدوية.</span>
                </div>
              )}
              {summary.identifiedUnmatchedMessages.length > 0 && (
                <div className="text-xs text-amber-900 font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{summary.identifiedUnmatchedMessages.length} رسالة معروفة المصدر بلا طلب مفتوح بنفس العملة.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="ابحث بالمرسل، نص الرسالة، أو رقم المرجع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-500 font-medium"
        >
          <option value="all">كل الرسائل</option>
          <option value="unmatched">غير مطابقة (بانتظار السداد)</option>
          <option value="matched">تمت مطابقتها وسدادها</option>
        </select>
      </div>

      {/* SMS Messages List */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-2 shadow-sm">
            <MessageSquareCode className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-medium text-slate-500">لا توجد رسائل مطابقة حالياً.</p>
          </div>
        ) : (
          filteredMessages.map(msg => {
            const isMatched = msg.status === 'matched';

            return (
              <div
                key={msg.id}
                className={`p-4 rounded-3xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isMatched
                    ? 'bg-slate-50/80 border-slate-200 text-slate-600'
                    : 'bg-white border-2 border-amber-300 hover:border-amber-400 shadow-sm'
                }`}
              >
                {/* Left: Message details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs font-mono">{msg.sender}</span>
                    {getProviderLabel(msg.parsedProvider)}

                    {msg.parsedAmount && (
                      <span className="bg-emerald-50 text-emerald-800 font-black font-mono text-xs px-2.5 py-0.5 rounded-full border border-emerald-200">
                        +{msg.parsedAmount} {msg.parsedProvider ? currencySymbol(providerCurrency(msg.parsedProvider)) : ''}
                      </span>
                    )}

                    {msg.parsedReferenceId && (
                      <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded-md border border-slate-200">
                        المرجع: {msg.parsedReferenceId}
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 font-mono mr-auto">
                      {new Date(msg.receivedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 font-mono leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    {msg.rawBody}
                  </p>

                  {isMatched && (
                    <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تم سدادها للطلب رقم #{msg.matchedOrderNumber}</span>
                    </div>
                  )}
                </div>

                {/* Right: Match Button */}
                <div className="shrink-0">
                  {isMatched ? (
                    <span className="text-xs text-slate-500 font-bold flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تمت المطابقة</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setMatchingSms(msg)}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>اختيار وسداد لعميل</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MATCH PAYMENT MODAL */}
      {matchingSms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CreditCard className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">سداد ومطابقة رسالة الـ SMS مع طلب عميل</h3>
              </div>
              <button onClick={() => setMatchingSms(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Selected SMS Summary */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">المبلغ المحول:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  +{matchingSms.parsedAmount} {matchingSms.parsedProvider ? currencySymbol(providerCurrency(matchingSms.parsedProvider)) : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">المرسل والمرجع:</span>
                <span className="text-slate-800 font-mono font-bold">{matchingSms.sender} ({matchingSms.parsedReferenceId})</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                اختر الطلب المراد سداد هذه الدفعة لحسابه:
              </label>

              <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                {orders.filter(o => o.orderStatus !== 'cancelled').map(order => {
                  const isSelected = selectedOrderId === order.id;

                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`w-full text-right p-3 rounded-xl text-xs flex items-center justify-between transition-all border ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>#{order.orderNumber} - {order.customerName}</span>
                          <span className="text-[10px] font-mono opacity-80 font-normal">({order.customerWhatsapp})</span>
                        </div>
                        <div className="text-[10px] opacity-80 mt-1">
                          تاريخ: {order.targetDate} ({order.targetTime}) • {order.permitsCount} تصريح
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        <div className="font-bold flex items-center gap-1.5 justify-end">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                            getOrderCurrency(order) === (matchingSms.parsedProvider ? providerCurrency(matchingSms.parsedProvider) : 'SAR')
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-red-100 border-red-300 text-red-800'
                          }`}>
                            {currencySymbol(getOrderCurrency(order))}
                            {getOrderCurrency(order) === (matchingSms.parsedProvider ? providerCurrency(matchingSms.parsedProvider) : 'SAR') ? ' ✓' : ' ✗'}
                          </span>
                          <span>{order.totalAmount}</span>
                        </div>
                        <div className="text-[10px] font-bold text-amber-600">متبقي: {order.remainingAmount}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMatchingSms(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                disabled={!selectedOrderId}
                onClick={handleMatchPayment}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20"
              >
                تأكيد السداد وتحديث الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATE SMS MODAL */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleSimulateSms} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-700">
                <Smartphone className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">محاكاة استقبال رسالة SMS من الهاتف</h3>
              </div>
              <button type="button" onClick={() => setShowSimulateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر نموذج رسالة جاهزة:</label>
              <div className="grid grid-cols-2 gap-2">
                {sampleSmsTemplates.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSimulateSender(t.sender);
                      setSimulateBody(t.text);
                    }}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-right text-[11px] text-slate-700 border border-slate-200 transition-colors truncate font-medium"
                  >
                    {t.sender} ({t.text.substring(0, 20)}...)
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم/رقم المرسل:</label>
              <input
                type="text"
                required
                value={simulateSender}
                onChange={(e) => setSimulateSender(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نص الرسالة الكامل:</label>
              <textarea
                required
                rows={3}
                value={simulateBody}
                onChange={(e) => setSimulateBody(e.target.value)}
                placeholder="الصق نص الرسالة الواردة على الهاتف..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20"
              >
                إرسال واستخراج البيانات آلياً
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BATCH SMS MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleBatchSms} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <Layers className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">استقبال دفعي لعدة رسائل SMS دفعة واحدة</h3>
              </div>
              <button type="button" onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl p-3">
              الصق الرسائل مفصولةً بـ <span className="font-bold">سطر فارغ</span> بين كل رسالة والتي تليها (أو كل رسالة في سطر مستقل).
              سيتعرف النظام على المزود تلقائياً من كل نص، ويطابق كل رسالة بطلب صاحبها إن أمكن.
            </p>

            {DataService.getDailyScenarioTexts() && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">نصوص سيناريو السداد اليومي الجاهزة:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'scenario1' as const, label: 'السيناريو 1', hint: '10 عملاء — الجميع يسدد' },
                    { key: 'scenario2' as const, label: 'السيناريو 2', hint: '8 رسائل — عميلان ما دفعوش' },
                    { key: 'scenario3' as const, label: 'السيناريو 3', hint: '6 معروفة + مرسلاَن مجهولان' },
                  ].map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setBatchBody(DataService.getDailyScenarioTexts()![s.key].join('\n\n'))}
                      className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-right transition-colors"
                    >
                      <div className="text-[11px] font-bold text-emerald-800">{s.label}</div>
                      <div className="text-[10px] text-emerald-600 mt-0.5">{s.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نصوص الرسائل (كل رسالة مفصولة عن التالية):</label>
              <textarea
                required
                rows={8}
                value={batchBody}
                onChange={(e) => setBatchBody(e.target.value)}
                placeholder={'Vodafone Cash: استلام مبلغ: 300.00 جنيه من 01001234501 رقم العملية: VF48200001\n\nInstaPay: You have received 450.00 EGP من كريم سعيد رقم العملية: IP48200138'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isBatchProcessing || DataService.parseSmsBatchText(batchBody).length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20"
              >
                {isBatchProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                <span>{isBatchProcessing ? 'جاري الاستقبال والمطابقة...' : 'استقبال ومطابقة آلية'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
