import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────────────────────────────────────
// Supabase Client — يُعاد بناؤه فور تغيير بيانات الاتصال
// ──────────────────────────────────────────────────────────────────────────────

// بريد المصادقة الاصطناعي: المستخدمون يُنشأون يدوياً من لوحة Supabase بهذه
// الصيغة حرفياً (database/schema.sql — القسم 10)، لذا تحويل اسم المستخدم إلى
// بريد يجب أن يبقى متطابقاً في شاشة الدخول وفي تغيير كلمة المرور.
export const AUTH_EMAIL_DOMAIN = 'rawdah.app';

export function toAuthEmail(usernameOrEmail: string): string {
  const v = usernameOrEmail.toLowerCase().trim();
  return v.includes('@') ? v : `${v}@${AUTH_EMAIL_DOMAIN}`;
}

// مطابقة مرنة: البروفايلات المتزامنة من السحابة قد تخزّن اسم المستخدم كبريد
// كامل (admin@rawdah.app) بينما يُعرض الاسم المختصر (admin) — نوحّد الصيغتين
export function normUsername(u: string): string {
  return (u || '').toLowerCase().trim().replace(new RegExp(`@${AUTH_EMAIL_DOMAIN.replace('.', '\\.')}$`), '');
}

const DEFAULT_SUPABASE_URL = 'https://aeuavoqhrhzsxblrddlc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_8yWMCFKNbdOnAfLjpmKBlA_kSWTdx66';

function getSupabaseCredentials(): { url: string; key: string } {
  const url =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    localStorage.getItem('rawdah_cloud_supabase_url') ||
    DEFAULT_SUPABASE_URL;
  const key =
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    localStorage.getItem('rawdah_cloud_supabase_key') ||
    DEFAULT_SUPABASE_ANON_KEY;
  return { url, key };
}

function buildClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key || url.includes('your-project-id')) return null;
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

// ── الحالة المُشتركة ──────────────────────────────────────────────────────────
let _credentials = getSupabaseCredentials();
let _client: SupabaseClient | null = buildClient(_credentials.url, _credentials.key);

export let isSupabaseConfigured: boolean = _client !== null;
export let supabase: SupabaseClient | null = _client;

/**
 * يُعيد بناء الـ client بعد تغيير بيانات الاتصال
 * استدعيها بعد حفظ URL / KEY في localStorage
 */
export function reinitSupabase(): void {
  _credentials = getSupabaseCredentials();
  _client = buildClient(_credentials.url, _credentials.key);
  isSupabaseConfigured = _client !== null;
  supabase = _client;
  // أطلق حدثاً لإخطار بقية التطبيق
  window.dispatchEvent(new Event('rawdah_cloud_updated'));
}
