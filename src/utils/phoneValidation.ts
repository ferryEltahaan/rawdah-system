/**
 * تحقق وتوحيد أرقام الواتساب — النظام يستقبل أرقاماً سعودية (+966) ومصرية (+20) فقط.
 * المخرجات دائماً بالصيغة الدولية +CCCXXXXXXXXX جاهزة لروابط wa.me.
 */
export interface PhoneValidationResult {
  valid: boolean;
  normalized: string; // الصيغة الدولية الموحدة +CCCXXXXXXXXX — فارغة عند فشل التحقق
  error: string;      // نص الخطأ بالعربية — فارغ عند النجاح
}

const SAUDI_MOBILE_PREFIX = /^5\d{8}$/;      // 5XXXXXXXX بعد إسقاط الصفر
const EGYPT_MOBILE_PREFIX = /^1[0125]\d{8}$/; // 1XXXXXXXXX بعد إسقاط الصفر

export function validateWhatsappNumber(raw: string): PhoneValidationResult {
  const fail = (error: string): PhoneValidationResult => ({ valid: false, normalized: '', error });
  let s = String(raw || '').trim().replace(/[\s\-().]/g, '');
  if (!s) return fail('رقم الواتساب مطلوب.');

  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+$/.test(s)) return fail('الرقم يحتوي رموزاً غير صحيحة.');

  if (s.startsWith('966')) {
    let rest = s.slice(3);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (SAUDI_MOBILE_PREFIX.test(rest)) return { valid: true, normalized: '+966' + rest, error: '' };
    return fail('رقم سعودي غير صحيح — الصيغة الصحيحة +9665XXXXXXXX (9 أرقام بعد مفتاح الدولة).');
  }

  if (s.startsWith('20')) {
    let rest = s.slice(2);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (EGYPT_MOBILE_PREFIX.test(rest)) return { valid: true, normalized: '+20' + rest, error: '' };
    return fail('رقم مصري غير صحيح — الصيغة الصحيحة +201XXXXXXXXX (10 أرقام بعد مفتاح الدولة).');
  }

  // رقم محلي بدون مفتاح دولة
  if (s.startsWith('0')) s = s.slice(1);

  if (SAUDI_MOBILE_PREFIX.test(s)) return { valid: true, normalized: '+966' + s, error: '' };
  if (EGYPT_MOBILE_PREFIX.test(s)) return { valid: true, normalized: '+20' + s, error: '' };

  return fail('الرقم يجب أن يكون سعودي (+966) أو مصري (+20) — مثال: 0501234567 أو 01001234567.');
}
