import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  UserCheck, 
  RotateCcw, 
  CreditCard, 
  ShoppingBag, 
  Upload, 
  Clock,
  FileSpreadsheet,
  Trash2,
  ShieldCheck,
  UserCog,
  Power,
  Pencil,
  Archive,
  FileX,
  User
} from 'lucide-react';
import { AuditLog } from '../types';
import { DataService } from '../services/dataService';
import { downloadCsv, formatDateTimeRiyadh, todayRiyadh } from '../utils/csvHelpers';
import { useToast } from './Toast';

const ACTION_LABELS: Record<string, string> = {
  CLAIM_PERMIT: 'سحب وتخصيص تصريح',
  RETURN_PERMIT: 'إرجاع تصريح للمخزون',
  MATCH_SMS: 'مطابقة سداد SMS',
  CREATE_ORDER: 'إنشاء طلب جديد',
  UPDATE_ORDER: 'تحديث بيانات طلب',
  UPLOAD_PERMITS: 'رفع دفعة تصاريح',
  DELETE_PERMIT: 'حذف تصريح',
  DELETE_PROFILE: 'حذف موظف',
  UPDATE_PERMISSIONS: 'تعديل صلاحيات موظف',
  UPDATE_PROFILE: 'تحديث ملف الموظف الشخصي',
  TOGGLE_EMPLOYEE_STATUS: 'إيقاف/تفعيل حساب موظف',
  ARCHIVE_ORDER: 'أرشفة/استرجاع طلب',
  UPDATE_CUSTOMER: 'تحديث بيانات عميل',
};

const formatDetailValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.map(formatDetailValue).join(', ');
    return Object.entries(value as Record<string, unknown>)
      .map(([k, flag]) => `${k}: ${flag === true ? '✓' : flag === false ? '✗' : String(flag)}`)
      .join(' · ');
  }
  return String(value);
};

export const AuditLogViewer: React.FC = () => {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLog[]>(DataService.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const refreshData = () => {
    setLogs(DataService.getAuditLogs());
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = filterAction === 'all' || log.actionType === filterAction;
    return matchesSearch && matchesAction;
  });

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast.warning('لا توجد سجلات مطابقة للتصدير.');
      return;
    }

    downloadCsv(
      `audit-logs-${todayRiyadh()}`,
      ['التاريخ والوقت (Asia/Riyadh)', 'الموظف', 'نوع العملية', 'التفاصيل'],
      filteredLogs.map(log => [
        formatDateTimeRiyadh(log.createdAt),
        log.userName,
        ACTION_LABELS[log.actionType] ?? log.actionType,
        Object.entries(log.details).map(([key, value]) => `${key}: ${formatDetailValue(value)}`).join(' | '),
      ])
    );

    toast.success(`تم تصدير ${filteredLogs.length} سجل إلى ملف CSV.`);
  };

  const getActionBadge = (type: AuditLog['actionType']) => {
    switch (type) {
      case 'CLAIM_PERMIT':
        return (
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <UserCheck className="w-3 h-3 text-emerald-600" />
            <span>سحب وتخصيص تصريح</span>
          </span>
        );
      case 'RETURN_PERMIT':
        return (
          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <RotateCcw className="w-3 h-3 text-amber-600" />
            <span>إرجاع تصريح للمخزون</span>
          </span>
        );
      case 'MATCH_SMS':
        return (
          <span className="bg-purple-50 text-purple-800 border border-purple-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <CreditCard className="w-3 h-3 text-purple-600" />
            <span>مطابقة سداد SMS</span>
          </span>
        );
      case 'CREATE_ORDER':
        return (
          <span className="bg-sky-50 text-sky-800 border border-sky-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <ShoppingBag className="w-3 h-3 text-sky-600" />
            <span>إنشاء طلب جديد</span>
          </span>
        );
      case 'UPLOAD_PERMITS':
        return (
          <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <Upload className="w-3 h-3 text-teal-600" />
            <span>رفع دفعة تصاريح</span>
          </span>
        );
      case 'DELETE_PROFILE':
        return (
          <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <Trash2 className="w-3 h-3 text-rose-600" />
            <span>حذف موظف</span>
          </span>
        );
      case 'UPDATE_PERMISSIONS':
        return (
          <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <ShieldCheck className="w-3 h-3 text-indigo-600" />
            <span>تعديل صلاحيات</span>
          </span>
        );
      case 'UPDATE_PROFILE':
        return (
          <span className="bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <UserCog className="w-3 h-3 text-cyan-600" />
            <span>تحديث ملف شخصي</span>
          </span>
        );
      case 'TOGGLE_EMPLOYEE_STATUS':
        return (
          <span className="bg-orange-50 text-orange-800 border border-orange-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <Power className="w-3 h-3 text-orange-600" />
            <span>إيقاف/تفعيل حساب</span>
          </span>
        );
      case 'UPDATE_ORDER':
        return (
          <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <Pencil className="w-3 h-3 text-blue-600" />
            <span>تحديث بيانات طلب</span>
          </span>
        );
      case 'ARCHIVE_ORDER':
        return (
          <span className="bg-stone-100 text-stone-800 border border-stone-300 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <Archive className="w-3 h-3 text-stone-600" />
            <span>أرشفة/استرجاع طلب</span>
          </span>
        );
      case 'UPDATE_CUSTOMER':
        return (
          <span className="bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <User className="w-3 h-3 text-fuchsia-600" />
            <span>تحديث بيانات عميل</span>
          </span>
        );
      case 'DELETE_PERMIT':
        return (
          <span className="bg-red-50 text-red-800 border border-red-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-xs">
            <FileX className="w-3 h-3 text-red-600" />
            <span>حذف تصريح</span>
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] px-2.5 py-1 rounded-full font-bold">
            تحديث بيانات
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            <span>سجل العمليات والتدقيق الأمني (Audit Logs)</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            تسجيل كامل لكل حركة حجز، سحب تصريح، إرجاع، ومطابقة مالية بالتوقيت الرسمي (Asia/Riyadh).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>التوقيت المسجل: Asia/Riyadh</span>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 px-3.5 py-2 rounded-full shadow-xs transition-all"
            title="تصدير السجلات المفلترة إلى ملف CSV (يفتح في إكسل)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="ابحث باسم الموظف، تفاصيل العملية، أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition-all font-medium"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-emerald-600 transition-all"
        >
          <option value="all">كل أنواع العمليات</option>
          <option value="CLAIM_PERMIT">سحب وتخصيص تصريح</option>
          <option value="RETURN_PERMIT">إرجاع للمخزون</option>
          <option value="MATCH_SMS">مطابقة سداد SMS</option>
          <option value="CREATE_ORDER">إنشاء طلب</option>
          <option value="UPDATE_ORDER">تحديث بيانات طلب</option>
          <option value="ARCHIVE_ORDER">أرشفة/استرجاع طلب</option>
          <option value="UPDATE_CUSTOMER">تحديث بيانات عميل</option>
          <option value="UPLOAD_PERMITS">رفع تصاريح</option>
          <option value="DELETE_PERMIT">حذف تصريح</option>
          <option value="UPDATE_PERMISSIONS">تعديل صلاحيات موظف</option>
          <option value="UPDATE_PROFILE">تحديث ملف شخصي</option>
          <option value="TOGGLE_EMPLOYEE_STATUS">إيقاف/تفعيل حساب موظف</option>
          <option value="DELETE_PROFILE">حذف موظف</option>
        </select>
      </div>

      {/* Logs Timeline List */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-3 shadow-sm">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs font-medium">لا توجد سجلات مطابقة.</div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                {getActionBadge(log.actionType)}

                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">بواسطة الموظف:</span>
                    <span className="text-emerald-700 font-bold">{log.userName}</span>
                  </div>
                  
                  <div className="text-[11px] text-slate-600 mt-1 font-mono flex flex-wrap gap-1.5">
                    {Object.entries(log.details).map(([k, v]) => (
                      <span key={k} className="inline-block bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 shadow-2xs">
                        {k}: <strong className="text-slate-900">{formatDetailValue(v)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="font-mono text-[11px] text-slate-500 font-bold shrink-0 text-left bg-slate-100/70 px-2.5 py-1 rounded-lg">
                {new Date(log.createdAt).toLocaleString('ar-SA', {
                  timeZone: 'Asia/Riyadh',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
