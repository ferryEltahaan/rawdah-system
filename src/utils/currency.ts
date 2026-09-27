import { AccountProvider, CurrencyCode, FinancialAccount, SalesOrder } from '../types';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  SAR: 'ر.س',
  EGP: 'ج.م',
};

export const currencySymbol = (code: CurrencyCode | undefined): string =>
  CURRENCY_SYMBOLS[code || 'SAR'];

/** عملة الطلب — الافتراضي ر.س عند الغياب (توافقاً مع البيانات القديمة) */
export const getOrderCurrency = (order: Pick<SalesOrder, 'currency'>): CurrencyCode =>
  order.currency || 'SAR';

/** مزودو المحافظ المصرية — عملتهم الجنيه افتراضياً */
const EGP_PROVIDERS: AccountProvider[] = ['vodafone_cash', 'orange_cash', 'etisalat_cash', 'instapay'];

export const providerCurrency = (provider: AccountProvider): CurrencyCode =>
  EGP_PROVIDERS.includes(provider) ? 'EGP' : 'SAR';

/** عملة الحساب المالي — الحقل الصريح أولاً ثم الاستنتاج من المزود */
export const accountCurrency = (account: Pick<FinancialAccount, 'provider' | 'currency'>): CurrencyCode =>
  account.currency || providerCurrency(account.provider);
