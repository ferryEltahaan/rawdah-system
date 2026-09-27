import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────────────────────────────────────
// Supabase Client — يُعاد بناؤه فور تغيير بيانات الاتصال
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_SUPABASE_URL = 'https://aeuavoqhrhzsxblrddlc.supabase.co';
const DEFAULT_SUPABASE_KEY = '[REDACTED-SERVICE_ROLE_KEY]';

function getSupabaseCredentials(): { url: string; key: string } {
  const url =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    localStorage.getItem('rawdah_cloud_supabase_url') ||
    DEFAULT_SUPABASE_URL;
  const key =
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    localStorage.getItem('rawdah_cloud_supabase_key') ||
    DEFAULT_SUPABASE_KEY;
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
