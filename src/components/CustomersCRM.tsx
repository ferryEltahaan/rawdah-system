import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  MessageCircle, 
  Tag, 
  ShoppingBag, 
  Edit,
  Share2,
  UploadCloud,
  Download,
  Copy,
  Check,
  QrCode,
  FileText,
  AlertCircle,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Customer, SalesOrder, UserProfile } from '../types';
import { DataService } from '../services/dataService';
import { currencySymbol, getOrderCurrency } from '../utils/currency';
import { validateWhatsappNumber } from '../utils/phoneValidation';
import { downloadCsv, formatDateTimeRiyadh, todayRiyadh } from '../utils/csvHelpers';
import { useToast } from './Toast';
import confetti from 'canvas-confetti';

interface CustomersCRMProps {
  currentUser: UserProfile;
}

interface ParsedContact {
  fullName: string;
  whatsappNumber: string;
  additionalPhone?: string;
  nickname?: string;
  notes?: string;
  isDuplicate?: boolean;
}

export const CustomersCRM: React.FC<CustomersCRMProps> = ({ currentUser }) => {
  const [customers, setCustomers] = useState<Customer[]>(DataService.getCustomers());
  const [orders, setOrders] = useState<SalesOrder[]>(DataService.getOrders());
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states (Add/Edit)
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [additionalPhone, setAdditionalPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [notes, setNotes] = useState('');

  // Share link state
  const [isCopied, setIsCopied] = useState(false);

  // Import state
  const [importTab, setImportTab] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshData = () => {
    setCustomers(DataService.getCustomers());
    setOrders(DataService.getOrders());
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await DataService.syncFromCloud();
      refreshData();
      toast.success('تمت المزامنة مع السحابة وتحديث سجل العملاء بنجاح!');
    } catch (e) {
      toast.error('حدث خطأ أثناء المزامنة السحابية.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

  const cleanPhone = (phone: string) => phone.replace(/[^\d+]/g, '');

  const getRegistrationUrl = () => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?register=true`;
  };

  const handleOpenAdd = () => {
    setFullName('');
    setWhatsappNumber('');
    setAdditionalPhone('');
    setNickname('');
    setNotes('');
    setEditingCustomer(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFullName(c.fullName);
    setWhatsappNumber(c.whatsappNumber);
    setAdditionalPhone(c.additionalPhone || '');
    setNickname(c.nickname || '');
    setNotes(c.notes || '');
    setShowAddModal(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();

    const wValidation = validateWhatsappNumber(whatsappNumber);
    if (!wValidation.valid) {
      toast.error(wValidation.error);
      return;
    }
    let normalizedAdditional = '';
    if (additionalPhone.trim()) {
      const aValidation = validateWhatsappNumber(additionalPhone);
      if (!aValidation.valid) {
        toast.error('الهاتف الإضافي: ' + aValidation.error);
        return;
      }
      normalizedAdditional = aValidation.normalized;
    }

    DataService.saveCustomer({
      id: editingCustomer ? editingCustomer.id : undefined,
      fullName,
      whatsappNumber: wValidation.normalized,
      additionalPhone: normalizedAdditional,
      nickname,
      notes,
    });

    confetti({ particleCount: 40, spread: 50 });
    toast.success(
      editingCustomer
        ? 'تم تحديث بيانات العميل — وسيظهر الاسم والواتساب الجديدان في كل طلباته السابقة.'
        : 'تم إضافة العميل الجديد بنجاح.'
    );
    refreshData();
    setShowAddModal(false);
  };

  const handleCopyLink = () => {
    const url = getRegistrationUrl();
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    toast.success('تم نسخ رابط تسجيل العملاء بنجاح!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await DataService.deleteCustomer(deletingCustomer.id);
      if (res.success) {
        toast.success(res.message);
        setDeletingCustomer(null);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (customers.length === 0) {
      toast.warning('لا يوجد عملاء لتصديرهم.');
      return;
    }

    const headers = ['الاسم الكامل', 'رقم الواتساب', 'الهاتف الإضافي', 'اسم حساب الواتساب / اللقب', 'ملاحظات', 'إجمالي الطلبات', 'تاريخ التسجيل'];
    const rows = customers.map(c => [
      c.fullName,
      c.whatsappNumber,
      c.additionalPhone || '',
      c.nickname || '',
      c.notes || '',
      c.totalOrdersCount || 0,
      c.createdAt ? formatDateTimeRiyadh(c.createdAt) : '',
    ]);

    downloadCsv(`customers-${todayRiyadh()}`, headers, rows, [5]);
    toast.success(`تم تصدير ${customers.length} عميل إلى ملف CSV بنجاح.`);
  };

  // --- vCard (.vcf) & CSV Parser ---
  const parseVCardContent = (vcfText: string): ParsedContact[] => {
    const cards = vcfText.split(/BEGIN:VCARD/i).filter(c => c.trim().length > 0);
    const results: ParsedContact[] = [];

    cards.forEach(card => {
      let name = '';
      let phones: string[] = [];
      let note = '';

      const lines = card.split(/\r\n|\r|\n/);
      lines.forEach(line => {
        if (/^FN(;.*)?:/i.test(line)) {
          name = line.replace(/^FN(;.*)?:/i, '').trim();
        } else if (!name && /^N(;.*)?:/i.test(line)) {
          const parts = line.replace(/^N(;.*)?:/i, '').split(';').map(p => p.trim()).filter(Boolean);
          name = parts.reverse().join(' ');
        } else if (/^TEL(;.*)?:/i.test(line)) {
          const rawPhone = line.replace(/^TEL(;.*)?:/i, '').trim();
          const clean = cleanPhone(rawPhone);
          if (clean.length >= 7) phones.push(clean);
        } else if (/^NOTE(;.*)?:/i.test(line)) {
          note = line.replace(/^NOTE(;.*)?:/i, '').trim();
        }
      });

      if (name && phones.length > 0) {
        results.push({
          fullName: name,
          whatsappNumber: phones[0],
          additionalPhone: phones[1] || undefined,
          notes: note || undefined,
        });
      }
    });

    return results;
  };

  const parseCSVContent = (csvText: string): ParsedContact[] => {
    const lines = csvText.split(/\r\n|\r|\n/).filter(l => l.trim().length > 0);
    const results: ParsedContact[] = [];

    lines.forEach((line, index) => {
      // Skip header if line contains words like 'الاسم' or 'name' or 'phone'
      if (index === 0 && (line.includes('name') || line.includes('اسم') || line.includes('phone') || line.includes('واتساب'))) {
        return;
      }

      // Handle comma, semicolon, or tab separation
      const delimiter = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
      const parts = line.split(delimiter).map(p => p.replace(/^"|"$/g, '').trim());

      if (parts.length >= 2) {
        const p1 = parts[0];
        const p2 = parts[1];
        // Check which column is phone
        const p1IsPhone = /^[\d+\s()-]{7,}$/.test(p1);
        const p2IsPhone = /^[\d+\s()-]{7,}$/.test(p2);

        let name = '';
        let phone = '';

        if (p1IsPhone && !p2IsPhone) {
          phone = cleanPhone(p1);
          name = p2;
        } else {
          name = p1;
          phone = cleanPhone(p2);
        }

        if (name && phone) {
          results.push({
            fullName: name,
            whatsappNumber: phone,
            additionalPhone: parts[2] ? cleanPhone(parts[2]) : undefined,
            nickname: parts[3] || undefined,
            notes: parts[4] || undefined,
          });
        }
      }
    });

    return results;
  };

  const parseFreeText = (text: string): ParsedContact[] => {
    const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim().length > 0);
    const results: ParsedContact[] = [];

    lines.forEach(line => {
      // Look for phone numbers in the line (+966..., +20..., 05..., 01..., etc.)
      const phoneMatch = line.match(/(\+?\d[\d\s\-()]{7,16}\d)/);
      if (phoneMatch) {
        const rawPhone = phoneMatch[1];
        const phone = cleanPhone(rawPhone);
        let name = line.replace(rawPhone, '').replace(/[-:,|/]/g, ' ').trim();
        name = name.replace(/\s+/g, ' ');

        if (!name) name = `عميل واتساب (${phone.slice(-4)})`;

        results.push({
          fullName: name,
          whatsappNumber: phone,
        });
      }
    });

    return results;
  };

  const processImportList = (list: ParsedContact[]) => {
    const existing = DataService.getCustomers();
    const marked = list.map(item => {
      const cleanW = cleanPhone(item.whatsappNumber);
      const isDup = existing.some(e => {
        const ePhone = cleanPhone(e.whatsappNumber);
        return ePhone === cleanW || (cleanW.length >= 9 && ePhone.endsWith(cleanW)) || (ePhone.length >= 9 && cleanW.endsWith(ePhone));
      });
      return { ...item, isDuplicate: isDup };
    });
    setParsedContacts(marked);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      let parsed: ParsedContact[] = [];
      if (file.name.toLowerCase().endsWith('.vcf')) {
        parsed = parseVCardContent(content);
      } else {
        parsed = parseCSVContent(content);
      }

      if (parsed.length === 0) {
        toast.warning('لم يتم العثور على جهات اتصال صالحة في الملف.');
      } else {
        processImportList(parsed);
        toast.info(`تم قراءة ${parsed.length} جهة اتصال من الملف.`);
      }
    };
    reader.readAsText(file);
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      toast.warning('يرجى لصق نص يحتوي على أرقام وأسماء العملاء أولاً.');
      return;
    }
    const parsed = parseFreeText(pastedText);
    if (parsed.length === 0) {
      toast.warning('لم يتم التعرف على أي أرقام هواتف في النص الملصوق.');
      return;
    }
    processImportList(parsed);
    toast.info(`تم استخراج ${parsed.length} جهة اتصال من النص.`);
  };

  const handleExecuteImport = async () => {
    if (parsedContacts.length === 0) return;

    setIsImporting(true);
    try {
      const result = await DataService.saveCustomersBulk(parsedContacts);
      confetti({ particleCount: 50, spread: 60 });
      toast.success(`تم استيراد ${result.added} عميل جديد، وتحديث بيانات ${result.updated} عميل بنجاح!`);
      refreshData();
      setShowImportModal(false);
      setParsedContacts([]);
      setPastedText('');
    } catch (err) {
      toast.error('حدث خطأ أثناء استيراد العملاء.');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.whatsappNumber.includes(searchQuery) ||
    (c.additionalPhone && c.additionalPhone.includes(searchQuery)) ||
    (c.nickname && c.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // إجمالي المسدد لكل عميل مجمّعاً حسب العملة
  const spentByCustomer = (customerId: string): { code: 'SAR' | 'EGP'; amount: number }[] => {
    const sums: Record<'SAR' | 'EGP', number> = { SAR: 0, EGP: 0 };
    orders.forEach(o => {
      if (o.customerId === customerId) sums[getOrderCurrency(o)] += o.paidAmount;
    });
    return (['SAR', 'EGP'] as const)
      .filter(code => sums[code] > 0)
      .map(code => ({ code, amount: sums[code] }));
  };

  const shareWhatsappMessage = encodeURIComponent(
    `السلام عليكم ورحمة الله وبركاته،\nلتسهيل وسرعة إصدار وتنسيق تصاريح الروضة الشريفة لموسم الزيارة، يرجى التكرم بتسجيل بياناتكم الكريمة عبر الرابط التالي:\n\n${getRegistrationUrl()}\n\nشاكرين ومقدرين لكم.`
  );

  return (
    <div className="space-y-6 font-cairo">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>سجل وقاعدة بيانات العملاء</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              {customers.length} عميل
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            إدارة بيانات المعتمرين، أرقام الواتساب، ورابط التسجيل الذاتي للعملاء مع ميزة الاستيراد الذكي.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Share Link Button */}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-3.5 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all"
            title="مشاركة رابط تسجيل العملاء عبر واتساب"
          >
            <Share2 className="w-4 h-4" />
            <span>رابط تسجيل العملاء</span>
          </button>

          {/* Bulk Import Button */}
          <button
            onClick={() => {
              setParsedContacts([]);
              setShowImportModal(true);
            }}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2.5 rounded-2xl text-xs shadow-md transition-all"
            title="استيراد جهات اتصال من واتساب أو ملف"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>استيراد جهات اتصال</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2.5 rounded-2xl text-xs transition-all border border-slate-200"
            title="تصدير جدول العملاء"
          >
            <Download className="w-4 h-4" />
            <span>تصدير</span>
          </button>

          {/* Cloud Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2.5 rounded-2xl text-xs transition-all border border-slate-200 disabled:opacity-50"
            title="تحديث البيانات فوراً من السحابة"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جاري التحديث...' : 'تحديث من السحابة'}</span>
          </button>

          {/* Add Single Customer Button */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3.5 py-2.5 rounded-2xl text-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة عميل</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <Search className="w-4 h-4 text-slate-400 absolute right-7 top-7" />
        <input
          type="text"
          placeholder="ابحث بالاسم، رقم الواتساب، الهاتف الإضافي، أو النيك نيم للواتساب..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Customers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(customer => (
          <div 
            key={customer.id} 
            className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 hover:border-emerald-500/50 transition-all shadow-sm hover:shadow-md group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200 font-black text-sm flex items-center justify-center shadow-sm">
                  {customer.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{customer.fullName}</h3>
                  {customer.nickname && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-700 font-semibold mt-0.5">
                      <Tag className="w-3 h-3" />
                      <span>{customer.nickname}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(customer)}
                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors border border-slate-200 shadow-sm"
                  title="تعديل بيانات العميل"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                {currentUser.role === 'super_admin' && (
                  <button
                    onClick={() => setDeletingCustomer(customer)}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-100 text-slate-500 hover:text-rose-700 transition-colors border border-slate-200 shadow-sm"
                    title="حذف العميل نهائياً"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>الواتساب:</span>
                </span>
                <a
                  href={`https://wa.me/${customer.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-700 hover:underline font-bold flex items-center gap-1"
                >
                  {customer.whatsappNumber}
                </a>
              </div>

              {customer.additionalPhone && (
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>رقم إضافي:</span>
                  </span>
                  <span className="font-mono text-slate-800">{customer.additionalPhone}</span>
                </div>
              )}

              {customer.notes && (
                <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200 line-clamp-3">
                  {customer.notes}
                </p>
              )}
            </div>

            {/* Orders Statistics */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px]">
              <div className="flex items-center gap-1 text-slate-500 font-medium">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span>إجمالي الطلبات: <strong className="text-slate-800">{customer.totalOrdersCount}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {(() => {
                  const chips = spentByCustomer(customer.id);
                  if (chips.length === 0) {
                    return <span className="font-mono font-bold text-slate-400">0 ر.س</span>;
                  }
                  return chips.map(chip => (
                    <span
                      key={chip.code}
                      className={`font-mono font-bold px-2 py-0.5 rounded-full border ${
                        chip.code === 'SAR'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                      title={`إجمالي المسدد بال${chip.code === 'SAR' ? 'ريال' : 'جنيه'}`}
                    >
                      {chip.amount} {currencySymbol(chip.code)}
                    </span>
                  ));
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL 1: SHARE SELF-REGISTRATION LINK */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">رابط التسجيل الذاتي للعملاء</h3>
                  <p className="text-[11px] text-slate-500">أرسل هذا الرابط للعملاء على الواتساب ليسجلوا بياناتهم مباشرة.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowShareModal(false)} 
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* URL Display and Copy Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">رابط الصفحة المباشر:</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2.5">
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={getRegistrationUrl()}
                  className="bg-transparent text-xs text-slate-700 font-mono flex-1 outline-none px-2"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'تم النسخ!' : 'نسخ'}</span>
                </button>
              </div>
            </div>

            {/* WhatsApp Quick Share Button */}
            <div>
              <a
                href={`https://api.whatsapp.com/send?text=${shareWhatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md shadow-emerald-500/20"
              >
                <MessageCircle className="w-4 h-4 fill-white text-[#25D366]" />
                <span>إرسال دعوة التسجيل عبر الواتساب فوراً</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>

            {/* QR Code Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right">
              <div className="w-28 h-28 bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getRegistrationUrl())}`}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-slate-900">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>رمز QR Code للمسح السريع</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  يمكن للعميل مسح هذا الرمز بكاميرا جواله أو عرضه في مكتبك/إعلاناتك ليفتح صفحة التسجيل فوراً.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: SMART BULK IMPORT CONTACTS */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">استيراد جهات اتصال العملاء دفعة واحدة</h3>
                  <p className="text-[11px] text-slate-500">سحب الأسماء والأرقام من ملفات الهاتف، واتساب، أو النسخ واللصق الذكي.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowImportModal(false)} 
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Import Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setImportTab('file')}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  importTab === 'file' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>رفع ملف جهات اتصال (VCF / CSV)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportTab('paste')}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  importTab === 'paste' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>لصق نصي ذكي من شات الواتساب</span>
              </button>
            </div>

            {/* Tab 1: File Upload */}
            {importTab === 'file' && (
              <div className="space-y-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-emerald-50/40"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".vcf,.csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <UploadCloud className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">انقر لاختيار ملف جهات اتصال (.vcf أو .csv)</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    يدعم ملفات <strong>vCard (.vcf)</strong> المصدّرة من الهاتف أو الواتساب، وجداول Excel المحفوظة بصيغة <strong>CSV</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Smart Paste */}
            {importTab === 'paste' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>الصق النص المنسوخ من رسالة أو قروب الواتساب:</span>
                  <span className="text-[10px] text-emerald-600 font-normal">يتعرف النظام على الأرقام والأسماء تلقائياً</span>
                </label>
                <textarea
                  rows={4}
                  placeholder={`مثال:\nمحمد أحمد +966501234567\nعبدالله الراجحي 0555123456\n+201098765432 محمود علي`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تحليل واستخراج الأسماء والأرقام</span>
                </button>
              </div>
            )}

            {/* Preview Table */}
            {parsedContacts.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم التعرف على ({parsedContacts.length}) جهة اتصال:</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({parsedContacts.filter(c => !c.isDuplicate).length} جديد • {parsedContacts.filter(c => c.isDuplicate).length} موجود مسبقاً)
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
                  {parsedContacts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 text-xs bg-white hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-900">{c.fullName}</span>
                        {c.isDuplicate && (
                          <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                            موجود مسبقاً
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-600" dir="ltr">{c.whatsappNumber}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedContacts([]);
                      setPastedText('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    مسح القائمة
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isImporting ? 'جاري الاستيراد...' : `تأكيد وحفظ (${parsedContacts.length}) عميل`}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleSaveCustomer} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>{editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</span>
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل بالكامل:</label>
              <input
                type="text"
                required
                placeholder="مثال: فهد إبراهيم السبيعي"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الواتساب:</label>
              <input
                type="tel"
                required
                dir="ltr"
                placeholder="+966501234567 أو 0501234567"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">يُقبل رقم سعودي (+966) أو مصري (+20) — ويُوحَّد تلقائياً للصيغة الدولية.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف إضافي (اختياري):</label>
              <input
                type="text"
                placeholder="رقم اتصال آخر أو طوارئ..."
                value={additionalPhone}
                onChange={(e) => setAdditionalPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الحساب (النيك نيم للواتساب):
              </label>
              <input
                type="text"
                placeholder="مثال: أبو فهد - الرياض (VIP)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات العميل:</label>
              <textarea
                rows={2}
                placeholder="ملاحظات حول أوقات الحجز المفضلة أو التفضيلات..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              >
                حفظ بيانات العميل
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CUSTOMER CONFIRM MODAL */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>حذف العميل نهائياً</span>
              </h3>
              <button type="button" onClick={() => setDeletingCustomer(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              سيتم حذف العميل <span className="font-black text-slate-900">{deletingCustomer.fullName}</span>
              {' '}(<span className="font-mono" dir="ltr">{deletingCustomer.whatsappNumber}</span>) نهائياً من النظام ومن السحابة.
              <br />
              <span className="text-slate-500">
                لا يمكن حذف عميل له طلبات نشطة أو تصاريح مخصصة باسمه — والطلبات المؤرشفة سابقاً تبقى في السجل بأسمائها.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
