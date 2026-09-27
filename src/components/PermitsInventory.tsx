import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  Clock, 
  Upload, 
  RotateCcw, 
  UserCheck, 
  Eye, 
  Search, 
  Calendar,
  Layers,
  Download,
  Plus,
  Trash2,
  HardDrive,
  MessageCircle,
  Printer
} from 'lucide-react';
import { Permit, Customer, UserProfile, SalesOrder } from '../types';
import { DataService } from '../services/dataService';
import { currencySymbol, getOrderCurrency } from '../utils/currency';
import { useToast } from './Toast';
import { printPermit } from '../utils/printHelpers';
import { compressImageFile, validateImageFile } from '../utils/imageHelpers';
import confetti from 'canvas-confetti';

interface PermitsInventoryProps {
  currentUser: UserProfile;
  onOrderCreated?: () => void;
}

export const PermitsInventory: React.FC<PermitsInventoryProps> = ({ currentUser }) => {
  const toast = useToast();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [selectedMinute, setSelectedMinute] = useState<0 | 20 | 40>(0);
  const [permits, setPermits] = useState<Permit[]>(DataService.getPermits());
  const [customers, setCustomers] = useState<Customer[]>(DataService.getCustomers());
  const [orders, setOrders] = useState<SalesOrder[]>(DataService.getOrders());
  
  // Modals & States
  const [claimingPermit, setClaimingPermit] = useState<Permit | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [claimOrderId, setClaimOrderId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [previewPermit, setPreviewPermit] = useState<Permit | null>(null);
  const [returningPermit, setReturningPermit] = useState<Permit | null>(null);
  const [returnReason, setReturnReason] = useState('تراجع أو إلغاء من قبل العميل');
  
  // Bulk Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadHour, setUploadHour] = useState<number>(0);
  const [uploadMinute, setUploadMinute] = useState<0 | 20 | 40>(0);
  const [uploadUrls, setUploadUrls] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const refreshData = () => {
    setPermits(DataService.getPermits());
    setCustomers(DataService.getCustomers());
    setOrders(DataService.getOrders());
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    setIsProcessingFiles(true);

    const processed: { name: string; url: string }[] = [];
    let skipped = 0;
    let totalBytes = 0;

    for (const file of incoming) {
      if (validateImageFile(file)) {
        skipped += 1;
        continue;
      }
      try {
        const url = await compressImageFile(file, 1200);
        processed.push({ name: file.name, url });
        totalBytes += url.length;
      } catch {
        skipped += 1;
      }
    }

    if (processed.length > 0) {
      setSelectedFiles(prev => [...prev, ...processed]);
      toast.success(
        `تم تجهيز ${processed.length} صورة من الجهاز وضغطها قبل الحفظ (الإجمالي ${Math.max(1, Math.round(totalBytes / 1024))} كيلوبايت).`
      );
    }
    if (skipped > 0) {
      toast.error(
        `تم تخطي ${skipped} ملف — تأكد أنه صورة صالحة أصغر من 10 ميجابايت.`
      );
    }
    setIsProcessingFiles(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes: (0 | 20 | 40)[] = [0, 20, 40];

  const getSlotStats = (hour: number, min: 0 | 20 | 40) => {
    const slotPermits = permits.filter(
      p => p.slotDate === selectedDate && p.slotHour === hour && p.slotMinute === min
    );
    const available = slotPermits.filter(p => p.status === 'available').length;
    const assigned = slotPermits.filter(p => p.status === 'assigned').length;
    return { total: slotPermits.length, available, assigned };
  };

  const getHourStats = (hour: number) => {
    const hourPermits = permits.filter(
      p => p.slotDate === selectedDate && p.slotHour === hour
    );
    const available = hourPermits.filter(p => p.status === 'available').length;
    const assigned = hourPermits.filter(p => p.status === 'assigned').length;
    return { total: hourPermits.length, available, assigned };
  };

  const currentSlotPermits = permits.filter(
    p => p.slotDate === selectedDate && p.slotHour === selectedHour && p.slotMinute === selectedMinute
  );

  const handleClaim = async () => {
    if (!claimingPermit || !selectedCustomerId) return;
    const result = await DataService.claimPermit(claimingPermit.id, selectedCustomerId, claimOrderId || undefined, currentUser);
    if (result.success) {
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      toast.success(result.message);
      refreshData();
      setClaimingPermit(null);
      setSelectedCustomerId('');
      setClaimOrderId('');
      setCustomerSearchQuery('');
    } else {
      toast.error(result.message);
    }
  };

  const handleReturn = async () => {
    if (!returningPermit) return;
    const result = await DataService.returnPermit(returningPermit.id, returnReason, currentUser);
    if (result.success) {
      toast.success(`تم إرجاع التصريح ${returningPermit.permitCode} إلى المخزون.`);
      refreshData();
      setReturningPermit(null);
    } else {
      toast.error(result.message);
    }
  };

  const handleContactCustomerWhatsApp = (permit: Permit) => {
    const customer = customers.find(c => c.id === permit.assignedToCustomerId);
    if (!customer || !customer.whatsappNumber) {
      toast.error('لا يوجد رقم واتساب مسجل لهذا العميل.');
      return;
    }

    const companyName = DataService.getCompanySettings().companyNameAr;
    const message = `السلام عليكم ورحمة الله وبركاته يا ${customer.fullName}،
تم تجهيز تصريح زيارة الروضة الشريفة لكم بنجاح 🕌✨

• رقم التصريح: ${permit.permitCode}
• تاريخ الزيارة: ${permit.slotDate}
• الفترة: ${permit.slotFormatted}

تقبل الله زيارتكم وطاعتكم.
${companyName}`;

    window.open(
      `https://wa.me/${customer.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener'
    );
  };

  const handlePrintPermit = async (permit: Permit) => {
    const customer = customers.find(c => c.id === permit.assignedToCustomerId);
    const opened = await printPermit(permit, customer, DataService.getCompanySettings());
    if (!opened) {
      toast.error('تعذر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة ثم إعادة المحاولة.');
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlsFromText = uploadUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    const urlsFromFiles = selectedFiles.map(f => f.url);
    
    let finalUrls = [...urlsFromFiles, ...urlsFromText];
    if (finalUrls.length === 0) {
      finalUrls = [
        'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=600&auto=format&fit=crop&q=80',
      ];
    }

    await DataService.addPermitsBulk(selectedDate, uploadHour, uploadMinute, finalUrls, uploadNotes);
    refreshData();
    setShowUploadModal(false);
    setUploadUrls('');
    setSelectedFiles([]);
    setUploadNotes('');
  };

  const filteredCustomers = customers.filter(c => 
    c.fullName.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.whatsappNumber.includes(customerSearchQuery) ||
    (c.nickname && c.nickname.toLowerCase().includes(customerSearchQuery.toLowerCase()))
  );

  // طلبات العميل المختار القابلة للربط (غير الملغاة)
  const customerOpenOrders = orders.filter(
    o => o.customerId === selectedCustomerId && o.orderStatus !== 'cancelled'
  );

  // Can upload permits (Admin & Inventory)
  const canUpload = ['super_admin', 'inventory'].includes(currentUser.role);
  // Can claim permits (Admin & Sales)
  const canClaim = ['super_admin', 'sales'].includes(currentUser.role);

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-1">
            <Layers className="w-4 h-4" />
            <span>نظام الفترات الـ 72 الذكي (24 ساعة × 3 فترات / 20 دقيقة)</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">
            مخزون وحجز تصاريح الروضة
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl text-xs shadow-sm">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-500 font-medium">التاريخ:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
            />
          </div>

          {/* Bulk Upload Button (if allowed) */}
          {canUpload && (
            <button
              onClick={() => {
                setUploadHour(selectedHour);
                setUploadMinute(selectedMinute);
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>رفع تصاريح جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* 24 Hours Horizontal Bar / Directory */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>اختر ساعة الحجز من الـ 24 ساعة:</span>
          </span>
          <span className="text-xs text-emerald-700 font-bold">
            الساعة المختارة: {String(selectedHour).padStart(2, '0')}:00 (بها {getHourStats(selectedHour).available} متاح)
          </span>
        </div>

        {/* Horizontal scrollable hours */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {hours.map(h => {
            const isSelected = selectedHour === h;
            const stats = getHourStats(h);
            const hourLabel = `${String(h).padStart(2, '0')}:00`;

            return (
              <button
                key={h}
                onClick={() => {
                  setSelectedHour(h);
                  setSelectedMinute(0);
                }}
                className={`shrink-0 px-4 py-2.5 rounded-2xl text-center transition-all border ${
                  isSelected
                    ? 'bg-emerald-600 text-white font-black border-emerald-600 shadow-md shadow-emerald-600/25 scale-105'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900'
                }`}
              >
                <div className="font-mono text-xs font-bold">{hourLabel}</div>
                <div className={`text-[10px] mt-0.5 font-semibold ${isSelected ? 'text-emerald-100' : 'text-emerald-700'}`}>
                  {stats.available} متاح
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3 Time Slots Selector (00, 20, 40) */}
      <div className="grid grid-cols-3 gap-3">
        {minutes.map(min => {
          const isSelected = selectedMinute === min;
          const stats = getSlotStats(selectedHour, min);
          const slotLabel = `${String(selectedHour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

          return (
            <button
              key={min}
              onClick={() => setSelectedMinute(min)}
              className={`p-4 rounded-3xl text-right transition-all border ${
                isSelected
                  ? 'bg-emerald-50 border-2 border-emerald-600 shadow-sm text-emerald-950'
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-black text-lg text-emerald-800">{slotLabel}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  stats.available > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                }`}>
                  {stats.available} متاح
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center justify-between mt-2">
                <span>محجوز: {stats.assigned}</span>
                <span>الإجمالي: {stats.total}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Permits Grid */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>تصاريح الفترة {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}</span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-3 py-0.5 rounded-full font-bold">
              {currentSlotPermits.length} تصريح
            </span>
          </h3>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-bold text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>متاح ({currentSlotPermits.filter(p => p.status === 'available').length})</span>
            </span>
            <span className="flex items-center gap-1.5 font-bold text-blue-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>محجوز لعميل ({currentSlotPermits.filter(p => p.status === 'assigned').length})</span>
            </span>
          </div>
        </div>

        {currentSlotPermits.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
            <Folder className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-500">لا توجد تصاريح مرفوعة لهذه الفترة حتى الآن.</p>
            {canUpload && (
              <button
                onClick={() => {
                  setUploadHour(selectedHour);
                  setUploadMinute(selectedMinute);
                  setShowUploadModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
              >
                + ارفع تصاريح لهذه الفترة الآن
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentSlotPermits.map(permit => {
              const isAvailable = permit.status === 'available';

              return (
                <div
                  key={permit.id}
                  className={`rounded-2xl border p-3.5 space-y-3 transition-all ${
                    isAvailable
                      ? 'bg-white border-emerald-300 hover:border-emerald-500 shadow-sm hover:shadow-md'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {/* Image Card */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
                    <img
                      src={permit.imageUrl}
                      alt={permit.permitCode}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-2 justify-between">
                      <button
                        onClick={() => setPreviewPermit(permit)}
                        className="p-1.5 rounded-lg bg-white/90 text-slate-900 text-xs flex items-center gap-1 font-bold shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة</span>
                      </button>
                      
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        isAvailable ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {isAvailable ? 'متاح للسحب' : 'مخصص'}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-800">{permit.permitCode}</span>
                      <span className="text-[11px] text-emerald-700 font-mono font-bold">{permit.slotFormatted}</span>
                    </div>

                    {permit.status === 'assigned' && (
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                        <div className="font-bold text-blue-700 truncate">العميل: {permit.assignedCustomerName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">بواسطة: {permit.assignedByUserName}</div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-1">
                    {isAvailable ? (
                      canClaim ? (
                        <button
                          onClick={() => setClaimingPermit(permit)}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>سحب وتخصيص لعميل</span>
                        </button>
                      ) : (
                        <div className="text-center text-[11px] text-slate-400 py-1 font-medium">متاح لفريق المبيعات</div>
                      )
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => handleContactCustomerWhatsApp(permit)}
                          className="py-2 px-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-all shadow-sm"
                          title="مراسلة العميل عبر الواتساب مع تفاصيل التصريح"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب</span>
                        </button>

                        <button
                          onClick={() => handlePrintPermit(permit)}
                          className="py-2 px-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-all shadow-sm"
                          title="طباعة التصريح مع رمز QR"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة</span>
                        </button>

                        <button
                          onClick={() => setReturningPermit(permit)}
                          className="py-2 px-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-all shadow-sm"
                          title="إرجاع التصريح إلى المخزون"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>إرجاع</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CLAIM PERMIT MODAL */}
      {claimingPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">تخصيص تصريح لعميل</h3>
              </div>
              <button onClick={() => { setClaimingPermit(null); setClaimOrderId(''); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                اختر العميل لتسليم التصريح:
              </label>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم، رقم الواتساب، أو اللقب..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                {filteredCustomers.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => { setSelectedCustomerId(customer.id); setClaimOrderId(''); }}
                    className={`w-full text-right p-3 rounded-xl text-xs flex items-center justify-between transition-all ${
                      selectedCustomerId === customer.id
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{customer.fullName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{customer.whatsappNumber}</div>
                    </div>
                    {customer.nickname && (
                      <span className="text-[10px] px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold">
                        {customer.nickname}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {selectedCustomerId && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    ربط التصريح بطلب العميل (اختياري — الطلب غير المؤكد سيصبح «مؤكد» تلقائياً عند الربط):
                  </label>
                  {customerOpenOrders.length === 0 ? (
                    <p className="text-[11px] text-slate-400 font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      لا توجد طلبات مفتوحة لهذا العميل — يمكنك التخصيص بدون ربط.
                    </p>
                  ) : (
                    <select
                      value={claimOrderId}
                      onChange={(e) => setClaimOrderId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      <option value="">— بدون ربط بطلب —</option>
                      {customerOpenOrders.map(o => (
                        <option key={o.id} value={o.id}>
                          #{o.orderNumber} — {o.permitsCount} تصريح ({o.targetDate} {o.targetTime}) — {o.totalAmount} {currencySymbol(getOrderCurrency(o))}{o.assignedPermitIds?.length ? ` — مرتبط حالياً: ${o.assignedPermitIds.length}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setClaimingPermit(null); setClaimOrderId(''); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!selectedCustomerId}
                onClick={handleClaim}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 shadow-md shadow-emerald-600/20"
              >
                تأكيد التخصيص وسحب التصريح
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN PERMIT MODAL */}
      {returningPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-700">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">إرجاع التصريح للمخزون</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              هل تريد إرجاع التصريح <span className="font-mono font-bold text-amber-700">{returningPermit.permitCode}</span> إلى مجلد الفترة <span className="font-mono text-emerald-700 font-bold">{returningPermit.slotFormatted}</span>؟
              <br />
              سيعود لحالة "متاح" فوراً ليتمكن أي موظف آخر من سحبه.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">سبب الإرجاع:</label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReturningPermit(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={handleReturn}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20"
              >
                تأكيد الإرجاع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleBulkUpload} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <FolderOpen className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">رفع تصاريح جديدة لمجلد الفترة</h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Target Slot */}
            <div className="grid grid-cols-2 gap-3 bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">ساعة الحجز:</label>
                <select
                  value={uploadHour}
                  onChange={(e) => setUploadHour(Number(e.target.value))}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
                >
                  {hours.map(h => (
                    <option key={h} value={h}>الساعة {String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">الفترة (20 دقيقة):</label>
                <select
                  value={uploadMinute}
                  onChange={(e) => setUploadMinute(Number(e.target.value) as 0 | 20 | 40)}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value={0}>:00</option>
                  <option value={20}>:20</option>
                  <option value={40}>:40</option>
                </select>
              </div>
            </div>

            {/* File & Folder Picker / Drag & Drop */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                اختيار صور التصاريح من جهازك أو مجلدك:
              </label>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
                className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  id="permit-file-input"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                  className="sr-only"
                />
                <label
                  htmlFor="permit-file-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {isProcessingFiles
                      ? 'جاري تجهيز الصور وضغطها...'
                      : 'اضغط هنا لفتح واختيار صور التصاريح من جهازك'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    أو اسحب الصور وأفلتها هنا مباشرة (يمكنك اختيار عدة صور معاً — تُضغط الصور تلقائياً قبل الحفظ)
                  </div>
                </label>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>تم اختيار {selectedFiles.length} صورة من جهازك:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-red-500 hover:underline text-[11px]"
                    >
                      مسح الكل
                    </button>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin max-h-24">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group bg-white">
                        <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Alternative URLs */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                أو إدخال روابط صور خارجية (اختياري - رابط لكل سطر):
              </label>
              <textarea
                rows={2}
                placeholder="https://...\nhttps://..."
                value={uploadUrls}
                onChange={(e) => setUploadUrls(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Storage Info Badge */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl text-[11px] text-slate-600">
              <HardDrive className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>مكان الحفظ:</strong> يتم التخزين تلقائياً في قاعدة البيانات السحابية (Supabase) والذاكرة المحلية للمتصفح، وتُضغط صور الجهاز تلقائياً قبل الحفظ.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isProcessingFiles}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>حفظ ورفع للمخزون</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PREVIEW PERMIT MODAL */}
      {previewPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="font-bold text-sm text-slate-900 font-mono">
                {previewPermit.permitCode} - {previewPermit.slotFormatted} ({previewPermit.slotDate})
              </div>
              <button onClick={() => setPreviewPermit(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-[450px] flex items-center justify-center">
              <img src={previewPermit.imageUrl} alt={previewPermit.permitCode} className="w-full h-auto object-contain" />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>الحالة: {previewPermit.status === 'available' ? 'متاح' : `مخصص لـ ${previewPermit.assignedCustomerName}`}</span>
              <a
                href={previewPermit.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 hover:underline flex items-center gap-1 font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                تحميل الصورة
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
