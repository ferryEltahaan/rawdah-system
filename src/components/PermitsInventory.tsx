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
  Printer,
  Share2,
  ArrowRightLeft,
  CloudUpload
} from 'lucide-react';
import { Permit, PermitStatus, Customer, UserProfile, SalesOrder } from '../types';
import { DataService } from '../services/dataService';
import { currencySymbol, getOrderCurrency } from '../utils/currency';
import { useToast } from './Toast';
import { printPermit } from '../utils/printHelpers';
import { compressImageFile, validateImageFile } from '../utils/imageHelpers';
import { useImageActions } from '../hooks/useImageActions';
import confetti from 'canvas-confetti';

interface PermitsInventoryProps {
  currentUser: UserProfile;
  onOrderCreated?: () => void;
}

const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  available: 'متاح للسحب',
  assigned: 'مخصص',
  locked: 'مقفل مؤقتاً',
  returned: 'مُرجع للمخزون',
  cancelled: 'ملغي',
};

const PERMIT_STATUS_BADGES: Record<PermitStatus, string> = {
  available: 'bg-emerald-500 text-white',
  assigned: 'bg-blue-600 text-white',
  locked: 'bg-amber-500 text-white',
  returned: 'bg-slate-500 text-white',
  cancelled: 'bg-red-600 text-white',
};

// كل الحالات الخمس تُعد صراحةً حتى تكون الأجزاء المعروضة مساوية لإجمالي التصاريح
const countPermitStatuses = (list: Permit[]) => ({
  available: list.filter(p => p.status === 'available').length,
  assigned: list.filter(p => p.status === 'assigned').length,
  locked: list.filter(p => p.status === 'locked').length,
  returned: list.filter(p => p.status === 'returned').length,
  cancelled: list.filter(p => p.status === 'cancelled').length,
});

export const PermitsInventory: React.FC<PermitsInventoryProps> = ({ currentUser }) => {
  const toast = useToast();
  // تحميل/مشاركة صور التصاريح بشكل يعمل على الجوال (data URL → Blob)
  const imageActions = useImageActions();
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

  // Move / Rebalance Modal
  const [movePermitIds, setMovePermitIds] = useState<string[]>([]);
  const [moveQuantity, setMoveQuantity] = useState<number>(1);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveDestDate, setMoveDestDate] = useState<string>(today);
  const [moveDestHour, setMoveDestHour] = useState<number>(0);
  const [moveDestMinute, setMoveDestMinute] = useState<0 | 20 | 40>(0);
  const [isMoving, setIsMoving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const base64Count = permits.filter(p => p.imageUrl && p.imageUrl.startsWith('data:')).length;

  const refreshData = () => {
    setPermits(DataService.getPermits());
    setCustomers(DataService.getCustomers());
    setOrders(DataService.getOrders());
  };

  const handleMigrateToCloud = async () => {
    if (isMigrating) return;
    setIsMigrating(true);
    toast.info('جاري رفع صور التصاريح إلى Supabase Storage...');
    try {
      const res = await DataService.migratePermitImagesToStorage();
      if (res.migrated > 0) {
        toast.success(`✅ تم رفع ${res.migrated} صورة تصريح إلى Supabase Storage بنجاح!`);
        refreshData();
      } else if (res.failed > 0) {
        toast.error('تعذر رفع بعض الصور للسحابة، تأكد من الاتصال بـ Supabase');
      } else {
        toast.info('جميع صور التصاريح مرفوعة مسبقاً على السحابة');
      }
    } catch {
      toast.error('حدث خطأ أثناء نقل الصور للسحابة');
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);

    // رفع تلقائي لأي تصاريح قديمة غير مرفوعة للسحابة عند فتح الشاشة
    DataService.migratePermitImagesToStorage().then(res => {
      if (res.migrated > 0) {
        toast.success(`☁️ تم رفع ${res.migrated} صورة تصريح إلى التخزين السحابي تلقائياً!`);
        refreshData();
      }
    });

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
        const url = await compressImageFile(file, 800);
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
    return { total: slotPermits.length, ...countPermitStatuses(slotPermits) };
  };

  const getHourStats = (hour: number) => {
    const hourPermits = permits.filter(
      p => p.slotDate === selectedDate && p.slotHour === hour
    );
    return { total: hourPermits.length, ...countPermitStatuses(hourPermits) };
  };

  const currentSlotPermits = permits.filter(
    p => p.slotDate === selectedDate && p.slotHour === selectedHour && p.slotMinute === selectedMinute
  );
  const currentSlotStatuses = countPermitStatuses(currentSlotPermits);

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

  const openMoveModal = (ids: string[]) => {
    setMovePermitIds(ids);
    setMoveQuantity(ids.length > 0 ? ids.length : 1);
    setMoveDestDate(selectedDate);
    setMoveDestHour(selectedHour === 23 ? 0 : selectedHour + 1);
    setMoveDestMinute(0);
    setShowMoveModal(true);
  };

  const handleMove = async () => {
    if (movePermitIds.length === 0) return;
    const actualIdsToMove = movePermitIds.slice(0, Math.min(moveQuantity, movePermitIds.length));
    if (actualIdsToMove.length === 0) return;

    setIsMoving(true);
    const result = await DataService.movePermits(
      actualIdsToMove,
      moveDestDate,
      moveDestHour,
      moveDestMinute,
      currentUser
    );
    setIsMoving(false);
    if (result.success) {
      toast.success(result.message);
      refreshData();
      setShowMoveModal(false);
      setMovePermitIds([]);
    } else {
      toast.error(result.message);
    }
  };

  const handleDeletePermit = async (permit: Permit) => {
    const ok = await toast.confirm(
      `هل أنت متأكد من حذف التصريح (${permit.permitCode}) نهائياً من المخزون؟\nسيتم حذف الصورة وتفريغ مساحة التخزين فوراً.`,
      { title: 'حذف تصريح نهائياً', confirmLabel: 'نعم، احذف التصريح', danger: true }
    );
    if (!ok) return;

    const result = await DataService.deletePermit(permit.id, currentUser);
    if (result.success) {
      toast.success(result.message);
      refreshData();
      if (previewPermit?.id === permit.id) setPreviewPermit(null);
    } else {
      toast.error(result.message);
    }
  };

  const handleCleanupStorage = async () => {
    const res = await DataService.cleanupAndFreeStorage();
    refreshData();
    toast.success(`تم تفريغ مساحة التخزين بنجاح (تم توفير ${res.freedKb} كيلوبايت) وتحديث الذاكرة.`);
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
    let message = `السلام عليكم ورحمة الله وبركاته يا ${customer.fullName}،
تم تجهيز تصريح زيارة الروضة الشريفة لكم بنجاح 🕌✨

• رقم التصريح: ${permit.permitCode}
• تاريخ الزيارة: ${permit.slotDate}
• الفترة: ${permit.slotFormatted}`;

    if (permit.imageUrl && permit.imageUrl.startsWith('http')) {
      message += `\n• رابط تحميل صورة التصريح: ${permit.imageUrl}`;
    }

    message += `\n\nتقبل الله زيارتكم وطاعتكم.\n${companyName}`;

    // نسخ صورة التصريح تلقائياً للحافظة لمستخدمي الكمبيوتر ليتم لصقها بـ Ctrl + V
    if (permit.imageUrl) {
      imageActions.copyOrDownload(permit.imageUrl, `تصريح_${permit.permitCode}.png`);
    }

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
    
    const rawUrls = [...urlsFromFiles, ...urlsFromText];
    if (rawUrls.length === 0) {
      toast.error('أضف صورة واحدة على الأقل من جهازك أو رابط صورة خارجي قبل الحفظ — لا يمكن رفع تصاريح فارغة إلى المخزون.');
      return;
    }

    // رفع صور الأجهزة (Base64) إلى Supabase Storage إن كان مُعدّاً
    // الروابط الخارجية (https) تُمرَّر مباشرةً دون إعادة رفع
    const hasLocalImages = rawUrls.some(u => u.startsWith('data:'));
    if (hasLocalImages) {
      toast.info('جاري رفع الصور إلى التخزين السحابي...');
    }

    const finalUrls: string[] = await Promise.all(
      rawUrls.map(url => DataService.uploadPermitImage(url))
    );

    // إشعار المستخدم بنتيجة الرفع
    if (hasLocalImages) {
      const cloudCount = finalUrls.filter(u => u.startsWith('https')).length;
      const localCount = finalUrls.length - cloudCount;
      if (cloudCount > 0 && localCount === 0) {
        toast.success(`✅ تم رفع ${cloudCount} صورة إلى التخزين السحابي بنجاح`);
      } else if (cloudCount > 0 && localCount > 0) {
        toast.warning(`⚠️ تم رفع ${cloudCount} سحابياً، ${localCount} محفوظة محلياً (تحقق من إعداد Bucket)`);
      } else {
        toast.info('تم الحفظ محلياً — لم يتم الرفع السحابي (Bucket غير مُعدّ)');
      }
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

  // Can upload permits (Admin & Inventory with create permission)
  const canUpload = ['super_admin', 'inventory'].includes(currentUser.role) && (currentUser.role === 'super_admin' || Boolean(currentUser.customPermissions?.create));
  // Can claim permits (Admin & Sales with edit permission)
  const canClaim = ['super_admin', 'sales'].includes(currentUser.role) && (currentUser.role === 'super_admin' || Boolean(currentUser.customPermissions?.edit));
  // Can move / reallocate permits (Super Admin, Inventory, Sales - all roles with inventory access)
  const canMove = true;
  // Can delete permits (Admin, staff, or mistaken entries to free device storage)
  const canDelete = currentUser.role === 'super_admin' || Boolean(currentUser.customPermissions?.delete) || ['inventory', 'sales'].includes(currentUser.role);

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

          {/* Cleanup Storage Button */}
          <button
            onClick={handleCleanupStorage}
            className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold px-3.5 py-2.5 rounded-2xl text-xs transition-all shadow-sm"
            title="تفريغ سجلات الفحص والبيانات المؤقتة القديمة لتحرير مساحة الهاتف فوراً"
          >
            <HardDrive className="w-4 h-4 text-amber-600" />
            <span>تفريغ وضغط الذاكرة</span>
          </button>

          {/* Cloud Migrate Button */}
          {base64Count > 0 && (
            <button
              onClick={handleMigrateToCloud}
              disabled={isMigrating}
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 font-bold px-3.5 py-2.5 rounded-2xl text-xs transition-all shadow-sm"
              title="رفع صور التصاريح المحفوظة محلياً إلى Supabase Storage"
            >
              <CloudUpload className={`w-4 h-4 text-blue-600 ${isMigrating ? 'animate-bounce' : ''}`} />
              <span>{isMigrating ? 'جاري الرفع للسحابة...' : `رفع الصور للسحابة (${base64Count})`}</span>
            </button>
          )}

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
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-700 font-bold">
              الساعة المختارة: {String(selectedHour).padStart(2, '0')}:00 (بها {getHourStats(selectedHour).available} متاح)
            </span>
            {/* زر إعادة التوزيع على مستوى الساعة */}
            {canMove && getHourStats(selectedHour).available > 0 && (
              <button
                id="rebalance-hour-btn"
                onClick={() => {
                  const ids = permits
                    .filter(p => p.slotDate === selectedDate && p.slotHour === selectedHour && p.status !== 'assigned')
                    .map(p => p.id);
                  openMoveModal(ids);
                }}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all"
                title="نقل / إعادة توزيع كل تصاريح هذه الساعة إلى فترة أخرى"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>إعادة توزيع</span>
              </button>
            )}
          </div>
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
              {(stats.locked > 0 || stats.returned > 0 || stats.cancelled > 0) && (
                <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-2 mt-1.5">
                  {stats.locked > 0 && <span>مقفل: {stats.locked}</span>}
                  {stats.returned > 0 && <span>مُرجع: {stats.returned}</span>}
                  {stats.cancelled > 0 && <span>ملغي: {stats.cancelled}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Permits Grid */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>تصاريح الفترة {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}</span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-3 py-0.5 rounded-full font-bold">
                {currentSlotPermits.length} تصريح
              </span>
            </h3>

            {canMove && currentSlotPermits.filter(p => p.status === 'available').length > 0 && (
              <button
                id="rebalance-slot-btn"
                onClick={() => {
                  const ids = currentSlotPermits.filter(p => p.status === 'available').map(p => p.id);
                  openMoveModal(ids);
                }}
                className="flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 font-bold px-3 py-1 rounded-xl text-xs shadow-sm transition-all"
                title="نقل وإعادة توزيع تصاريح هذه الفترة"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>إعادة توزيع الفترة</span>
              </button>
            )}

            {canDelete && currentSlotPermits.filter(p => p.status === 'available').length > 0 && (
              <button
                id="bulk-delete-slot-btn"
                onClick={async () => {
                  const available = currentSlotPermits.filter(p => p.status === 'available');
                  const ok = await toast.confirm(
                    `هل تريد حذف جميع التصاريح المتاحة في هذه الفترة (${available.length} تصريح) نهائياً لتفريغ مساحة التخزين؟`,
                    { title: 'حذف تصاريح الفترة المتاحة', confirmLabel: 'نعم، احذف المتاح', danger: true }
                  );
                  if (!ok) return;
                  const res = await DataService.deletePermitsBulk(available.map(p => p.id), currentUser);
                  if (res.success) {
                    toast.success(res.message);
                    refreshData();
                  } else {
                    toast.error(res.message);
                  }
                }}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3 py-1 rounded-xl text-xs shadow-sm transition-all"
                title="حذف جميع التصاريح المتاحة في هذه الفترة في حالة الخطأ لتفريغ المساحة فوراً"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف المتاح ({currentSlotPermits.filter(p => p.status === 'available').length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-bold text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>متاح ({currentSlotPermits.filter(p => p.status === 'available').length})</span>
            </span>
            <span className="flex items-center gap-1.5 font-bold text-blue-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>محجوز لعميل ({currentSlotPermits.filter(p => p.status === 'assigned').length})</span>
            </span>
            {currentSlotStatuses.locked > 0 && (
              <span className="flex items-center gap-1.5 font-bold text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>مقفل ({currentSlotStatuses.locked})</span>
              </span>
            )}
            {currentSlotStatuses.returned > 0 && (
              <span className="flex items-center gap-1.5 font-bold text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                <span>مُرجع ({currentSlotStatuses.returned})</span>
              </span>
            )}
            {currentSlotStatuses.cancelled > 0 && (
              <span className="flex items-center gap-1.5 font-bold text-red-700">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                <span>ملغي ({currentSlotStatuses.cancelled})</span>
              </span>
            )}
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
                      
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${PERMIT_STATUS_BADGES[permit.status]}`}>
                        {PERMIT_STATUS_LABELS[permit.status]}
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
                      <div className="space-y-1.5">
                        {canClaim ? (
                          <button
                            onClick={() => setClaimingPermit(permit)}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
                          >
                            <UserCheck className="w-4 h-4" />
                            <span>سحب وتخصيص لعميل</span>
                          </button>
                        ) : (
                          <div className="text-center text-[11px] text-slate-400 py-1 font-medium">متاح لفريق المبيعات</div>
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                          {canMove && (
                            <button
                              id={`move-permit-btn-${permit.id}`}
                              onClick={() => openMoveModal([permit.id])}
                              className="py-2 px-2 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-all shadow-sm"
                              title="نقل هذا التصريح إلى فترة زمنية مختلفة"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>نقل</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              id={`delete-permit-btn-${permit.id}`}
                              onClick={() => handleDeletePermit(permit)}
                              className="py-2 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-all shadow-sm"
                              title="حذف هذا التصريح نهائياً لتفريغ المساحة في حالة الدخول الخاطئ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      </div>
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerSearchQuery(val);
                    const directMatch = customers.find(c => 
                      c.fullName.toLowerCase() === val.trim().toLowerCase() ||
                      (c.nickname && c.nickname.toLowerCase() === val.trim().toLowerCase())
                    );
                    if (directMatch) {
                      setSelectedCustomerId(directMatch.id);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              {/* Selected Customer Card if chosen */}
              {(() => {
                const activeCust = customers.find(c => c.id === selectedCustomerId) ||
                  customers.find(c => c.fullName.toLowerCase() === customerSearchQuery.trim().toLowerCase());
                if (!activeCust) return null;
                return (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-xs shadow-sm">
                        ✓
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-950">{activeCust.fullName}</div>
                        <div className="text-[10px] text-emerald-700 font-mono">{activeCust.whatsappNumber}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      تم اختيار العميل
                    </span>
                  </div>
                );
              })()}

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                {filteredCustomers.length === 0 && customerSearchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const created = await DataService.saveCustomer({
                        fullName: customerSearchQuery.trim(),
                        whatsappNumber: '+966501234567',
                        notes: 'تم إنشاؤه أثناء تخصيص التصريح',
                      });
                      refreshData();
                      setSelectedCustomerId(created.id);
                      setCustomerSearchQuery(created.fullName);
                      toast.success(`تم إنشاء العميل «${created.fullName}» واختياره للتخصيص.`);
                    }}
                    className="w-full text-right p-3 rounded-xl text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold flex items-center justify-between transition-colors shadow-sm"
                  >
                    <span>➕ إنشاء واختيار «{customerSearchQuery}» كعميل للتخصيص</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-200/60 px-2 py-0.5 rounded font-bold">اختيار فوري</span>
                  </button>
                )}

                {filteredCustomers.map(customer => (
                  <button
                    type="button"
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomerSearchQuery(customer.fullName);
                      const custOrders = orders.filter(o => 
                        o.customerId === customer.id && 
                        o.orderStatus !== 'cancelled' && 
                        !o.isArchived && 
                        ((o.assignedPermitIds?.length || 0) < o.permitsCount)
                      );
                      setClaimOrderId(custOrders.length > 0 ? custOrders[0].id : '');
                    }}
                    className={`w-full text-right p-3 rounded-xl text-xs flex items-center justify-between transition-all ${
                      selectedCustomerId === customer.id
                        ? 'bg-emerald-600 text-white font-bold shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200/60'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{customer.fullName}</div>
                      <div className={`text-[10px] font-mono ${selectedCustomerId === customer.id ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {customer.whatsappNumber}
                      </div>
                    </div>
                    {customer.nickname && (
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold border ${
                        selectedCustomerId === customer.id
                          ? 'bg-emerald-700 text-white border-emerald-500'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {customer.nickname}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Order Linking */}
              {(() => {
                const effectiveId = selectedCustomerId || (customers.find(c => c.fullName.toLowerCase() === customerSearchQuery.trim().toLowerCase())?.id);
                if (!effectiveId) return null;
                return (
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
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setClaimingPermit(null); setClaimOrderId(''); setSelectedCustomerId(''); setCustomerSearchQuery(''); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              {(() => {
                const effectiveId = selectedCustomerId || (customers.find(c => c.fullName.toLowerCase() === customerSearchQuery.trim().toLowerCase())?.id);
                return (
                  <button
                    type="button"
                    disabled={!effectiveId}
                    onClick={() => {
                      if (effectiveId && !selectedCustomerId) setSelectedCustomerId(effectiveId);
                      handleClaim();
                    }}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    id="confirm-claim-permit-btn"
                  >
                    تأكيد التخصيص وسحب التصريح
                  </button>
                );
              })()}
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

            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 flex-wrap">
              <span>
                الحالة: {previewPermit.status === 'assigned' && previewPermit.assignedCustomerName
                  ? `مخصص لـ ${previewPermit.assignedCustomerName}`
                  : PERMIT_STATUS_LABELS[previewPermit.status]}
              </span>
              <div className="flex items-center gap-2">
                {previewPermit.status === 'available' && canMove && (
                  <button
                    type="button"
                    id="modal-move-permit-btn"
                    onClick={() => {
                      const id = previewPermit.id;
                      setPreviewPermit(null);
                      openMoveModal([id]);
                    }}
                    className="px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 hover:bg-violet-100 font-bold flex items-center gap-1 shadow-sm"
                    title="نقل هذا التصريح إلى فترة زمنية مختلفة"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>نقل / إعادة توزيع</span>
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    id="modal-delete-permit-btn"
                    onClick={() => handleDeletePermit(previewPermit)}
                    className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold flex items-center gap-1 shadow-sm"
                    title="حذف هذا التصريح نهائياً من المخزون وتفريغ مساحته فوراً"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف التصريح</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    imageActions.shareOrDownload(previewPermit.imageUrl, `تصريح_${previewPermit.permitCode}.png`, {
                      title: `تصريح ${previewPermit.permitCode}`,
                      text: `صورة تصريح رقم ${previewPermit.permitCode}`,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shadow-sm"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  مشاركة / إرسال
                </button>
                <button
                  type="button"
                  onClick={() => imageActions.download(previewPermit.imageUrl, `${previewPermit.permitCode}.png`)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  تحميل الصورة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MOVE / REBALANCE PERMIT MODAL ═══════ */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-violet-700">
                <ArrowRightLeft className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">
                  {movePermitIds.length === 1 ? 'نقل تصريح' : `نقل وإعادة توزيع (${Math.min(moveQuantity, movePermitIds.length)} تصريح)`} إلى فترة أخرى
                </h3>
              </div>
              <button
                onClick={() => { setShowMoveModal(false); setMovePermitIds([]); }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >✕</button>
            </div>

            {/* Source info */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-600">
              <div className="font-bold text-slate-800 mb-1">المصدر الحالي:</div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-700">{selectedDate}</span>
                <span className="text-slate-400">•</span>
                <span className="font-mono font-bold text-emerald-700">
                  {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-700">{Math.min(moveQuantity, movePermitIds.length)} تصريح سيُنقل</span>
              </div>
            </div>

            {/* Quantity Slider if > 1 */}
            {movePermitIds.length > 1 && (
              <div className="bg-violet-50/60 border border-violet-200 rounded-2xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">حدد كمية التصاريح المراد نقلها:</span>
                  <span className="font-mono font-black text-violet-800 text-sm">{moveQuantity} من {movePermitIds.length}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={movePermitIds.length}
                  value={moveQuantity}
                  onChange={e => setMoveQuantity(Number(e.target.value))}
                  className="w-full accent-violet-600 cursor-pointer"
                  id="move-quantity-slider"
                />
                <div className="flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMoveQuantity(1)}
                    className="text-violet-700 hover:underline font-bold"
                  >
                    تصريح واحد فقط
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveQuantity(movePermitIds.length)}
                    className="text-violet-700 hover:underline font-bold"
                  >
                    كل التصاريح ({movePermitIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* Destination controls */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">اختر الفترة الزمنية الوجهة:</label>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">التاريخ المستهدف:</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
                  <Calendar className="w-4 h-4 text-violet-600 shrink-0" />
                  <input
                    type="date"
                    value={moveDestDate}
                    onChange={e => setMoveDestDate(e.target.value)}
                    className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer w-full"
                    id="move-dest-date"
                  />
                </div>
              </div>

              {/* Hour + Minute */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">الساعة الوجهة:</label>
                  <select
                    value={moveDestHour}
                    onChange={e => setMoveDestHour(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-violet-500"
                    id="move-dest-hour"
                  >
                    {hours.map(h => (
                      <option key={h} value={h}>
                        الساعة {String(h).padStart(2, '0')}:00
                        {' '}({getHourStats(h).available} متاح)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">الفترة:</label>
                  <select
                    value={moveDestMinute}
                    onChange={e => setMoveDestMinute(Number(e.target.value) as 0 | 20 | 40)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-violet-500"
                    id="move-dest-minute"
                  >
                    <option value={0}>:00 (أولى)</option>
                    <option value={20}>:20 (ثانية)</option>
                    <option value={40}>:40 (ثالثة)</option>
                  </select>
                </div>
              </div>

              {/* Destination slot count preview */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-xs flex items-center justify-between">
                <span className="text-violet-800 font-bold">الفترة الوجهة الحالية:</span>
                <span className="font-mono font-black text-violet-700">
                  {String(moveDestHour).padStart(2, '0')}:{String(moveDestMinute).padStart(2, '0')}
                  {' '}<span className="text-violet-500 font-semibold">({getSlotStats(moveDestHour, moveDestMinute).total} تصريح حالياً)</span>
                </span>
              </div>

              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
                ⚠️ التصاريح المخصصة لعملاء لن تُنقل — أرجعها أولاً ثم انقلها.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setShowMoveModal(false); setMovePermitIds([]); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                إلغاء
              </button>
              <button
                id="confirm-move-permits-btn"
                type="button"
                disabled={isMoving || movePermitIds.length === 0}
                onClick={handleMove}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white shadow-md shadow-violet-600/20 transition-all flex items-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {isMoving ? 'جاري النقل...' : `تأكيد النقل (${Math.min(moveQuantity, movePermitIds.length)} تصريح)`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
