/**
 * تحقق وتوحيد أرقام الواتساب — يدعم الأرقام السعودية (+966)، المصرية (+20)، دول الخليج، والأرقام الدولية كافة.
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
  const hadPlus = s.startsWith('+');
  if (hadPlus) s = s.slice(1);

  if (!/^\d+$/.test(s)) return fail('الرقم يحتوي رموزاً غير صحيحة.');

  // 1. رقم سعودي بمفتاح الدولة (+966)
  if (s.startsWith('966')) {
    let rest = s.slice(3);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (SAUDI_MOBILE_PREFIX.test(rest)) return { valid: true, normalized: '+966' + rest, error: '' };
    return fail('رقم سعودي غير صحيح — الصيغة الصحيحة +9665XXXXXXXX (9 أرقام بعد مفتاح الدولة).');
  }

  // 2. رقم مصري بمفتاح الدولة (+20)
  if (s.startsWith('20')) {
    let rest = s.slice(2);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (EGYPT_MOBILE_PREFIX.test(rest)) return { valid: true, normalized: '+20' + rest, error: '' };
    return fail('رقم مصري غير صحيح — الصيغة الصحيحة +201XXXXXXXXX (10 أرقام بعد مفتاح الدولة).');
  }

  // 3. أرقام دول مجلس التعاون الخليجي والدول العربية الشائعة بمفتاح الدولة
  // الكويت 965، الإمارات 971، قطر 974، البحرين 973، عمان 968، الأردن 962
  const gccPrefixes = ['965', '971', '974', '973', '968', '962'];
  for (const prefix of gccPrefixes) {
    if (s.startsWith(prefix)) {
      const rest = s.slice(prefix.length).replace(/^0+/, '');
      if (rest.length >= 7 && rest.length <= 10) {
        return { valid: true, normalized: `+${prefix}${rest}`, error: '' };
      }
    }
  }

  // 4. أرقام دولية أخرى تم إدخالها مع علامة (+) أو (00) مسبقاً
  if (hadPlus) {
    if (s.length >= 8 && s.length <= 15) {
      return { valid: true, normalized: `+${s}`, error: '' };
    }
    return fail('الرقم الدولي غير صحيح — يجب أن يتكون من 8 إلى 15 رقماً بعد مفتاح الدولة.');
  }

  // 5. رقم محلي بدون مفتاح دولة (يبدأ بـ 0)
  if (s.startsWith('0')) s = s.slice(1);

  if (SAUDI_MOBILE_PREFIX.test(s)) return { valid: true, normalized: '+966' + s, error: '' };
  if (EGYPT_MOBILE_PREFIX.test(s)) return { valid: true, normalized: '+20' + s, error: '' };

  return fail('يرجى إدخال رقم صحيح يبدأ بمفتاح الدولة (مثال: +966 للسعودية، +20 لمصر، +965 للكويت).');
}
