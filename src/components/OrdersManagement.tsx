import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Send, 
  MessageCircle, 
  CreditCard,
  Ticket,
  Copy,
  Printer,
  FileSpreadsheet,
  Archive,
  ArchiveRestore
} from 'lucide-react';
import { SalesOrder, Customer, UserProfile, OrderStatus, DeliveryStatus, OrderType, Permit, CurrencyCode } from '../types';
import { DataService } from '../services/dataService';
import { useToast } from './Toast';
import { downloadCsv, todayRiyadh } from '../utils/csvHelpers';
import { printOrderReceipt } from '../utils/printHelpers';
import { currencySymbol, getOrderCurrency } from '../utils/currency';
import confetti from 'canvas-confetti';

interface OrdersManagementProps {
  currentUser: UserProfile;
  onNavigateToPermits: () => void;
  onNavigateToSms: () => void;
}

export const OrdersManagement: React.FC<OrdersManagementProps> = ({
  currentUser,
  onNavigateToPermits,
  onNavigateToSms
}) => {
  const [orders, setOrders] = useState<SalesOrder[]>(DataService.getOrders());
  const [customers, setCustomers] = useState<Customer[]>(DataService.getCustomers());
  const [permits, setPermits] = useState<Permit[]>(DataService.getPermits());
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  
  // Create Order Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const [newTargetDate, setNewTargetDate] = useState(today);
  const [newTargetHour, setNewTargetHour] = useState('00');
  const [newTargetMin, setNewTargetMin] = useState('00');
  const [newPermitsCount, setNewPermitsCount] = useState(1);
  const [newOrderType, setNewOrderType] = useState<OrderType>('instant');
  const [newUnitPrice, setNewUnitPrice] = useState(150);
  const [newPaidAmount, setNewPaidAmount] = useState(0);
  const [newNotes, setNewNotes] = useState('');
  const [newCurrency, setNewCurrency] = useState<CurrencyCode>(() => {
    const c = DataService.getCompanySettings().currency;
    return c === 'EGP' ? 'EGP' : 'SAR';
  });

  // عرض الطلبات النشطة أو الأرشيف
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  // معاينة صورة تصريح مسحوب
  const [permitPreview, setPermitPreview] = useState<Permit | null>(null);

  // WhatsApp Share Modal
  const [whatsAppModalOrder, setWhatsAppModalOrder] = useState<SalesOrder | null>(null);
  const [markAsSent, setMarkAsSent] = useState(true);

  const refreshData = () => {
    setOrders(DataService.getOrders());
    setCustomers(DataService.getCustomers());
    setPermits(DataService.getPermits());
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

  // أرشفة تلقائية: الطلب المكتمل السداد والمنقضي موعده يُنقل للأرشيف فور فتح الشاشة
  useEffect(() => {
    DataService.autoArchiveOrders().then(count => {
      if (count > 0) {
        refreshData();
        toast.info(`تمت أرشفة ${count} طلب مكتمل السداد وانقضى موعده تلقائياً.`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleArchive = async (order: SalesOrder) => {
    const res = await DataService.setOrderArchived(order.id, !order.isArchived);
    if (res.success) {
      toast.success(res.message);
      refreshData();
    } else {
      toast.warning(res.message);
    }
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === newCustomerId);
    if (!customer) {
      toast.warning('يرجى اختيار العميل أولاً.');
      return;
    }

    const total = newPermitsCount * newUnitPrice;
    const paid = Math.max(0, Math.min(newPaidAmount, total));
    const targetTime = `${newTargetHour}:${newTargetMin}`;

    DataService.createOrder({
      customerId: customer.id,
      customerName: customer.fullName,
      customerWhatsapp: customer.whatsappNumber,
      permitsCount: newPermitsCount,
      targetDate: newTargetDate,
      targetTime,
      orderType: newOrderType,
      orderStatus: paid >= total && total > 0 ? 'confirmed' : 'searching',
      deliveryStatus: 'not_sent',
      unitPrice: newUnitPrice,
      totalAmount: total,
      paidAmount: paid,
      currency: newCurrency,
      notes: newNotes,
      createdBy: currentUser.fullName,
    });

    confetti({ particleCount: 50, spread: 60 });
    toast.success(`تم إنشاء الطلب لـ ${customer.fullName} (${newPermitsCount} تصريح — ${currencySymbol(newCurrency)}) بنجاح.`);
    refreshData();
    setShowCreateModal(false);
    setNewCustomerId('');
    setNewPaidAmount(0);
    setNewNotes('');
  };

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    DataService.updateOrderStatus(orderId, status);
    refreshData();
  };

  const handleDeliveryStatusChange = (orderId: string, status: DeliveryStatus) => {
    DataService.updateDeliveryStatus(orderId, status);
    refreshData();
  };

  const buildWhatsAppMessage = (order: SalesOrder) => {
    const isFullyPaid = order.paidAmount >= order.totalAmount && order.totalAmount > 0;
    const sym = currencySymbol(getOrderCurrency(order));
    return `السلام عليكم ورحمة الله وبركاته يا ${order.customerName}،
نود إبلاغكم بأنه تم تجهيز طلب تصريح زيارة الروضة الشريفة بنجاح 🕌✨

• رقم الطلب: #${order.orderNumber}
• تاريخ الزيارة: ${order.targetDate}
• وقت الفترة: ${order.targetTime}
• عدد التصاريح: ${order.permitsCount}
• حالة السداد: ${isFullyPaid ? 'مسدد بالكامل' : `متبقي ${order.remainingAmount} ${sym}`}

تقبل الله زيارتكم وطاعتكم.`;
  };

  const handleOpenWhatsApp = (order: SalesOrder) => {
    window.open(
      `https://wa.me/${order.customerWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(buildWhatsAppMessage(order))}`,
      '_blank',
      'noopener'
    );

    if (markAsSent && order.deliveryStatus !== 'sent') {
      DataService.updateDeliveryStatus(order.id, 'sent');
      refreshData();
      toast.success('تم تحديث موقف الإرسال إلى «تم إرساله للعميل».');
    }
    setWhatsAppModalOrder(null);
  };

  const handleCopyWhatsAppText = async (order: SalesOrder) => {
    try {
      await navigator.clipboard.writeText(buildWhatsAppMessage(order));
      toast.success('تم نسخ نص الرسالة إلى الحافظة.');
    } catch {
      toast.error('تعذر النسخ تلقائياً — يمكنك تحديد النص ونسخه يدوياً.');
    }
  };

  const handlePrintReceipt = async (order: SalesOrder) => {
    const opened = await printOrderReceipt(order, DataService.getCompanySettings());
    if (!opened) {
      toast.error('تعذر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة ثم إعادة المحاولة.');
    }
  };

  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      toast.warning('لا توجد طلبات مطابقة للتصدير.');
      return;
    }

    const statusLabels: Record<OrderStatus, string> = {
      confirmed: 'مؤكد',
      searching: 'جاري البحث',
      unconfirmed: 'غير مؤكد',
      cancelled: 'ملغي',
    };
    const deliveryLabels: Record<DeliveryStatus, string> = {
      sent: 'تم إرساله للعميل',
      waiting: 'قيد الانتظار',
      not_sent: 'لم يتم الإرسال',
    };

    downloadCsv(
      `orders-${todayRiyadh()}`,
      ['رقم الطلب', 'اسم العميل', 'رقم الواتساب', 'تاريخ الزيارة', 'وقت الفترة', 'عدد التصاريح', 'نوع الحجز', 'العملة', 'الإجمالي', 'المدفوع', 'المتبقي', 'حالة الطلب', 'موقف الإرسال'],
      filteredOrders.map(order => [
        order.orderNumber,
        order.customerName,
        order.customerWhatsapp,
        order.targetDate,
        order.targetTime,
        order.permitsCount,
        order.orderType === 'instant' ? 'فوري' : 'حجز موعد',
        currencySymbol(getOrderCurrency(order)),
        order.totalAmount,
        order.paidAmount,
        order.remainingAmount,
        statusLabels[order.orderStatus] ?? order.orderStatus,
        deliveryLabels[order.deliveryStatus] ?? order.deliveryStatus,
      ])
    );

    toast.success(`تم تصدير ${filteredOrders.length} طلب إلى ملف CSV.`);
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerWhatsapp.includes(searchQuery) ||
      String(order.orderNumber).includes(searchQuery);

    const matchesStatus = filterStatus === 'all' || order.orderStatus === filterStatus;
    const matchesType = filterType === 'all' || order.orderType === filterType;
    const matchesArchive = viewMode === 'archived' ? !!order.isArchived : !order.isArchived;

    return matchesSearch && matchesStatus && matchesType && matchesArchive;
  });

  const activeOrdersCount = orders.filter(o => !o.isArchived).length;
  const archivedOrdersCount = orders.filter(o => o.isArchived).length;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'confirmed':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-bold">مؤكد ومسدد</span>;
      case 'searching':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs px-2.5 py-1 rounded-full font-bold">جاري البحث</span>;
      case 'unconfirmed':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-bold">غير مؤكد</span>;
      case 'cancelled':
        return <span className="bg-red-50 text-red-800 border border-red-200 text-xs px-2.5 py-1 rounded-full font-bold">ملغي</span>;
    }
  };

  const getDeliveryBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'sent':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] px-2 py-0.5 rounded-md font-bold">✓ تم إرساله للعميل</span>;
      case 'waiting':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] px-2 py-0.5 rounded-md font-bold">قيد الانتظار</span>;
      case 'not_sent':
        return <span className="bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded-md font-medium">لم يتم الإرسال</span>;
    }
  };

  const newOrderTotal = newPermitsCount * newUnitPrice;
  const newOrderRemaining = Math.max(0, newOrderTotal - newPaidAmount);

  // خريطة معرّف التصريح → بياناته الكاملة (كود، صورة، موعد) لعرض المسحوبات في الإجراءات السريعة
  const permitById: Record<string, Permit> = {};
  permits.forEach(p => { permitById[p.id] = p; });

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <span>إدارة عمليات البيع والطلبات</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            متابعة حجوزات المعتمرين، حالات الدفع، وموقف إرسال التصاريح عبر الواتساب.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء طلب بيع جديد</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="ابحث برقم الطلب، اسم العميل، أو رقم الواتساب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filter Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 font-medium"
        >
          <option value="all">كل حالات الطلب</option>
          <option value="confirmed">مؤكد</option>
          <option value="searching">جاري البحث</option>
          <option value="unconfirmed">غير مؤكد</option>
          <option value="cancelled">ملغي</option>
        </select>

        {/* Filter Type */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 font-medium"
        >
          <option value="all">كل أنواع الحجز</option>
          <option value="instant">فوري</option>
          <option value="scheduled">حجز موعد</option>
        </select>

        {/* View Mode: Active / Archived */}
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1">
          <button
            onClick={() => setViewMode('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'active' ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            الطلبات النشطة ({activeOrdersCount})
          </button>
          <button
            onClick={() => setViewMode('archived')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              viewMode === 'archived' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>الأرشيف ({archivedOrdersCount})</span>
          </button>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition-all"
          title="تصدير الطلبات المفلترة إلى ملف CSV (يفتح في إكسل)"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>تصدير CSV</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3.5 px-4">رقم الطلب</th>
                <th className="py-3.5 px-4">العميل والواتساب</th>
                <th className="py-3.5 px-4">الموعد المطلوب</th>
                <th className="py-3.5 px-4">العدد والنوع</th>
                <th className="py-3.5 px-4">الحساب المالي</th>
                <th className="py-3.5 px-4">حالة الطلب</th>
                <th className="py-3.5 px-4">موقف الإرسال</th>
                <th className="py-3.5 px-4">التصاريح المسحوبة</th>
                <th className="py-3.5 px-4 text-center">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 font-medium">
                    {viewMode === 'archived' ? 'لا توجد طلبات مؤرشفة مطابقة.' : 'لا توجد طلبات مطابقة للبحث.'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isFullyPaid = order.paidAmount >= order.totalAmount && order.totalAmount > 0;
                  const orderSym = currencySymbol(getOrderCurrency(order));
                  const claimedPermits = (order.assignedPermitIds || [])
                    .map(id => permitById[id])
                    .filter(Boolean) as Permit[];

                  return (
                    <tr key={order.id} className={`transition-colors ${order.isArchived ? 'bg-slate-50/60 opacity-90' : 'hover:bg-slate-50/80'}`}>
                      {/* Order Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        #{order.orderNumber}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{order.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <MessageCircle className="w-3 h-3 text-emerald-600" />
                          <span>{order.customerWhatsapp}</span>
                        </div>
                      </td>

                      {/* Target Date & Time */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{order.targetDate}</div>
                        <div className="text-[11px] text-amber-700 font-mono font-bold">الساعة: {order.targetTime}</div>
                        {order.isArchived && (
                          <div className="text-[10px] text-indigo-700 font-bold mt-0.5 flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            <span>مؤرشف{order.archivedAt ? ` — ${new Date(order.archivedAt).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' })}` : ''}</span>
                          </div>
                        )}
                      </td>

                      {/* Count & Type */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{order.permitsCount} تصريح</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full inline-block mt-0.5 font-bold ${
                          order.orderType === 'instant' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          {order.orderType === 'instant' ? 'فوري' : 'حجز موعد'}
                        </span>
                      </td>

                      {/* Financials */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          {order.totalAmount} {orderSym}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5 font-medium">
                          {isFullyPaid ? (
                            <span className="text-emerald-700 font-bold">✓ مسدد بالكامل</span>
                          ) : (
                            <span className="text-amber-700">مدفوع: {order.paidAmount} | متبقي: {order.remainingAmount}</span>
                          )}
                        </div>
                      </td>

                      {/* Order Status Select */}
                      <td className="py-3.5 px-4">
                        <select
                          value={order.orderStatus}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none font-medium"
                        >
                          <option value="confirmed">مؤكد</option>
                          <option value="searching">جاري البحث</option>
                          <option value="unconfirmed">غير مؤكد</option>
                          <option value="cancelled">ملغي</option>
                        </select>
                      </td>

                      {/* Delivery Status Select */}
                      <td className="py-3.5 px-4">
                        <select
                          value={order.deliveryStatus}
                          onChange={(e) => handleDeliveryStatusChange(order.id, e.target.value as DeliveryStatus)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none font-medium"
                        >
                          <option value="not_sent">لم يتم الإرسال</option>
                          <option value="waiting">انتظار</option>
                          <option value="sent">تم إرساله</option>
                        </select>
                      </td>

                      {/* Claimed Permits: Thumbnails + Codes + Count */}
                      <td className="py-3.5 px-4">
                        {claimedPermits.length === 0 ? (
                          <span className="text-[11px] text-slate-400 font-medium">
                            لم يُسحب بعد — مطلوب {order.permitsCount}
                          </span>
                        ) : (
                          <div className="space-y-1.5 min-w-[150px]">
                            <div className="flex items-center gap-1.5">
                              {claimedPermits.slice(0, 3).map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setPermitPreview(p)}
                                  title={`${p.permitCode} — ${p.slotDate} ${p.slotFormatted}`}
                                  className="shrink-0 rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all"
                                >
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt={p.permitCode} className="w-9 h-9 object-cover" />
                                  ) : (
                                    <span className="w-9 h-9 bg-slate-100 flex items-center justify-center text-slate-500">
                                      <Ticket className="w-4 h-4" />
                                    </span>
                                  )}
                                </button>
                              ))}
                              {claimedPermits.length > 3 && (
                                <span className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                  +{claimedPermits.length - 3}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {claimedPermits.slice(0, 2).map(p => (
                                <span
                                  key={p.id}
                                  title={p.permitCode}
                                  className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded-md"
                                >
                                  {p.permitCode.replace(/^PERMIT-?/i, '')}
                                </span>
                              ))}
                              {claimedPermits.length > 2 && (
                                <span className="text-[10px] font-bold text-slate-500 px-1 py-0.5">+{claimedPermits.length - 2} كود</span>
                              )}
                            </div>
                            <div className={`text-[10px] font-bold ${claimedPermits.length >= order.permitsCount ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {claimedPermits.length} من {order.permitsCount} مسحوبة ✓
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {!order.isArchived && (
                            <>
                              {/* WhatsApp Share Button */}
                              <button
                                onClick={() => setWhatsAppModalOrder(order)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all shadow-sm"
                                title="إرسال رسالة وتصريح عبر الواتساب"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>

                              {/* Allocate Permit from Inventory Button */}
                              <button
                                onClick={onNavigateToPermits}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all shadow-sm"
                                title="تخصيص تصريح من المخزون"
                              >
                                <Ticket className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Print Receipt Button */}
                          <button
                            onClick={() => handlePrintReceipt(order)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all shadow-sm"
                            title="طباعة سند الحجز مع رمز QR"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {!order.isArchived && (
                            <>
                              {/* Match Payment SMS Button */}
                              {!isFullyPaid && (
                                <button
                                  onClick={onNavigateToSms}
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all shadow-sm"
                                  title="مطابقة رسالة سداد SMS"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </button>
                              )}

                              {/* Archive Button */}
                              <button
                                onClick={() => handleToggleArchive(order)}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all shadow-sm"
                                title="أرشفة الطلب"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Restore from Archive */}
                          {order.isArchived && (
                            <button
                              onClick={() => handleToggleArchive(order)}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all shadow-sm"
                              title="استرجاع الطلب من الأرشيف"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ORDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleCreateOrder} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <span>إنشاء طلب بيع جديد</span>
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اختر العميل:</label>
              <select
                required
                value={newCustomerId}
                onChange={(e) => setNewCustomerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="">-- اختر من قائمة العملاء المسجلين --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.whatsappNumber}) {c.nickname ? `- [${c.nickname}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الطلب:</label>
                <select
                  value={newOrderType}
                  onChange={(e) => setNewOrderType(e.target.value as OrderType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="instant">فوري</option>
                  <option value="scheduled">حجز موعد</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عدد التصاريح:</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={newPermitsCount}
                  onChange={(e) => setNewPermitsCount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ التصريح:</label>
                <input
                  type="date"
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الساعة:</label>
                <select
                  value={newTargetHour}
                  onChange={(e) => setNewTargetHour(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الفترة (دقيقة):</label>
                <select
                  value={newTargetMin}
                  onChange={(e) => setNewTargetMin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="00">:00</option>
                  <option value="20">:20</option>
                  <option value="40">:40</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عملة التحصيل:</label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewCurrency('SAR')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      newCurrency === 'SAR'
                        ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    ريال ر.س
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCurrency('EGP')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      newCurrency === 'EGP'
                        ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    جنيه ج.م
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سعر التصريح الواحد ({currencySymbol(newCurrency)}):</label>
                <input
                  type="number"
                  min={0}
                  value={newUnitPrice}
                  onChange={(e) => setNewUnitPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">إجمالي المبلغ:</label>
                <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-800 font-bold font-mono">
                  {newOrderTotal} {currencySymbol(newCurrency)}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-medium -mt-2">
              لكل عملة خزنة تحصيل مستقلة — تأكد من مطابقة العملة مع خزنة استقبال السداد عند مطابقة رسائل SMS.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">دفعة مقدمة (اختياري):</label>
              <input
                type="number"
                min={0}
                max={newOrderTotal}
                value={newPaidAmount}
                onChange={(e) => setNewPaidAmount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className={`rounded-xl px-3 py-2 text-[11px] font-bold flex items-center justify-between border ${
              newOrderRemaining === 0 && newOrderTotal > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <span>المتبقي على العميل بعد هذه الدفعة:</span>
              <span className="font-mono">
                {newOrderRemaining} {currencySymbol(newCurrency)}
                {newOrderRemaining === 0 && newOrderTotal > 0 && ' — سيُسجل الطلب «مؤكد ومسدد» تلقائياً'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية:</label>
              <textarea
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="أي شروط خاصة للعميل..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              >
                حفظ وإنشاء الطلب
              </button>
            </div>
          </form>
        </div>
      )}

      {/* WHATSAPP SHARING MODAL */}
      {whatsAppModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <MessageCircle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">إرسال للعميل عبر الواتساب</h3>
              </div>
              <button onClick={() => setWhatsAppModalOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 space-y-1.5 whitespace-pre-wrap leading-relaxed">
              {buildWhatsAppMessage(whatsAppModalOrder)}
            </div>

            <label className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-2xl px-3.5 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={markAsSent}
                onChange={(e) => setMarkAsSent(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-emerald-900">
                تحديث موقف الإرسال إلى «تم إرساله للعميل» بعد فتح واتساب
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setWhatsAppModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>

              <button
                onClick={() => handleCopyWhatsAppText(whatsAppModalOrder)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ النص</span>
              </button>

              <button
                onClick={() => handleOpenWhatsApp(whatsAppModalOrder)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>فتح الواتساب ومراسلة العميل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMIT PREVIEW LIGHTBOX */}
      {permitPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPermitPreview(null)}>
          <div
            className="bg-white border border-slate-200 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-600" />
                <span>معاينة التصريح المسحوب</span>
              </h3>
              <button onClick={() => setPermitPreview(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-3 min-h-[200px]">
              {permitPreview.imageUrl ? (
                <img
                  src={permitPreview.imageUrl}
                  alt={permitPreview.permitCode}
                  className="max-h-[320px] w-auto rounded-xl object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400 py-10">
                  <Ticket className="w-12 h-12" />
                  <span className="text-xs font-bold">لا توجد صورة مرفقة لهذا التصريح</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                <div className="text-[10px] font-bold text-indigo-500">كود التصريح</div>
                <div className="font-mono font-bold text-indigo-800" dir="ltr">{permitPreview.permitCode}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <div className="text-[10px] font-bold text-emerald-600">الموعد</div>
                <div className="font-mono font-bold text-emerald-800">{permitPreview.slotDate} — {permitPreview.slotFormatted}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500">مسحوب لصالح</div>
                <div className="font-bold text-slate-800">{permitPreview.assignedCustomerName || '—'}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500">بواسطة</div>
                <div className="font-bold text-slate-800">{permitPreview.assignedByUserName || '—'}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {permitPreview.imageUrl && (
                <a
                  href={permitPreview.imageUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  تحميل الصورة
                </a>
              )}
              <button
                onClick={() => setPermitPreview(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
