import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  MessageCircle, 
  Tag, 
  ShoppingBag, 
  Edit
} from 'lucide-react';
import { Customer, SalesOrder, UserProfile } from '../types';
import { DataService } from '../services/dataService';
import { currencySymbol, getOrderCurrency } from '../utils/currency';
import { useToast } from './Toast';
import confetti from 'canvas-confetti';

interface CustomersCRMProps {
  currentUser: UserProfile;
}

export const CustomersCRM: React.FC<CustomersCRMProps> = () => {
  const [customers, setCustomers] = useState<Customer[]>(DataService.getCustomers());
  const [orders, setOrders] = useState<SalesOrder[]>(DataService.getOrders());
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [additionalPhone, setAdditionalPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [notes, setNotes] = useState('');

  const refreshData = () => {
    setCustomers(DataService.getCustomers());
    setOrders(DataService.getOrders());
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

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

    DataService.saveCustomer({
      id: editingCustomer ? editingCustomer.id : undefined,
      fullName,
      whatsappNumber,
      additionalPhone,
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

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>سجل وقاعدة بيانات العملاء</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            إدارة بيانات المعتمرين، أرقام الواتساب، والأسماء المستعارة (Nickname) لسهولة التنسيق.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة عميل جديد</span>
        </button>
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

              <button
                onClick={() => handleOpenEdit(customer)}
                className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors border border-slate-200 shadow-sm"
                title="تعديل بيانات العميل"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
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
                <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
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
                type="text"
                required
                placeholder="+966501234567 أو +201012345678"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
              />
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

    </div>
  );
};
