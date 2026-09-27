import React, { useState, useEffect } from 'react';
import { 
  WalletCards, 
  Plus, 
  Landmark, 
  Smartphone,
  Pencil
} from 'lucide-react';
import { FinancialAccount, AccountType, AccountProvider, CurrencyCode } from '../types';
import { DataService } from '../services/dataService';
import { accountCurrency, currencySymbol, providerCurrency } from '../utils/currency';
import { useToast } from './Toast';
import confetti from 'canvas-confetti';

export const FinancialAccountsView: React.FC = () => {
  const toast = useToast();
  const [accounts, setAccounts] = useState<FinancialAccount[]>(DataService.getFinancialAccounts());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  
  // Form states
  const [type, setType] = useState<AccountType>('wallet');
  const [provider, setProvider] = useState<AccountProvider>('vodafone_cash');
  const [currency, setCurrency] = useState<CurrencyCode>('SAR');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [iban, setIban] = useState('');
  const [branchName, setBranchName] = useState('');
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const refreshData = () => {
    setAccounts(DataService.getFinancialAccounts());
  };

  useEffect(() => {
    window.addEventListener('rawdah_storage_update', refreshData);
    return () => window.removeEventListener('rawdah_storage_update', refreshData);
  }, []);

  const handleOpenCreate = () => {
    setEditingAccountId(null);
    setType('wallet');
    setProvider('vodafone_cash');
    setCurrency(providerCurrency('vodafone_cash'));
    setAccountName('');
    setAccountNumber('');
    setAccountHolderName('');
    setIban('');
    setBranchName('');
    setCurrentBalance(0);
    setNotes('');
    setIsActive(true);
    setShowAddModal(true);
  };

  const handleOpenEdit = (acc: FinancialAccount) => {
    setEditingAccountId(acc.id);
    setType(acc.type);
    setProvider(acc.provider);
    setCurrency(accountCurrency(acc));
    setAccountName(acc.accountName);
    setAccountNumber(acc.accountNumber);
    setAccountHolderName(acc.accountHolderName || '');
    setIban(acc.iban || '');
    setBranchName(acc.branchName || '');
    setCurrentBalance(acc.currentBalance);
    setNotes(acc.notes || '');
    setIsActive(acc.isActive);
    setShowAddModal(true);
  };

  const handleProviderChange = (p: AccountProvider) => {
    setProvider(p);
    setCurrency(providerCurrency(p));
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await DataService.saveFinancialAccount({
      id: editingAccountId || undefined,
      type,
      provider,
      currency,
      accountName,
      accountNumber,
      accountHolderName: type === 'bank' ? accountHolderName : '',
      iban: type === 'bank' ? iban : '',
      branchName: type === 'bank' ? branchName : '',
      currentBalance,
      isActive,
      notes,
    });

    confetti({ particleCount: 35, spread: 50 });
    toast.success(editingAccountId ? `تم تحديث بيانات «${accountName}».` : `تمت إضافة «${accountName}» بنجاح.`);
    refreshData();
    setShowAddModal(false);
  };

  const totalsByCurrency = (accountType: AccountType): Record<CurrencyCode, number> => {
    const totals: Record<CurrencyCode, number> = { SAR: 0, EGP: 0 };
    accounts
      .filter(a => a.type === accountType)
      .forEach(a => { totals[accountCurrency(a)] += a.currentBalance; });
    return totals;
  };

  const walletTotals = totalsByCurrency('wallet');
  const bankTotals = totalsByCurrency('bank');

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <WalletCards className="w-5 h-5 text-emerald-600" />
            <span>الحسابات البنكية والمحافظ الإلكترونية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            إدارة محافظ (Vodafone Cash, InstaPay, Orange) وحسابات البنوك مع الأرصدة التراكمية.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة محفظة / حساب بنكي</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-emerald-200 rounded-3xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>إجمالي أرصدة المحافظ الإلكترونية</span>
            </span>
            <div className="text-2xl font-black font-mono text-slate-900 flex items-baseline gap-1 flex-wrap">
              {walletTotals.SAR.toLocaleString('ar-SA')} <span className="text-xs font-normal text-slate-500">ر.س</span>
              {walletTotals.EGP > 0 && (
                <>
                  <span className="text-slate-300 text-sm mx-0.5">+</span>
                  {walletTotals.EGP.toLocaleString('ar-SA')} <span className="text-xs font-normal text-slate-500">ج.م</span>
                </>
              )}
            </div>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-200">
            {accounts.filter(a => a.type === 'wallet').length} محافظ نشطة
          </span>
        </div>

        <div className="bg-white border-2 border-amber-200 rounded-3xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
              <Landmark className="w-4 h-4" />
              <span>إجمالي أرصدة الحسابات البنكية</span>
            </span>
            <div className="text-2xl font-black font-mono text-slate-900 flex items-baseline gap-1 flex-wrap">
              {bankTotals.SAR.toLocaleString('ar-SA')} <span className="text-xs font-normal text-slate-500">ر.س</span>
              {bankTotals.EGP > 0 && (
                <>
                  <span className="text-slate-300 text-sm mx-0.5">+</span>
                  {bankTotals.EGP.toLocaleString('ar-SA')} <span className="text-xs font-normal text-slate-500">ج.م</span>
                </>
              )}
            </div>
          </div>
          <span className="text-xs bg-amber-50 text-amber-800 font-bold px-3 py-1 rounded-full border border-amber-200">
            {accounts.filter(a => a.type === 'bank').length} حسابات بنكية
          </span>
        </div>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acc => (
          <div
            key={acc.id}
            className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 hover:border-emerald-500/50 transition-all shadow-sm hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${
                  acc.type === 'wallet' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {acc.type === 'wallet' ? <Smartphone className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{acc.accountName}</h3>
                  <span className="text-[10px] text-slate-500 font-mono font-medium">{acc.accountNumber}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  acc.isActive
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {acc.isActive ? 'فعال' : 'موقوف'}
                </span>

                <button
                  onClick={() => handleOpenEdit(acc)}
                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition-all"
                  title="تعديل بيانات الحساب"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Balances & Info */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <span>الرصيد المتاح:</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${
                    accountCurrency(acc) === 'SAR'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {currencySymbol(accountCurrency(acc))}
                  </span>
                </span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {acc.currentBalance.toLocaleString()} {currencySymbol(accountCurrency(acc))}
                </span>
              </div>

              {acc.accountHolderName && (
                <div className="flex items-center justify-between text-[11px] text-slate-700">
                  <span className="text-slate-500">صاحب الحساب:</span>
                  <span className="font-semibold">{acc.accountHolderName}</span>
                </div>
              )}

              {acc.branchName && (
                <div className="flex items-center justify-between text-[11px] text-slate-700">
                  <span className="text-slate-500">الفرع:</span>
                  <span className="font-semibold">{acc.branchName}</span>
                </div>
              )}

              {acc.iban && (
                <div className="flex items-center justify-between text-[11px] text-slate-700">
                  <span className="text-slate-500">IBAN:</span>
                  <span className="font-mono text-[10px] text-slate-600 font-bold">{acc.iban}</span>
                </div>
              )}

              {acc.notes && (
                <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2.5 rounded-xl mt-2 border border-slate-200">
                  {acc.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ADD ACCOUNT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleSaveAccount} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <WalletCards className="w-5 h-5 text-emerald-600" />
                <span>{editingAccountId ? 'تعديل بيانات الحساب' : 'إضافة محفظة أو حساب بنكي'}</span>
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">النوع:</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="wallet">محفظة إلكترونية</option>
                  <option value="bank">حساب بنكي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مزود الخدمة:</label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as AccountProvider)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="vodafone_cash">Vodafone Cash</option>
                  <option value="instapay">InstaPay</option>
                  <option value="orange_cash">Orange Cash</option>
                  <option value="etisalat_cash">Etisalat Cash</option>
                  <option value="al_rajhi">مصرف الراجحي</option>
                  <option value="al_ahli">البنك الأهلي SNB</option>
                  <option value="riyad_bank">بنك الرياض</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">عملة الخزنة:</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCurrency('SAR')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currency === 'SAR'
                      ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ريال سعودي ر.س
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('EGP')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currency === 'EGP'
                      ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  جنيه مصري ج.م
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                تُستخدم هذه العملة عند مطابقة رسائل السداد — النظام يفضّل خزنة بنفس عملة الطلب.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم الحساب / المحفظة:</label>
              <input
                type="text"
                required
                placeholder="مثال: فودافون كاش المبيعات"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم المحفظة / رقم الحساب:</label>
              <input
                type="text"
                required
                placeholder="رقم الهاتف أو رقم الحساب..."
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {type === 'bank' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم صاحب الحساب:</label>
                  <input
                    type="text"
                    placeholder="الاسم المسجل في البنك..."
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الآيبان (IBAN):</label>
                  <input
                    type="text"
                    placeholder="SA..."
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">فرع البنك (اختياري):</label>
                  <input
                    type="text"
                    placeholder="مثال: فرع العليا - الرياض"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {editingAccountId ? 'الرصيد الحالي:' : 'الرصيد الافتتاحي:'} ({currencySymbol(currency)})
              </label>
              <input
                type="number"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات (اختياري):</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات على الحساب أو حدود السحب اليومية..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <label className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-2xl px-3.5 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-emerald-900">
                الحساب فعال ومتاح لاستقبال التحويلات والسداد
              </span>
            </label>

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
                {editingAccountId ? 'حفظ التعديلات' : 'حفظ الحساب'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
