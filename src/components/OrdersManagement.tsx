import React, { useState, useEffect, useMemo } from 'react';
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
  ArchiveRestore,
  Download,
  Eye,
  ImageIcon,
  CheckCircle2,
  Sparkles,
  Share2,
  Banknote,
  Bell,
  Phone,
  RotateCcw,
  Edit,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { SalesOrder, Customer, UserProfile, OrderStatus, DeliveryStatus, OrderType, Permit, CurrencyCode } from '../types';
import { DataService } from '../services/dataService';
import { useToast } from './Toast';
import { downloadCsv, todayRiyadh } from '../utils/csvHelpers';
import { printOrderReceipt } from '../utils/printHelpers';
import { currencySymbol, getOrderCurrency, providerCurrency, providerLabel } from '../utils/currency';
import { useImageActions } from '../hooks/useImageActions';
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
  const permitById = useMemo<Record<string, Permit>>(() => {
    const map: Record<string, Permit> = {};
    permits.forEach(p => { map[p.id] = p; });
    return map;
  }, [permits]);
  const toast = useToast();
  // تحميل/مشاركة صور التصاريح بشكل يعمل على الجوال (data URL → Blob)
  const imageActions = useImageActions();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'tomorrow' | 'unpaid' | 'unsent' | 'overdue'>('all');
  
  // Create Order Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

  const [newTargetDate, setNewTargetDate] = useState(today);
  const [newTargetHour, setNewTargetHour] = useState('00');
  const [newTargetMin, setNewTargetMin] = useState('00');
  const [newMaleCount, setNewMaleCount] = useState(1);
  const [newFemaleCount, setNewFemaleCount] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [newOrderType, setNewOrderType] = useState<OrderType>('instant');
  const [newUnitPrice, setNewUnitPrice] = useState(() => {
    return DataService.getCompanySettings().defaultPermitPrice ?? 150;
  });
  const [newPaidAmount, setNewPaidAmount] = useState(0);
  const [newNotes, setNewNotes] = useState('');
  const [newCurrency, setNewCurrency] = useState<CurrencyCode>(() => {
    const c = DataService.getCompanySettings().currency;
    return c === 'EGP' ? 'EGP' : 'SAR';
  });

  // تحديث السعر الافتراضي والعملة عند فتح نموذج إنشاء الطلب
  useEffect(() => {
    if (showCreateModal) {
      const s = DataService.getCompanySettings();
      setNewUnitPrice(s.defaultPermitPrice ?? 150);
      setNewCurrency(s.currency === 'EGP' ? 'EGP' : 'SAR');
    }
  }, [showCreateModal]);

  // عدد التصاريح الكلي مشتق من مجموع الذكور والإناث
  const newPermitsCount = newMaleCount + newFemaleCount;

  // بحث سريع في اختيار العميل بالاسم أو اللقب أو جزء من رقم الموبايل
  const selectedCustomer = customers.find(c => c.id === newCustomerId) || null;
  const normalizedSearch = customerSearch.trim().toLowerCase();
  const filteredCustomers = normalizedSearch
    ? customers.filter(c =>
        c.fullName.toLowerCase().includes(normalizedSearch) ||
        (c.nickname || '').toLowerCase().includes(normalizedSearch) ||
        c.whatsappNumber.replace(/[\s+-]/g, '').includes(normalizedSearch.replace(/[\s+-]/g, ''))
      )
    : customers;
  const customerListVisible = showCustomerList && !newCustomerId && filteredCustomers.length > 0;

  // عرض الطلبات النشطة أو الأرشيف
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  // معاينة صورة تصريح مسحوب
  const [permitPreview, setPermitPreview] = useState<Permit | null>(null);

  // WhatsApp Share Modal
  const [whatsAppModalOrder, setWhatsAppModalOrder] = useState<SalesOrder | null>(null);
  const [markAsSent, setMarkAsSent] = useState(true);
  const [customWhatsAppText, setCustomWhatsAppText] = useState<string>('');

  // Direct Payment Modal — زر "تم السداد" يسجّل باسم الموظف عشان يتحاسب عليه آخر اليوم
  const [paymentModalOrder, setPaymentModalOrder] = useState<SalesOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Edit Order Modal State
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editTargetHour, setEditTargetHour] = useState('00');
  const [editTargetMin, setEditTargetMin] = useState('00');
  const [editMaleCount, setEditMaleCount] = useState(1);
  const [editFemaleCount, setEditFemaleCount] = useState(0);
  const [editUnitPrice, setEditUnitPrice] = useState(150);
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>('SAR');
  const [editOrderType, setEditOrderType] = useState<OrderType>('instant');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Order Confirmation Modal (Super Admin only)
  const [deletingOrder, setDeletingOrder] = useState<SalesOrder | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

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
      permitsCountMale: newMaleCount,
      permitsCountFemale: newFemaleCount,
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
    setCustomerSearch('');
    setNewMaleCount(1);
    setNewFemaleCount(0);
    setNewPaidAmount(0);
    setNewNotes('');
    setNewUnitPrice(DataService.getCompanySettings().defaultPermitPrice ?? 150);
  };

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    const released = DataService.updateOrderStatus(orderId, status);
    if (status === 'cancelled' && released > 0) {
      toast.success(`تم إلغاء الطلب وإرجاع ${released} تصريح للمخزون تلقائياً.`);
    }
    refreshData();
  };

  const handleDeliveryStatusChange = (orderId: string, status: DeliveryStatus) => {
    DataService.updateDeliveryStatus(orderId, status);
    refreshData();
    const label = status === 'sent' ? 'تم إرساله للعميل' : status === 'waiting' ? 'انتظار' : 'لم يتم الإرسال';
    toast.success(`تم تحديث موقف الإرسال إلى «${label}».`);
  };

  // أجزاء الرسالة التي يختار الموظف إرسالها للعميل
  const [waInclude, setWaInclude] = useState({
    confirmAndVisit: true,  // تأكيد الحجز + الموعد
    permits: true,          // عدد التصاريح (ذكر/أنثى)
    paymentDemand: false,   // رسالة المطالبة (القيمة + رقم/نوع التحويل)
    bankAccounts: false,    // أرقام الحسابات للتحويل
    permitCodes: false,     // أكواد/صور التصاريح
  });

  const applyWaPreset = (preset: 'confirm_only' | 'code_only' | 'payment_only' | 'all') => {
    const nextInclude = 
      preset === 'confirm_only' ? { confirmAndVisit: true, permits: true, paymentDemand: false, bankAccounts: false, permitCodes: false }
      : preset === 'code_only' ? { confirmAndVisit: false, permits: false, paymentDemand: false, bankAccounts: false, permitCodes: true }
      : preset === 'payment_only' ? { confirmAndVisit: false, permits: false, paymentDemand: true, bankAccounts: true, permitCodes: false }
      : { confirmAndVisit: true, permits: true, paymentDemand: true, bankAccounts: true, permitCodes: true };
    setWaInclude(nextInclude);
    if (whatsAppModalOrder) {
      setCustomWhatsAppText(buildWhatsAppMessage(whatsAppModalOrder, nextInclude));
    }
  };

  const handleOpenWhatsAppModal = (order: SalesOrder) => {
    // فحص إذا كان للطلب تصاريح مخصصة
    const direct = (order.assignedPermitIds || []).map(id => permitById[id]).filter(Boolean) as Permit[];
    const claimed = direct.length > 0 
      ? direct 
      : permits.filter(p => p.status === 'assigned' && p.assignedToCustomerId === order.customerId);
    const hasPermits = claimed.length > 0;

    const initialInclude = {
      confirmAndVisit: true,
      permits: true,
      paymentDemand: false,
      bankAccounts: false,
      permitCodes: hasPermits, // مفعّل تلقائياً ليظهر كود التصريح ورابط الصورة فوراً
    };
    setWaInclude(initialInclude);
    setWhatsAppModalOrder(order);
    setCustomWhatsAppText(buildWhatsAppMessage(order, initialInclude));
  };

  const buildWhatsAppMessage = (order: SalesOrder, include = waInclude) => {
    const tmpl = DataService.getMessageTemplates();
    const isFullyPaid = order.paidAmount >= order.totalAmount && order.totalAmount > 0;
    const sym = currencySymbol(getOrderCurrency(order));
    const accounts = DataService.getFinancialAccounts().filter(a => a.isActive);
    // سطر عدد التصاريح — يُظهر تقسيم الذكور/الإناث عند توفره
    const permitsLine = (order.permitsCountMale != null || order.permitsCountFemale != null)
      ? `• عدد التصاريح: ${order.permitsCount} (${order.permitsCountMale || 0} ذكر / ${order.permitsCountFemale || 0} أنثى)`
      : `• عدد التصاريح: ${order.permitsCount}`;

    // التحويلات المرتبطة بهذا الطلب (رقم التحويل + القيمة + نوع التحويل)
    const transfers = DataService.getSmsMessages().filter(
      m => m.matchedOrderId === order.id && (m.parsedAmount || 0) > 0
    );
    const transferLines = transfers.map(t =>
      `• تم استلام تحويل بقيمة ${t.parsedAmount} ${currencySymbol(providerCurrency(t.parsedProvider || 'other'))} — ${providerLabel(t.parsedProvider || 'other')}${t.parsedReferenceId ? ` — رقم التحويل: ${t.parsedReferenceId}` : ''}`
    ).join('\n');

    const replaceVars = (text: string, extra: Record<string, string> = {}) => {
      const vars: Record<string, string> = {
        '{customerName}': order.customerName,
        '{orderNumber}': String(order.orderNumber),
        '{targetDate}': order.targetDate,
        '{targetTime}': order.targetTime,
        '{permitsCount}': String(order.permitsCount),
        '{permitsLine}': include.permits ? `\n${permitsLine}` : '',
        '{totalAmount}': String(order.totalAmount),
        '{paidAmount}': String(order.paidAmount),
        '{remainingAmount}': String(order.remainingAmount),
        '{currency}': sym,
        '{companyName}': DataService.getCompanySettings().companyNameAr || 'مؤسسة حجز تصاريح الروضة',
        '{transfers}': transferLines ? `\n${transferLines}` : '',
        ...extra,
      };
      let res = text;
      for (const [k, v] of Object.entries(vars)) {
        res = res.split(k).join(v);
      }
      return res;
    };

    // رسالة مُخصصة حسب الأجزاء المختارة والقوالب المعتمدة
    const sections: string[] = [];

    if (include.confirmAndVisit) {
      sections.push(replaceVars(tmpl.confirmationHeader));
    }

    if (include.paymentDemand) {
      const demandTmpl = isFullyPaid ? tmpl.paymentDemandPaid : tmpl.paymentDemandPending;
      sections.push(replaceVars(demandTmpl).trim());
    }

    if (include.bankAccounts && !isFullyPaid) {
      const accountsList = accounts.map(a => `• ${a.accountName} (${a.accountNumber})`).join('\n') || 'يرجى التواصل لمعرفة الحساب البنكي';
      sections.push(`طرق الدفع المتاحة:
${accountsList}`);
    }

    if (include.permitCodes) {
      const direct = (order.assignedPermitIds || [])
        .map(id => permitById[id])
        .filter(Boolean) as Permit[];
      const claimed = direct.length > 0
        ? direct
        : permits.filter(p => p.status === 'assigned' && p.assignedToCustomerId === order.customerId);
      const codes = claimed.map(p => {
        let text = `• كود التصريح: ${p.permitCode} — موعد الزيارة: ${p.slotDate} (${p.slotFormatted})`;
        if (p.imageUrl && p.imageUrl.startsWith('http')) {
          text += `\n  🖼️ رابط صورة وباركود التصريح مباشرة:\n  ${p.imageUrl}`;
        }
        return text;
      }).join('\n\n');

      const countStr = claimed.length ? ` (${claimed.length})` : '';
      const listStr = codes || 'جارٍ إصدار التصاريح وستصلكم صور الكود فور اعتمادها.';
      sections.push(replaceVars(tmpl.permitCodesHeader, {
        '{permitsCount}': countStr,
        '{permitCodesList}': listStr,
      }));
    }

    if (sections.length === 0) {
      return `السلام عليكم ورحمة الله وبركاته يا ${order.customerName}،\nنتواصل معكم بخصوص طلب تصريح زيارة الروضة الشريفة رقم #${order.orderNumber}.`;
    }

    const footer = tmpl.footerText ? `\n\n${replaceVars(tmpl.footerText)}` : '';
    return sections.join('\n\n') + footer;
  };

  const handleOpenWhatsApp = (order: SalesOrder) => {
    // محاولة نسخ صورة أول تصريح تلقائياً لمستخدمي الكمبيوتر (Ctrl + V)
    const direct = (order.assignedPermitIds || []).map(id => permitById[id]).filter(Boolean) as Permit[];
    const claimed = direct.length > 0 
      ? direct 
      : permits.filter(p => p.status === 'assigned' && p.assignedToCustomerId === order.customerId);
    const firstWithImage = claimed.find(p => p.imageUrl);
    if (firstWithImage?.imageUrl) {
      imageActions.copyOrDownload(firstWithImage.imageUrl, `تصريح_${firstWithImage.permitCode}.png`);
    }

    const cleanPhone = (order.customerWhatsapp || '').replace(/[^0-9]/g, '');
    const messageToSend = customWhatsAppText || buildWhatsAppMessage(order);
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageToSend)}`,
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
      const messageToSend = customWhatsAppText || buildWhatsAppMessage(order);
      await navigator.clipboard.writeText(messageToSend);
      toast.success('تم نسخ نص الرسالة إلى الحافظة.');
      if (markAsSent && order.deliveryStatus !== 'sent') {
        DataService.updateDeliveryStatus(order.id, 'sent');
        refreshData();
        toast.success('تم تحديث موقف الإرسال إلى «تم إرساله للعميل».');
      }
    } catch {
      toast.error('تعذر النسخ تلقائياً — يمكنك تحديد النص ونسخه يدوياً.');
    }
  };

  // فتح مربع تسجيل السداد — المبلغ الافتراضي هو المتبقي
  const handleOpenPayment = (order: SalesOrder) => {
    const remaining = Math.max(0, Math.round((order.totalAmount - order.paidAmount) * 100) / 100);
    setPaymentModalOrder(order);
    setPaymentAmount(String(remaining));
    setPaymentNote('');
  };

  // تأكيد السداد — يُسجّل باسم المستخدم الحالي ويظهر في تقرير آخر اليوم
  const handleConfirmPayment = async () => {
    if (!paymentModalOrder) return;
    setPaymentSubmitting(true);
    const res = await DataService.addOrderPayment(paymentModalOrder.id, Number(paymentAmount), paymentNote);
    setPaymentSubmitting(false);
    if (res.success) {
      toast.success(res.message);
      setPaymentModalOrder(null);
      refreshData();
    } else {
      toast.error(res.message);
    }
  };

  // تذكير سداد واتساب للعميل + تسجيله — الزر يدعم "إعادة الإرسال"
  const handleSendPaymentReminder = (order: SalesOrder) => {
    const phone = order.customerWhatsapp.replace(/[^0-9]/g, '');
    if (!phone) {
      toast.warning('لا يوجد رقم واتساب مسجل لهذا العميل.');
      return;
    }
    const reminderText = buildWhatsAppMessage(order, {
      confirmAndVisit: false,
      permits: false,
      paymentDemand: true,
      bankAccounts: true,
      permitCodes: false,
    });
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(reminderText)}`, '_blank', 'noopener');
    DataService.recordPaymentReminder(order.id);
    refreshData();
    toast.success(order.lastReminderAt ? 'تمت إعادة إرسال تذكير السداد وتسجيله.' : 'تم إرسال تذكير السداد وتسجيله.');
  };

  // تعديل الطلب
  const handleOpenEditOrder = (order: SalesOrder) => {
    setEditingOrder(order);
    setEditTargetDate(order.targetDate);
    const [h, m] = (order.targetTime || '00:00').split(':');
    setEditTargetHour(h || '00');
    setEditTargetMin(m || '00');
    setEditMaleCount(order.permitsCountMale ?? order.permitsCount);
    setEditFemaleCount(order.permitsCountFemale ?? 0);
    setEditUnitPrice(order.unitPrice);
    setEditCurrency(order.currency || 'SAR');
    setEditOrderType(order.orderType);
    setEditNotes(order.notes || '');
  };

  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setIsSubmittingEdit(true);
    try {
      const res = await DataService.updateOrder(editingOrder.id, {
        targetDate: editTargetDate,
        targetTime: `${editTargetHour}:${editTargetMin}`,
        permitsCountMale: editMaleCount,
        permitsCountFemale: editFemaleCount,
        unitPrice: editUnitPrice,
        currency: editCurrency,
        orderType: editOrderType,
        notes: editNotes,
      });
      if (res.success) {
        toast.success(res.message);
        setEditingOrder(null);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // حذف الطلب
  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    setIsSubmittingDelete(true);
    try {
      const res = await DataService.deleteOrder(deletingOrder.id);
      if (res.success) {
        toast.success(res.message);
        setDeletingOrder(null);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // فك ارتباط تصريح من نافذة المعاينة
  const handleUnassignPermit = async (permitId: string, orderNumber?: number) => {
    const numText = orderNumber ? `الطلب #${orderNumber}` : 'العميل';
    if (!window.confirm(`هل أنت متأكد من فك ارتباط هذا التصريح عن ${numText} وإرجاعه للمخزون متاحاً؟`)) return;
    const res = await DataService.returnPermit(permitId, `فك ارتباط يدوي من شاشة الطلبات`);
    if (res.success) {
      toast.success(res.message);
      setPermitPreview(null);
      refreshData();
    } else {
      toast.error(res.message);
    }
  };

  const handleCopyPermitImage = (imageUrl: string, permitCode: string) => {
    imageActions.copyOrDownload(imageUrl, `تصريح_${permitCode}.png`);
    if (whatsAppModalOrder && markAsSent && whatsAppModalOrder.deliveryStatus !== 'sent') {
      DataService.updateDeliveryStatus(whatsAppModalOrder.id, 'sent');
      refreshData();
      toast.success('تم نسخ التصريح وتحديث موقف الإرسال إلى «تم إرساله للعميل».');
    }
  };

  const handleDownloadPermitImage = async (imageUrl: string, permitCode: string) => {
    if (!imageUrl) {
      toast.warning('لا توجد صورة لهذا التصريح.');
      return;
    }
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS && navigator.canShare) {
        // على iOS: نحمّل الـ blob أولاً ثم نشاركه عبر قائمة النظام لحفظه في الألبوم
        const res = await fetch(imageUrl, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], `تصريح_${permitCode}.jpg`, { type: blob.type || 'image/jpeg' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: `تصريح ${permitCode}` });
            toast.success('اختر «حفظ الصورة» من القائمة لحفظها في ألبوم الصور.');
            return;
          }
        }
      }
    } catch (err) {
      // AbortError = ألغى المستخدم قائمة المشاركة — لا نكمل للتنزيل
      if (err instanceof DOMException && err.name === 'AbortError') return;
      /* أي استثناء آخر → نكمل بالتحميل المباشر */
    }
    // كمبيوتر أو fallback: تحميل مباشر عبر blob URL
    await imageActions.download(imageUrl, `تصريح_${permitCode}.jpg`);
  };

  // إرسال كود وصورة التصريح المحدد للعميل مباشرة في واتساب دون الحاجة لتسجيل رقمه أو البحث عنه
  const handleSendPermitDirect = async (p: Permit) => {
    if (!whatsAppModalOrder) return;
    const cleanPhone = (whatsAppModalOrder.customerWhatsapp || '').replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      toast.warning('لا يوجد رقم واتساب مسجل لهذا العميل في الطلب.');
      return;
    }

    // رابط الصورة للكمبيوتر
    const imgLink = (p.imageUrl && p.imageUrl.startsWith('http'))
      ? `\n\n🖼️ صورة وباركود التصريح:\n${p.imageUrl}`
      : '';

    // رسالة الموبايل: بدون رابط (الصورة ترسل كملف)
    const directMsg = `السلام عليكم ورحمة الله وبركاته يا ${whatsAppModalOrder.customerName}،
نرسل لكم كود وصورة تصريح زيارة الروضة الشريفة المعتمد 🕌✨

• رقم الطلب: #${whatsAppModalOrder.orderNumber}
• كود التصريح: ${p.permitCode}
• تاريخ الزيارة: ${p.slotDate}
• وقت الفترة: ${p.slotFormatted}

يرجى التواجد أمام بوابات الدخول قبل الموعد بـ 15 دقيقة وإبراز تصريح نُسك / توكلنا.

تقبل الله زيارتكم وطاعتكم ونسألكم صالح الدعاء.`;

    // رسالة الكمبيوتر / fallback: نفس الرسالة + رابط الصورة في النهاية
    const directMsgWithLink = `السلام عليكم ورحمة الله وبركاته يا ${whatsAppModalOrder.customerName}،
نرسل لكم كود وصورة تصريح زيارة الروضة الشريفة المعتمد 🕌✨

• رقم الطلب: #${whatsAppModalOrder.orderNumber}
• كود التصريح: ${p.permitCode}
• تاريخ الزيارة: ${p.slotDate}
• وقت الفترة: ${p.slotFormatted}${imgLink}

يرجى التواجد أمام بوابات الدخول قبل الموعد بـ 15 دقيقة وإبراز تصريح نُسك / توكلنا.

تقبل الله زيارتكم وطاعتكم ونسألكم صالح الدعاء.`;

    const markSent = () => {
      if (markAsSent && whatsAppModalOrder.deliveryStatus !== 'sent') {
        DataService.updateDeliveryStatus(whatsAppModalOrder.id, 'sent');
        refreshData();
      }
    };

    // ── الموبايل: نشارك الصورة كملف حقيقي عبر قائمة النظام → المستخدم يختار واتساب ──
    if (p.imageUrl && typeof navigator !== 'undefined' && navigator.share) {
      try {
        const res = await fetch(p.imageUrl, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], `تصريح_${p.permitCode}.jpg`, { type: blob.type || 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              text: directMsg,
              title: `تصريح ${p.permitCode}`,
            });
            markSent();
            toast.success('اختر «واتساب» من القائمة — الصورة ترسل كصورة حقيقية للعميل مباشرة.');
            return;
          }
        }
      } catch (err) {
        // AbortError = ألغى المستخدم القائمة
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // خطأ آخر → نكمل بالطريقة الاحتياطية
      }
    }

    // ── الكمبيوتر / fallback: ننسخ الصورة للحافظة + نفتح واتساب ──
    let copiedImage = false;
    if (p.imageUrl && navigator.clipboard && window.isSecureContext) {
      try {
        const res = await fetch(p.imageUrl, { mode: 'cors' });
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        copiedImage = true;
      } catch { /* تجاهل خطأ الحافظة */ }
    }

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(directMsgWithLink)}`, '_blank', 'noopener');
    markSent();

    if (copiedImage) {
      toast.success('✅ تم نسخ صورة التصريح — بعد فتح واتساب اضغط على حقل الكتابة ثم اضغط Ctrl+V (أو اضغط مطولاً واختر «لصق») لإرفاق الصورة مع الرسالة.');
    } else {
      toast.success('تم فتح محادثة العميل على رقمه المسجل — أرفق صورة التصريح يدوياً من الجهاز.');
    }
  };

  // مشاركة عبر قائمة مشاركة التطبيقات بالجوال
  const handleSharePermitImage = async (imageUrl: string, permitCode: string) => {
    const fullText = customWhatsAppText || (whatsAppModalOrder ? buildWhatsAppMessage(whatsAppModalOrder) : `تصريح رقم ${permitCode}`);
    const res = await imageActions.shareOrDownload(imageUrl, `تصريح_${permitCode}.png`, {
      title: `تصريح زيارة الروضة الشريفة ${permitCode}`,
      text: fullText,
      downloadedMessage: 'تم تحميل صورة التصريح بنجاح — يمكنك إرفاقها في محادثة الواتساب.',
    });
    if (whatsAppModalOrder && markAsSent && whatsAppModalOrder.deliveryStatus !== 'sent') {
      DataService.updateDeliveryStatus(whatsAppModalOrder.id, 'sent');
      refreshData();
      toast.success('تم إرسال الكود وتحديث موقف الإرسال إلى «تم إرساله للعميل».');
    }
    return res;
  };

  const handlePrintReceipt = async (order: SalesOrder) => {
    const opened = await printOrderReceipt(order, DataService.getCompanySettings());
    if (!opened) {
      toast.error('تعذر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة ثم إعادة المحاولة.');
    }
  };

  const handleExportCsv = () => {
    const headers = ['رقم الطلب', 'اسم العميل', 'رقم الواتساب', 'تاريخ الزيارة', 'وقت الفترة', 'عدد التصاريح', 'عدد التصاريح ذكر', 'عدد التصاريح أنثى', 'نوع الحجز', 'العملة', 'الإجمالي', 'المدفوع', 'المتبقي', 'حالة الطلب', 'موقف الإرسال'];

    if (filteredOrders.length === 0) {
      // تصدير ملف CSV بالترويسات فقط حتى تتأكد أن الأداة تعمل وأن الملف صالح
      downloadCsv(`orders-empty-${todayRiyadh()}`, headers, []);
      toast.warning(
        'لا توجد طلبات مطابقة للفلاتر الحالية — تم تصدير ملف CSV بالترويسات فقط. ' +
        'جرّب إزالة الفلاتر (اضغط «الكل») لعرض جميع الطلبات ثم صدّرها.'
      );
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
      headers,
      filteredOrders.map(order => [
        order.orderNumber,
        order.customerName,
        order.customerWhatsapp,
        order.targetDate,
        order.targetTime,
        order.permitsCount,
        order.permitsCountMale ?? '',
        order.permitsCountFemale ?? '',
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

    let matchesQuick = true;
    if (quickFilter === 'today') matchesQuick = order.targetDate === today;
    if (quickFilter === 'tomorrow') matchesQuick = order.targetDate === tomorrowStr;
    if (quickFilter === 'unpaid') matchesQuick = order.paidAmount < order.totalAmount;
    if (quickFilter === 'unsent') matchesQuick = order.deliveryStatus !== 'sent';
    if (quickFilter === 'overdue') matchesQuick = order.targetDate < today && order.paidAmount < order.totalAmount && order.orderStatus !== 'cancelled';

    return matchesSearch && matchesStatus && matchesType && matchesArchive && matchesQuick;
  });

  // === الترتيب الذكي: طلبات اليوم اللي عدى موعدها تطلع فوق، وبعدها علامة "الوقت الحالي" ثم طلبات اليوم الجاية ===
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick(v => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const riyadhNow = useMemo(() => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date()).split(':').map(Number);
    return { min: h * 60 + m, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
  }, [nowTick]);

  const slotMinutes = (t?: string) => {
    if (!t) return 24 * 60;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const isOrderTimePassed = (o: SalesOrder) =>
    o.targetDate === today && slotMinutes(o.targetTime) <= riyadhNow.min && o.orderStatus !== 'cancelled';

  const pastTodayCount = filteredOrders.filter(isOrderTimePassed).length;

  const smartOrders = useMemo(() => {
    if (viewMode === 'archived') return filteredOrders;
    const pastToday = filteredOrders.filter(isOrderTimePassed);
    const upcomingToday = filteredOrders.filter(o => o.targetDate === today && !isOrderTimePassed(o));
    const others = filteredOrders.filter(o => o.targetDate !== today);
    const byTime = (a: SalesOrder, b: SalesOrder) => slotMinutes(a.targetTime) - slotMinutes(b.targetTime);
    return [...pastToday.sort(byTime), ...upcomingToday.sort(byTime), ...others];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredOrders, viewMode, today, riyadhNow]);

  const activeOrdersCount = orders.filter(o => !o.isArchived).length;
  const archivedOrdersCount = orders.filter(o => o.isArchived).length;
  const todayOrders = orders.filter(o => !o.isArchived && o.targetDate === today);
  const todayOrdersCount = todayOrders.length;
  // عدد تصاريح اليوم (لمعرفة حجم الحمل اليومي بجانب عدد الطلبات)
  const todayPermitsCount = todayOrders.reduce((sum, o) => sum + o.permitsCount, 0);
  const tomorrowOrdersCount = orders.filter(o => !o.isArchived && o.targetDate === tomorrowStr).length;
  const unpaidOrdersCount = orders.filter(o => !o.isArchived && o.paidAmount < o.totalAmount).length;
  const unsentOrdersCount = orders.filter(o => !o.isArchived && o.deliveryStatus !== 'sent').length;
  const overdueOrdersCount = orders.filter(
    o => !o.isArchived && o.targetDate < today && o.paidAmount < o.totalAmount && o.orderStatus !== 'cancelled'
  ).length;

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
  const canCreate = currentUser.role === 'super_admin' || Boolean(currentUser.customPermissions?.create);

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

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء طلب بيع جديد</span>
          </button>
        )}
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

      {/* Quick Filter Pills */}
      {viewMode === 'active' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQuickFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              quickFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            كل الطلبات النشطة ({activeOrdersCount})
          </button>
          <button
            onClick={() => setQuickFilter('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              quickFilter === 'today'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
            }`}
          >
            <span>📅 طلبات اليوم</span>
            <span className="bg-emerald-800 text-white px-1.5 py-0.5 rounded-full text-[10px]">{todayOrdersCount}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] border ${
              quickFilter === 'today'
                ? 'bg-white/20 text-white border-white/40'
                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
            }`} title="إجمالي عدد التصاريح المطلوبة اليوم">
              {todayPermitsCount} تصريح
            </span>
          </button>
          <button
            onClick={() => setQuickFilter('tomorrow')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              quickFilter === 'tomorrow'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100/70'
            }`}
          >
            <span>🌅 طلبات الغد</span>
            <span className="bg-blue-800 text-white px-1.5 py-0.5 rounded-full text-[10px]">{tomorrowOrdersCount}</span>
          </button>
          <button
            onClick={() => setQuickFilter('unpaid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              quickFilter === 'unpaid'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100/70'
            }`}
          >
            <span>💳 بانتظار السداد</span>
            <span className="bg-amber-800 text-white px-1.5 py-0.5 rounded-full text-[10px]">{unpaidOrdersCount}</span>
          </button>
          {overdueOrdersCount > 0 && (
            <button
              onClick={() => setQuickFilter('overdue')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                quickFilter === 'overdue'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-red-50/70 text-red-800 border-red-200 hover:bg-red-100/70'
              }`}
            >
              <span>⏰ متأخرات</span>
              <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">{overdueOrdersCount}</span>
            </button>
          )}
          <button
            onClick={() => setQuickFilter('unsent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              quickFilter === 'unsent'
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-purple-50/70 text-purple-800 border-purple-200 hover:bg-purple-100/70'
            }`}
          >
            <span>💬 بانتظار الإرسال</span>
            <span className="bg-purple-800 text-white px-1.5 py-0.5 rounded-full text-[10px]">{unsentOrdersCount}</span>
          </button>
        </div>
      )}

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
              {smartOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 font-medium">
                    {viewMode === 'archived' ? 'لا توجد طلبات مؤرشفة مطابقة.' : 'لا توجد طلبات مطابقة للبحث.'}
                  </td>
                </tr>
              ) : (
                smartOrders.map((order, idx) => {
                  const isFullyPaid = order.paidAmount >= order.totalAmount && order.totalAmount > 0;
                  const orderSym = currencySymbol(getOrderCurrency(order));

                  // 1. جلب التصاريح المرتبطة بالطلب مباشرة
                  const directPermitIds = order.assignedPermitIds || [];
                  let claimedPermits = directPermitIds
                    .map(id => permitById[id])
                    .filter(Boolean) as Permit[];

                  // 2. فحص ذكي: إذا لم تكن مرتبطة بالـ ID لكن العميل مخصص له تصاريح في المخزون
                  if (claimedPermits.length < order.permitsCount) {
                    const customerPermits = permits.filter(p => 
                      p.status === 'assigned' && 
                      p.assignedToCustomerId === order.customerId && 
                      !claimedPermits.some(cp => cp.id === p.id)
                    );
                    claimedPermits = [...claimedPermits, ...customerPermits].slice(0, order.permitsCount);
                  }

                  // 3. إذا كان التصريح مسحوباً ومخصصاً، تصبح حالة الطلب «مؤكد» تلقائياً
                  const effectiveOrderStatus: OrderStatus = 
                    claimedPermits.length > 0 && order.orderStatus !== 'cancelled'
                      ? 'confirmed'
                      : order.orderStatus;

                  return (
                    <React.Fragment key={order.id}>
                      {idx === pastTodayCount && pastTodayCount > 0 && viewMode !== 'archived' && (
                        <tr className="bg-amber-50/80">
                          <td colSpan={9} className="py-1.5 px-4 text-center text-[11px] font-bold text-amber-800">
                            ⏰ الوقت الحالي بتوقيت الرياض — {riyadhNow.label} (الطلبات فوق هذا السطر عدى موعدها)
                          </td>
                        </tr>
                      )}
                      <tr className={`transition-colors ${order.isArchived ? 'bg-slate-50/60 opacity-90' : 'hover:bg-slate-50/80'}`}>
                      {/* Order Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        #{order.orderNumber}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{order.customerName}</div>
                        <div className="text-[11px] font-mono flex items-center gap-2 mt-0.5">
                          <a
                            href={`https://wa.me/${order.customerWhatsapp.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                            title="محادثة واتساب"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600" />
                            <span>{order.customerWhatsapp}</span>
                          </a>
                          <a
                            href={`tel:${order.customerWhatsapp}`}
                            className="text-slate-400 hover:text-emerald-700 p-0.5 rounded hover:bg-slate-100 transition-colors"
                            title="اتصال هاتفي"
                            aria-label={`اتصال برقم ${order.customerWhatsapp}`}
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                          </a>
                        </div>
                      </td>

                      {/* Target Date & Time */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{order.targetDate}</div>
                        <div className="text-[11px] text-amber-700 font-mono font-bold">الساعة: {order.targetTime}</div>
                        {isOrderTimePassed(order) && !order.isArchived && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold mt-0.5 inline-block">
                            ⏰ عدى موعدها
                          </span>
                        )}
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
                        {(order.permitsCountMale != null || order.permitsCountFemale != null) && (
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5 flex flex-wrap items-center gap-1">
                            {order.permitsCountMale != null && order.permitsCountMale > 0 && (
                              <span className="text-blue-700">👨 {order.permitsCountMale} ذكر</span>
                            )}
                            {order.permitsCountFemale != null && order.permitsCountFemale > 0 && (
                              <span className="text-pink-700">🧕 {order.permitsCountFemale} أنثى</span>
                            )}
                          </div>
                        )}
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
                          value={effectiveOrderStatus}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                          className={`border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none transition-all ${
                            effectiveOrderStatus === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : effectiveOrderStatus === 'searching'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-50 text-slate-800 border-slate-200'
                          }`}
                        >
                          <option value="confirmed">مؤكد ✓</option>
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
                                onClick={() => handleOpenWhatsAppModal(order)}
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

                              {/* Direct Payment Button — يسجّل السداد باسم الموظف عشان يتحاسب عليه آخر اليوم */}
                              {!isFullyPaid && (
                                <button
                                  onClick={() => handleOpenPayment(order)}
                                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 transition-all shadow-sm"
                                  title="تسجيل سداد مباشر — يُحسب باسمك في تقرير آخر اليوم"
                                >
                                  <Banknote className="w-4 h-4" />
                                </button>
                              )}

                              {/* Payment Reminder Button — تذكير سداد واتساب + إعادة الإرسال */}
                              {!isFullyPaid && (
                                <button
                                  onClick={() => handleSendPaymentReminder(order)}
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all shadow-sm"
                                  title={
                                    order.lastReminderAt
                                      ? `إعادة إرسال تذكير السداد — آخر تذكير: ${new Date(order.lastReminderAt).toLocaleString('ar-EG', { timeZone: 'Asia/Riyadh', dateStyle: 'short', timeStyle: 'short' })}`
                                      : 'إرسال تذكير سداد للعميل عبر واتساب'
                                  }
                                >
                                  <Bell className="w-4 h-4" />
                                </button>
                              )}
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

                              {/* Edit Order Button */}
                              <button
                                onClick={() => handleOpenEditOrder(order)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all shadow-sm"
                                title="تعديل بيانات وموعد الطلب"
                              >
                                <Edit className="w-4 h-4" />
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

                          {/* Delete Order Button (Super Admin Only) */}
                          {currentUser.role === 'super_admin' && (
                            <button
                              onClick={() => setDeletingOrder(order)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all shadow-sm"
                              title="حذف الطلب نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
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

            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1">اختر العميل:</label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <span className="text-xs font-bold text-emerald-900 truncate">
                    {selectedCustomer.fullName} — <span dir="ltr" className="font-mono">{selectedCustomer.whatsappNumber}</span>
                    {selectedCustomer.nickname ? ` (${selectedCustomer.nickname})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setNewCustomerId(''); setCustomerSearch(''); setShowCustomerList(true); }}
                    className="shrink-0 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                  >
                    تغيير
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerList(true); }}
                    onFocus={() => setShowCustomerList(true)}
                    onBlur={() => setTimeout(() => setShowCustomerList(false), 150)}
                    placeholder="اكتب جزءاً من الاسم أو رقم الموبايل..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                  {customerListVisible && (
                    <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl divide-y divide-slate-50">
                      {filteredCustomers.slice(0, 30).map(c => (
                        <button
                          type="button"
                          key={c.id}
                          // تأخير بسيط حتى لا يسبق الـ blur ويُغلق القائمة قبل التفعيل
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setNewCustomerId(c.id);
                            setCustomerSearch('');
                            setShowCustomerList(false);
                          }}
                          className="w-full text-right px-3 py-2 hover:bg-emerald-50 transition-colors"
                        >
                          <div className="text-xs font-bold text-slate-900">{c.fullName}</div>
                          <div className="text-[11px] text-slate-500 font-mono" dir="ltr">{c.whatsappNumber}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerSearch.trim() && filteredCustomers.length === 0 && (
                    <p className="text-[11px] text-red-600 mt-1 font-bold">لا يوجد عميل مطابق — جرّب اسماً أو رقماً آخر.</p>
                  )}
                </>
              )}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عدد التصاريح — ذكر 👨:
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={newMaleCount}
                  onChange={(e) => setNewMaleCount(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عدد التصاريح — أنثى 🧕:
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={newFemaleCount}
                  onChange={(e) => setNewFemaleCount(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-end">
                {newPermitsCount === 0 ? (
                  <p className="text-[11px] text-rose-600 font-bold bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 w-full">
                    يجب إدخال تصريح واحد على الأقل (ذكر أو أنثى).
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-full">
                    إجمالي التصاريح: {newPermitsCount} — الإجمالي المالي: {newPermitsCount * newUnitPrice} {currencySymbol(newCurrency)}
                  </p>
                )}
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
                disabled={newPermitsCount === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div>
                  <h3 className="text-base font-bold text-slate-900">إرسال للعميل عبر الواتساب</h3>
                  <div className="text-[11px] font-mono text-emerald-700 font-bold flex items-center gap-1.5 mt-0.5">
                    <span>{whatsAppModalOrder.customerName}</span>
                    <span>•</span>
                    <span dir="ltr">{whatsAppModalOrder.customerWhatsapp}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setWhatsAppModalOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* اختيار سريع لمحتوى الرسالة */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">اختر محتوى الرسالة:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyWaPreset('confirm_only')}
                  className="py-2 px-2 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all"
                >
                  🕌 تأكيد وموعد الحجز فقط
                </button>
                <button
                  type="button"
                  onClick={() => applyWaPreset('code_only')}
                  className="py-2 px-2 rounded-xl text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-all"
                >
                  🎫 صورة الكود فقط
                </button>
                <button
                  type="button"
                  onClick={() => applyWaPreset('payment_only')}
                  className="py-2 px-2 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all"
                >
                  💳 رسالة المطالبة فقط
                </button>
                <button
                  type="button"
                  onClick={() => applyWaPreset('all')}
                  className="py-2 px-2 rounded-xl text-[11px] font-bold bg-slate-700 text-white border border-slate-700 hover:bg-slate-800 transition-all"
                >
                  📦 الكل دفعة واحدة
                </button>
              </div>
            </div>

            {/* تخصيص دقيق للأجزاء */}
            <div className="flex flex-wrap gap-1.5">
              {([
                ['confirmAndVisit', 'تأكيد الحجز + الموعد'],
                ['permits', 'عدد التصاريح'],
                ['paymentDemand', 'المطالبة + التحويل'],
                ['bankAccounts', 'أرقام الحسابات'],
                ['permitCodes', 'أكواد التصاريح'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const next = { ...waInclude, [key]: !waInclude[key] };
                    setWaInclude(next);
                    if (whatsAppModalOrder) {
                      setCustomWhatsAppText(buildWhatsAppMessage(whatsAppModalOrder, next));
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                    waInclude[key]
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {waInclude[key] ? '✓ ' : ''}{label}
                </button>
              ))}
            </div>

            {/* صندوق نص الرسالة مع إمكانية التعديل المباشر وإعادة الضبط من القالب */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">
                  نص الرسالة (يمكنك تعديل أي كلمة هنا قبل الإرسال):
                </label>
                <button
                  type="button"
                  onClick={() => setCustomWhatsAppText(buildWhatsAppMessage(whatsAppModalOrder))}
                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition-colors"
                  title="إعادة توليد النص من القالب المعتمد في الإعدادات"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة ضبط من القالب</span>
                </button>
              </div>
              <textarea
                rows={5}
                value={customWhatsAppText}
                onChange={(e) => setCustomWhatsAppText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-600 transition-all leading-relaxed"
                dir="rtl"
              />
            </div>

            {/* عرض صور التصاريح المخصصة مع أزرار الإرسال المباشر والنسخ والتحميل */}
            {(() => {
              const direct = (whatsAppModalOrder.assignedPermitIds || [])
                .map(id => permitById[id])
                .filter(Boolean) as Permit[];
              const claimed = direct.length > 0 
                ? direct 
                : permits.filter(p => p.status === 'assigned' && p.assignedToCustomerId === whatsAppModalOrder.customerId);
              
              if (claimed.length === 0) return null;

              return (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>صور التصاريح المخصصة ({claimed.length}):</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold">جاهزة للإرسال</span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {claimed.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-emerald-100 shadow-xs">
                        <div className="flex items-center gap-2">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.permitCode} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                              <Ticket className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-mono font-bold text-slate-800">{p.permitCode}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.slotDate} ({p.slotFormatted})</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {p.imageUrl && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSendPermitDirect(p)}
                                className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-all min-h-[36px]"
                                title="فتح محادثة رقم العميل في واتساب فوراً وبها كود التصريح وموعده ورابط صورة التصريح والباركود المباشر"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>إرسال الكود والصورة للعميل مباشرة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSharePermitImage(p.imageUrl, p.permitCode)}
                                className="px-2.5 py-2 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all min-h-[36px]"
                                title="مشاركة ملف الصورة عبر قائمة تطبيقات النظام"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>مشاركة كملف</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyPermitImage(p.imageUrl, p.permitCode)}
                                className="px-2.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold hidden sm:flex items-center gap-1 shadow-xs transition-all min-h-[36px]"
                                title="نسخ صورة التصريح للحافظة (للصقها بالواتساب Ctrl+V)"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>نسخ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadPermitImage(p.imageUrl, p.permitCode)}
                                className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all min-h-[36px]"
                                title="حفظ صورة التصريح على جهازك"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>حفظ الصورة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPermitPreview(p)}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                                title="معاينة الصورة"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-emerald-800 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-emerald-200">
                    💡 <strong>الإرسال المباشر للعميل:</strong> اضغط <strong>«إرسال الكود والصورة للعميل مباشرة»</strong> ليفتح محادثة رقم العميل في واتساب فوراً وفيها كود التصريح وموعده ورابط صورة التصريح والباركود المباشر، دون الحاجة لتسجيل رقمه في هاتفك أو البحث عنه.
                  </p>
                </div>
              );
            })()}

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

            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {permitPreview.imageUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSharePermitImage(permitPreview.imageUrl!, permitPreview.permitCode)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    مشاركة / إرسال
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPermitImage(permitPreview.imageUrl!, permitPreview.permitCode)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تحميل الصورة
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => handleUnassignPermit(permitPreview.id)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center gap-1.5"
                title="إرجاع التصريح للمخزون متاحاً وفك ارتباطه عن العميل والطلب"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إرجاع للمخزون
              </button>
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

      {/* DIRECT PAYMENT MODAL — زر تم السداد المباشر، يُسجّل باسم الموظف */}
      {paymentModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => !paymentSubmitting && setPaymentModalOrder(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                <span>تسجيل سداد — طلب #{paymentModalOrder.orderNumber}</span>
              </h3>
              <button onClick={() => !paymentSubmitting && setPaymentModalOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-600">العميل:</span><span className="font-bold text-slate-900">{paymentModalOrder.customerName}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">الإجمالي:</span><span className="font-bold font-mono">{paymentModalOrder.totalAmount} {currencySymbol(getOrderCurrency(paymentModalOrder))}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">المدفوع:</span><span className="font-bold font-mono">{paymentModalOrder.paidAmount} {currencySymbol(getOrderCurrency(paymentModalOrder))}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">المتبقي:</span><span className="font-bold font-mono text-emerald-800">{Math.max(0, Math.round((paymentModalOrder.totalAmount - paymentModalOrder.paidAmount) * 100) / 100)} {currencySymbol(getOrderCurrency(paymentModalOrder))}</span></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">المبلغ المُستلم</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono font-bold outline-none"
                placeholder="0"
                disabled={paymentSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">ملاحظة (اختياري)</label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm outline-none"
                placeholder="مثال: استلام نقدي / تحويل فودافون كاش"
                disabled={paymentSubmitting}
              />
            </div>

            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed">
              💡 سيُسجَّل هذا السداد باسمك (<strong>{currentUser.fullName}</strong>) في تقرير تحصيل آخر اليوم، ليتحاسب كل موظف على ما قبضه.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setPaymentModalOrder(null)}
                disabled={paymentSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={paymentSubmitting || !paymentAmount || Number(paymentAmount) <= 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                {paymentSubmitting ? 'جاري التسجيل...' : 'تأكيد السداد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ORDER MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleSaveEditOrder} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-emerald-600" />
                <span>تعديل بيانات الطلب #{editingOrder.orderNumber}</span>
              </h3>
              <button type="button" onClick={() => !isSubmittingEdit && setEditingOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-500">العميل: </span>
                <span className="font-bold text-slate-900">{editingOrder.customerName}</span>
              </div>
              <div className="font-mono text-emerald-700 font-bold" dir="ltr">{editingOrder.customerWhatsapp}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الزيارة:</label>
                <input
                  type="date"
                  required
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وقت الفترة:</label>
                <div className="flex items-center gap-1">
                  <select
                    value={editTargetHour}
                    onChange={(e) => setEditTargetHour(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono font-bold text-slate-900"
                  >
                    {Array.from({ length: 24 }).map((_, i) => {
                      const val = String(i).padStart(2, '0');
                      return <option key={val} value={val}>{val}:00</option>;
                    })}
                  </select>
                  <span className="font-bold text-slate-400">:</span>
                  <select
                    value={editTargetMin}
                    onChange={(e) => setEditTargetMin(e.target.value)}
                    className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono font-bold text-slate-900"
                  >
                    <option value="00">00</option>
                    <option value="20">20</option>
                    <option value="40">40</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عدد تصاريح الرجال (👨):</label>
                <input
                  type="number"
                  min="0"
                  value={editMaleCount}
                  onChange={(e) => setEditMaleCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عدد تصاريح النساء (🧕):</label>
                <input
                  type="number"
                  min="0"
                  value={editFemaleCount}
                  onChange={(e) => setEditFemaleCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سعر التصريح الواحد:</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العملة:</label>
                <select
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value as CurrencyCode)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="EGP">جنيه مصري (EGP)</option>
                </select>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs flex justify-between items-center font-bold">
              <span className="text-emerald-900">إجمالي الطلب الجديد:</span>
              <span className="text-emerald-800 text-sm font-mono">
                {((editMaleCount + editFemaleCount) * editUnitPrice).toFixed(2)} {currencySymbol(editCurrency)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الطلب:</label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="أية تفاصيل إضافية..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                disabled={isSubmittingEdit}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit || (editMaleCount + editFemaleCount === 0)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {isSubmittingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE ORDER MODAL */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف الطلب نهائياً</h3>
                <p className="text-xs text-rose-600 font-bold">هذا الإجراء مخصص للمدير العام ولا يمكن التراجع عنه.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">رقم الطلب:</span><span className="font-mono font-bold text-slate-900">#{deletingOrder.orderNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">اسم العميل:</span><span className="font-bold text-slate-900">{deletingOrder.customerName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">المبلغ الإجمالي:</span><span className="font-mono font-bold">{deletingOrder.totalAmount} {currencySymbol(getOrderCurrency(deletingOrder))}</span></div>
              {deletingOrder.assignedPermitIds && deletingOrder.assignedPermitIds.length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-bold text-[11px] mt-2">
                  ⚠️ يحتوي هذا الطلب على {deletingOrder.assignedPermitIds.length} تصريح مسحوب — سيتم إرجاعها للمخزون متاحاً تلقائياً فور الحذف.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                disabled={isSubmittingDelete}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                disabled={isSubmittingDelete}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isSubmittingDelete ? 'جاري الحذف...' : 'نعم، احذف الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
