import React, { useState, useEffect } from 'react';
import { 
  UserCog, 
  ShieldCheck, 
  Check, 
  Lock,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  RotateCcw,
  Minus,
  Loader2
} from 'lucide-react';
import { UserProfile, UserRole, CustomPermissions } from '../types';
import { DataService } from '../services/dataService';
import { useToast } from './Toast';
import { ImageUploadField } from './ImageUploadField';
import confetti from 'canvas-confetti';

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, CustomPermissions> = {
  super_admin: { view: true, create: true, edit: true, delete: true, reports: true },
  sales: { view: true, create: true, edit: true, delete: false, reports: false },
  inventory: { view: true, create: true, edit: true, delete: false, reports: false },
  accountant: { view: true, create: true, edit: true, delete: false, reports: true },
};

const PERMISSION_LABELS: { key: keyof CustomPermissions; label: string }[] = [
  { key: 'view', label: 'عرض (View)' },
  { key: 'create', label: 'إضافة (Create)' },
  { key: 'edit', label: 'تعديل (Edit)' },
  { key: 'delete', label: 'حذف (Delete)' },
  { key: 'reports', label: 'التقارير (Reports)' },
];

const PERMISSION_DESCRIPTIONS: Record<keyof CustomPermissions, string> = {
  view: 'الاطلاع على البيانات والشاشات المتاحة للدور الوظيفي.',
  create: 'إضافة سجلات جديدة (طلبات، عملاء، تصاريح، رسائل...).',
  edit: 'تعديل السجلات والبيانات القائمة.',
  delete: 'حذف السجلات نهائياً من النظام.',
  reports: 'الاطلاع على التقارير ولوحة المؤشرات ونتائج الأداء.',
};

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  super_admin: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  sales: 'bg-sky-50 text-sky-800 border-sky-200',
  inventory: 'bg-teal-50 text-teal-800 border-teal-200',
  accountant: 'bg-amber-50 text-amber-800 border-amber-200',
};

const ROLE_REFERENCE_ROWS: { role: UserRole; label: string; labelClass: string; rowClass?: string }[] = [
  { role: 'sales', label: 'فريق المبيعات (Sales)', labelClass: 'text-sky-700' },
  { role: 'inventory', label: 'إدارة المخزون والتصاريح (Inventory)', labelClass: 'text-emerald-700' },
  { role: 'accountant', label: 'قسم الحسابات والمالية (Accounting)', labelClass: 'text-amber-700' },
  { role: 'super_admin', label: 'المدير العام (Super Admin)', labelClass: 'text-emerald-900', rowClass: 'bg-emerald-50/50' },
];

export const EmployeesAndRolesView: React.FC = () => {
  const toast = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>(DataService.getProfiles());
  const currentUserId = DataService.getCurrentUser().id;

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [role, setRole] = useState<UserRole>('sales');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [permissions, setPermissions] = useState<CustomPermissions>(ROLE_DEFAULT_PERMISSIONS.sales);
  const [isSaving, setIsSaving] = useState(false);

  // Permissions Editor Modal
  const [permissionsProfileId, setPermissionsProfileId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<CustomPermissions | null>(null);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Matrix inline editing
  const [savingPermissionKey, setSavingPermissionKey] = useState<string | null>(null);

  const refreshData = () => {
    setProfiles(DataService.getProfiles());
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

  const handleToggleActive = async (profile: UserProfile) => {
    if (profile.id === currentUserId) {
      toast.error('لا يمكنك إيقاف الحساب الذي تسجّل الدخول به حالياً — ستفقد الوصول للنظام فوراً. أوقفه من حساب مدير آخر.');
      return;
    }

    const { localSaved } = await DataService.saveProfile({ ...profile, isActive: !profile.isActive });
    refreshData();
    if (!localSaved) return;

    const admin = DataService.getCurrentUser();
    DataService.addAuditLog(admin.id, admin.fullName, 'TOGGLE_EMPLOYEE_STATUS', 'profiles', profile.id, {
      employeeName: profile.fullName,
      username: profile.username,
      before: profile.isActive ? 'نشط' : 'موقوف',
      after: profile.isActive ? 'موقوف' : 'نشط',
    });
    toast.success(profile.isActive ? `تم إيقاف حساب ${profile.fullName} مؤقتاً — لن يستطيع الدخول، وستُنهى جلسته الحالية عند أول مزامنة.` : `تم تفعيل حساب ${profile.fullName} — يستطيع الدخول الآن.`);
  };

  const handleDelete = async (profile: UserProfile) => {
    if (profile.id === currentUserId) {
      toast.error('لا يمكنك حذف الحساب الذي تسجّل الدخول به حالياً — يمكنك «إيقافه مؤقتاً» أو الحذف من حساب مدير آخر.');
      return;
    }

    const approved = await toast.confirm(
      `سيتم حذف حساب «${profile.fullName}» (${getRoleTitle(profile.role)}) نهائياً، ولن يستطيع الدخول للنظام بعد ذلك.\nسجل عملياته السابقة يبقى محفوظاً في سجل التدقيق.\n\nهل أنت متأكد من الحذف النهائي؟`,
      { title: 'حذف موظف نهائياً', confirmLabel: 'نعم، احذفه نهائياً', danger: true }
    );
    if (!approved) return;

    const { localSaved, notFound, cloudFailed } = await DataService.deleteProfile(profile.id);
    refreshData();

    if (notFound) {
      toast.info(`${profile.fullName} غير موجود بالفعل — قد يكون حُذف من جهاز آخر.`);
      return;
    }
    // عند فشل الحفظ المحلي (امتلاء المساحة) يظهر تنبيه الخطأ تلقائياً من نظام الإشعارات
    if (!localSaved) return;

    if (cloudFailed) {
      toast.warning(`تم حذف ${profile.fullName} من هذا الجهاز، لكن تعذّر الحذف من قاعدة البيانات السحابية — إن عاد للظهور بعد مزامنة قادمة فأعد الحذف.`);
      return;
    }

    toast.success(`تم حذف حساب ${profile.fullName} نهائياً.`);
  };

  const handleOpenCreate = () => {
    setEditingProfileId(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setPhoneNumber('');
    setWhatsappNumber('');
    setRole('sales');
    setAvatarUrl('');
    setPermissions(ROLE_DEFAULT_PERMISSIONS.sales);
    setShowModal(true);
  };

  const handleOpenEdit = (profile: UserProfile) => {
    setEditingProfileId(profile.id);
    setFullName(profile.fullName);
    setUsername(profile.username);
    setPassword('');
    setPhoneNumber(profile.phoneNumber);
    setWhatsappNumber(profile.whatsappNumber);
    setRole(profile.role);
    setAvatarUrl(profile.avatarUrl || '');
    setPermissions(profile.customPermissions);
    setShowModal(true);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(ROLE_DEFAULT_PERMISSIONS[newRole]);
  };

  const handleTogglePermission = (key: keyof CustomPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getProfileById = (id: string | null) => profiles.find(p => p.id === id);

  const isPermissionsCustomized = (profile: UserProfile) =>
    profile.role !== 'super_admin' &&
    PERMISSION_LABELS.some(({ key }) => profile.customPermissions[key] !== ROLE_DEFAULT_PERMISSIONS[profile.role][key]);

  const logPermissionChange = (profile: UserProfile, newPermissions: CustomPermissions, source: string) => {
    const actor = DataService.getCurrentUser();
    DataService.addAuditLog(actor.id, actor.fullName, 'UPDATE_PERMISSIONS', 'profiles', profile.id, {
      employeeName: profile.fullName,
      username: profile.username,
      role: profile.role,
      before: profile.customPermissions,
      after: newPermissions,
      source,
    });
  };

  const persistPermissions = async (
    profile: UserProfile,
    newPermissions: CustomPermissions,
    successMessage: string,
    source: string
  ): Promise<boolean> => {
    const { localSaved } = await DataService.saveProfile({ ...profile, customPermissions: newPermissions });
    refreshData();
    // عند فشل الحفظ المحلي (امتلاء المساحة) يظهر تنبيه الخطأ تلقائياً من نظام الإشعارات
    if (!localSaved) return false;
    logPermissionChange(profile, newPermissions, source);
    toast.success(successMessage);
    return true;
  };

  const handleToggleMatrixPermission = async (profile: UserProfile, key: keyof CustomPermissions) => {
    if (profile.role === 'super_admin') {
      toast.info('المدير العام يملك كل الصلاحيات دائماً — لا يمكن تقييدها.');
      return;
    }
    const enabled = !profile.customPermissions[key];
    const label = PERMISSION_LABELS.find(l => l.key === key)?.label || key;
    setSavingPermissionKey(`${profile.id}:${key}`);
    try {
      await persistPermissions(
        profile,
        { ...profile.customPermissions, [key]: enabled },
        `تم ${enabled ? 'منح' : 'سحب'} صلاحية «${label}» ${enabled ? 'لـ' : 'من'} ${profile.fullName}.`,
        'المصفوفة التفاعلية'
      );
    } finally {
      setSavingPermissionKey(null);
    }
  };

  const handleResetMatrixPermissions = async (profile: UserProfile) => {
    await persistPermissions(
      profile,
      ROLE_DEFAULT_PERMISSIONS[profile.role],
      `تمت استعادة الصلاحيات الافتراضية لدور ${getRoleTitle(profile.role)} لحساب ${profile.fullName}.`,
      'استعادة الافتراضي من المصفوفة'
    );
  };

  const handleOpenPermissionsModal = (profile: UserProfile) => {
    setPermissionsProfileId(profile.id);
    setDraftPermissions({ ...profile.customPermissions });
  };

  const handleClosePermissionsModal = () => {
    setPermissionsProfileId(null);
    setDraftPermissions(null);
  };

  const handleToggleDraftPermission = (key: keyof CustomPermissions) => {
    setDraftPermissions(prev => (prev ? { ...prev, [key]: !prev[key] } : prev));
  };

  const handleResetDraftToRoleDefaults = () => {
    const profile = getProfileById(permissionsProfileId);
    if (!profile) return;
    setDraftPermissions({ ...ROLE_DEFAULT_PERMISSIONS[profile.role] });
  };

  const handleSavePermissionsModal = async () => {
    const profile = getProfileById(permissionsProfileId);
    if (!profile || !draftPermissions || profile.role === 'super_admin') return;
    const hasChanges = PERMISSION_LABELS.some(({ key }) => draftPermissions[key] !== profile.customPermissions[key]);
    if (!hasChanges) {
      handleClosePermissionsModal();
      return;
    }
    setIsSavingPermissions(true);
    try {
      const saved = await persistPermissions(profile, draftPermissions, `تم حفظ صلاحيات ${profile.fullName}.`, 'نافذة تعديل الصلاحيات');
      if (saved) handleClosePermissionsModal();
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (DataService.isUsernameTaken(username, editingProfileId || undefined)) {
      toast.error(`اسم المستخدم «${username}» مستخدم بالفعل — اختر اسماً آخر.`);
      return;
    }

    const existing = editingProfileId ? profiles.find(p => p.id === editingProfileId) : undefined;
    if (!existing && password.length < 4) {
      toast.warning('كلمة المرور يجب أن تكون 4 أحرف على الأقل.');
      return;
    }

    const finalPermissions = role === 'super_admin' ? ROLE_DEFAULT_PERMISSIONS.super_admin : permissions;

    setIsSaving(true);
    try {
      const { localSaved } = await DataService.saveProfile({
        id: editingProfileId || undefined,
        fullName: fullName.trim(),
        username: username.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        whatsappNumber: whatsappNumber.trim(),
        role,
        isActive: existing?.isActive ?? true,
        avatarUrl: avatarUrl.trim() || undefined,
        customPermissions: finalPermissions,
      });

      // عند فشل الحفظ المحلي (امتلاء المساحة) نُبقي النموذج مفتوحاً لتعديل الصورة أو البيانات
      if (!localSaved) return;

      if (existing && PERMISSION_LABELS.some(({ key }) => existing.customPermissions[key] !== finalPermissions[key])) {
        logPermissionChange(existing, finalPermissions, 'من نموذج إضافة/تعديل موظف');
      }

      confetti({ particleCount: 45, spread: 60 });
      toast.success(existing ? `تم تحديث بيانات ${fullName}.` : `تم إضافة الموظف ${fullName} وتفعيل دخوله للنظام.`);
      refreshData();
      setShowModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleTitle = (role: UserRole) => {
    switch (role) {
      case 'super_admin': return 'المدير العام (Super Admin)';
      case 'sales': return 'مسؤول المبيعات (Sales)';
      case 'inventory': return 'مسؤول المخزون والتصاريح (Inventory)';
      case 'accountant': return 'المحاسب المالي (Accountant)';
    }
  };

  const permissionsProfile = getProfileById(permissionsProfileId);

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-emerald-600" />
            <span>الموظفون والأدوار ومصفوفة الصلاحيات</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            إدارة حسابات فريق العمل، ربط الصلاحيات حسب الدور الوظيفي، وضبط إمكانية الوصول.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-bold">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>تشفير ومصادقة عبر Supabase Auth</span>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة موظف جديد</span>
          </button>
        </div>
      </div>

      {/* Staff List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {profiles.map(p => (
          <div
            key={p.id}
            className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-4 hover:border-emerald-500/40 hover:shadow-md transition-all shadow-sm"
          >
            <div className="flex items-center gap-3">
              <img
                src={p.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={p.fullName}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-inner"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{p.fullName}</h3>
                <div className="text-[11px] text-emerald-700 font-bold">{getRoleTitle(p.role)}</div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">اسم المستخدم:</span>
                <span className="font-mono font-bold text-slate-800">@{p.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">الهاتف:</span>
                <span className="font-mono font-bold text-slate-800">{p.phoneNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">الواتساب:</span>
                <span className="font-mono font-bold text-slate-800">{p.whatsappNumber}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                p.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {p.isActive ? 'الحساب نشط' : 'موقوف'}
              </span>

              <div className="flex items-center flex-wrap justify-end gap-x-2.5 gap-y-1">
                <button
                  onClick={() => handleOpenPermissionsModal(p)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>الصلاحيات</span>
                </button>

                <button
                  onClick={() => handleOpenEdit(p)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  <span>تعديل</span>
                </button>

                <button
                  onClick={() => handleToggleActive(p)}
                  className="text-[11px] font-bold text-slate-600 hover:text-emerald-700 underline"
                >
                  {p.isActive ? 'إيقاف مؤقت' : 'تفعيل'}
                </button>

                <button
                  onClick={() => handleDelete(p)}
                  disabled={p.id === currentUserId}
                  title={p.id === currentUserId ? 'لا يمكنك حذف حسابك الذي تسجّل الدخول به' : `حذف حساب ${p.fullName} نهائياً`}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editable Permissions Matrix */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">
              مصفوفة الصلاحيات — تعديل مباشر لكل موظف
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-500">
            اضغط على أي خانة لمنح أو سحب الصلاحية — يُحفظ فوراً في ملف الموظف
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4 text-right">الموظف</th>
                <th className="py-3 px-3">الدور</th>
                {PERMISSION_LABELS.map(({ key, label }) => (
                  <th key={key} className="py-3 px-3 whitespace-nowrap">{label}</th>
                ))}
                <th className="py-3 px-3 whitespace-nowrap">استعادة الافتراضي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {profiles.map(p => {
                const isAdminRole = p.role === 'super_admin';
                const effectivePermissions = isAdminRole ? ROLE_DEFAULT_PERMISSIONS.super_admin : p.customPermissions;
                const customized = isPermissionsCustomized(p);
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/60 ${customized ? 'bg-indigo-50/40' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={p.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={p.fullName}
                          className="w-8 h-8 rounded-xl object-cover border border-slate-200"
                        />
                        <div className="text-right">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{p.fullName}</span>
                            {customized && (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                                مخصصة
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">@{p.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${ROLE_BADGE_STYLES[p.role]}`}>
                        {getRoleTitle(p.role).split(' (')[0]}
                      </span>
                    </td>
                    {PERMISSION_LABELS.map(({ key, label }) => (
                      <td key={key} className="py-3 px-3">
                        <button
                          type="button"
                          disabled={isAdminRole || savingPermissionKey !== null}
                          title={
                            isAdminRole
                              ? 'المدير العام يملك كل الصلاحيات دائماً'
                              : effectivePermissions[key]
                                ? `سحب صلاحية «${label}» من ${p.fullName}`
                                : `منح صلاحية «${label}» لـ ${p.fullName}`
                          }
                          onClick={() => handleToggleMatrixPermission(p, key)}
                          className={`w-7 h-7 mx-auto rounded-lg border flex items-center justify-center transition-all ${
                            effectivePermissions[key]
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-50 border-slate-200 text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                          } ${isAdminRole ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {savingPermissionKey === `${p.id}:${key}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : effectivePermissions[key] ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    ))}
                    <td className="py-3 px-3">
                      {isAdminRole ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 whitespace-nowrap">
                          <Lock className="w-3 h-3" />
                          ثابتة دائماً
                        </span>
                      ) : customized ? (
                        <button
                          type="button"
                          onClick={() => handleResetMatrixPermissions(p)}
                          disabled={savingPermissionKey !== null}
                          title={`استعادة الصلاحيات الافتراضية لدور ${getRoleTitle(p.role)}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-900 disabled:opacity-40 whitespace-nowrap"
                        >
                          <RotateCcw className="w-3 h-3" />
                          الافتراضي
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-2.5 leading-relaxed">
          كل تعديل يُحفظ فوراً في ملف الموظف ويُزامن مع قاعدة البيانات السحابية، ويُسجَّل في سجل التدقيق. يُعلَّم الموظف صاحب الصلاحيات «المخصصة» بشارة بنفسجية، ويمكن إعادته لافتراضيات دوره بزر «الافتراضي». صلاحيات المدير العام ثابتة دائماً بكامل الصلاحيات. صلاحية «العرض» تتحكم في شاشات التشغيل (الرئيسية، الفترات، الطلبات، العملاء، الرسائل)، وصلاحية «التقارير» تتحكم في المحافظ والحسابات البنكية وسجل التدقيق — والقائمة الجانبية تُخفي تلقائياً أي شاشة لا تتوفر لها الصلاحية.
        </p>
      </div>

      {/* Role Defaults Reference (docx) */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-500" />
            <h3 className="text-base font-bold text-slate-900">
              المرجع الافتراضي للأدوار (Permissions Matrix)
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-500">
            حسب الهيكل المحدد في وثيقة المشروع — التعديل الفعلي من المصفوفة أعلاه أو زر «الصلاحيات» لكل موظف
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4 text-right">الوظيفة / الدور</th>
                {PERMISSION_LABELS.map(({ key, label }) => (
                  <th key={key} className="py-3 px-4">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {ROLE_REFERENCE_ROWS.map(({ role, label, labelClass, rowClass }) => (
                <tr key={role} className={`hover:bg-slate-50/60 ${rowClass || ''}`}>
                  <td className={`py-3.5 px-4 text-right font-bold ${labelClass}`}>
                    {label}
                  </td>
                  {PERMISSION_LABELS.map(({ key }) => (
                    <td key={key} className="py-3.5 px-4">
                      {ROLE_DEFAULT_PERMISSIONS[role][key] ? (
                        <Check className="w-4 h-4 mx-auto text-emerald-600" />
                      ) : (
                        <span className="text-slate-300 font-bold">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT EMPLOYEE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <span>{editingProfileId ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'}</span>
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل:</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="اسم الموظف الثلاثي..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم (للدخول):</label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                كلمة المرور {editingProfileId && <span className="text-slate-400 font-medium">(اتركها فارغة للإبقاء على الحالية)</span>}:
              </label>
              <input
                type="password"
                dir="ltr"
                required={!editingProfileId}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  dir="ltr"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+966..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الواتساب:</label>
                <input
                  type="text"
                  dir="ltr"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+966..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-left"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الدور الوظيفي:</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="sales">مسؤول المبيعات (Sales)</option>
                  <option value="inventory">مسؤول المخزون والتصاريح (Inventory)</option>
                  <option value="accountant">المحاسب المالي (Accountant)</option>
                  <option value="super_admin">المدير العام (Super Admin)</option>
                </select>
              </div>

              <ImageUploadField
                label="صورة الموظف (اختياري)"
                value={avatarUrl}
                onChange={setAvatarUrl}
                previewShape="circle"
                maxDimension={256}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                الصلاحيات المخصصة {role === 'super_admin' && <span className="text-emerald-600 font-medium">(المدير العام يملك كل الصلاحيات تلقائياً)</span>}:
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PERMISSION_LABELS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-[11px] font-bold select-none cursor-pointer transition-colors ${
                      permissions[key]
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    } ${role === 'super_admin' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      disabled={role === 'super_admin'}
                      onChange={() => handleTogglePermission(key)}
                      className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-2.5 leading-relaxed">
              يبدأ الموظف الجديد بحالة «نشط» ويمكنه الدخول فوراً باسم المستخدم وكلمة المرور من هذه الشاشة.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-md shadow-emerald-600/20"
              >
                {isSaving ? 'جاري الحفظ...' : editingProfileId ? 'حفظ التعديلات' : 'إضافة الموظف'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PERMISSIONS EDITOR MODAL */}
      {permissionsProfile && draftPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>تعديل صلاحيات الموظف</span>
              </h3>
              <button type="button" onClick={handleClosePermissionsModal} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <img
                src={permissionsProfile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={permissionsProfile.fullName}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200"
              />
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-900">{permissionsProfile.fullName}</div>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_BADGE_STYLES[permissionsProfile.role]}`}>
                  {getRoleTitle(permissionsProfile.role)}
                </span>
              </div>
            </div>

            {permissionsProfile.role === 'super_admin' ? (
              <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3 leading-relaxed">
                المدير العام يملك كل الصلاحيات دائماً ولا يمكن تقييدها. لتقييد هذا الموظف، غيّر دوره الوظيفي أولاً من زر «تعديل» ثم عدّل صلاحياته.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {PERMISSION_LABELS.map(({ key, label }) => (
                    <label
                      key={key}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 transition-colors cursor-pointer select-none ${
                        draftPermissions[key] ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={draftPermissions[key]}
                        onChange={() => handleToggleDraftPermission(key)}
                        className="sr-only peer"
                      />
                      <span>
                        <span className={`block text-xs font-bold ${draftPermissions[key] ? 'text-emerald-900' : 'text-slate-600'}`}>{label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{PERMISSION_DESCRIPTIONS[key]}</span>
                      </span>
                      <span className="relative inline-flex items-center shrink-0">
                        <span className="block w-9 h-5 bg-slate-200 rounded-full transition-colors peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:-translate-x-4 peer-checked:after:border-white" />
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleResetDraftToRoleDefaults}
                    title={`استعادة الصلاحيات الافتراضية لدور ${getRoleTitle(permissionsProfile.role)}`}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 hover:text-amber-900"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة افتراضي الدور</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClosePermissionsModal}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePermissionsModal}
                      disabled={isSavingPermissions}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-md shadow-indigo-600/20"
                    >
                      {isSavingPermissions ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {permissionsProfile.role === 'super_admin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleClosePermissionsModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إغلاق
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
