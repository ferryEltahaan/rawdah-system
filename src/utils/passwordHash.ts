// ==============================================================================
// تشفير كلمات المرور محلياً (SHA-256 عبر Web Crypto API)
// الهدف: عدم ظهور كلمات المرور نصاً صريحاً داخل حزمة الكود المُرسلة للمتصفح.
// ==============================================================================

/**
 * يُنتج بصمة SHA-256 لكلمة المرور ( hex بطول 64 ).
 * العملية غير قابلة للعكس ولا تخزن كلمة المرور الأصلية.
 */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * يتحقق هل القيمة المخزنة بصمة مشفرة (وليست كلمة مرور قديمة بنص صريح).
 * بصمة SHA-256 hex تتكون من 64 حرفاً hexadecimal بالضبط.
 */
export function isPasswordHash(value: string | undefined | null): boolean {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

/**
 * مقارنة آمنة نسبياً لكلمة المرور المدخلة ضد القيمة المخزنة.
 * يدعم القيم القديمة النصية الصريحة (للترحيل التدريجي) والبصمات المشفرة.
 * يعيد { matches, needsMigration } — needsMigration=true عندما تطابق نص قديم
 * صريح ويجب استبداله بالبصمة فوراً.
 */
export async function verifyPassword(
  input: string,
  stored: string
): Promise<{ matches: boolean; needsMigration: boolean }> {
  if (isPasswordHash(stored)) {
    const inputHash = await hashPassword(input);
    return { matches: inputHash === stored.toLowerCase(), needsMigration: false };
  }
  // قديم: نص صريح مخزن — نقارن مباشرة ثم نرحّل
  return { matches: stored === input, needsMigration: stored === input };
}
