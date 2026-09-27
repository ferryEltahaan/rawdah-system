import React, { useState } from 'react';
import { 
  Cloud, 
  ShieldCheck, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { reinitSupabase } from '../services/supabase';
import { DataService } from '../services/dataService';

interface CloudSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudSetupModal: React.FC<CloudSetupModalProps> = ({ isOpen, onClose }) => {
  const [supabaseUrl, setSupabaseUrl] = useState(
    localStorage.getItem('rawdah_cloud_supabase_url') || ''
  );
  const [supabaseKey, setSupabaseKey] = useState(
    localStorage.getItem('rawdah_cloud_supabase_key') || ''
  );
  const [webhookSecret, setWebhookSecret] = useState(
    localStorage.getItem('rawdah_sms_secret') || 'rawdah_sec_2026'
  );
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('rawdah_cloud_supabase_url', supabaseUrl.trim());
    localStorage.setItem('rawdah_cloud_supabase_key', supabaseKey.trim());
    localStorage.setItem('rawdah_sms_secret', webhookSecret.trim());

    // أعد بناء الـ client فوراً
    reinitSupabase();

    confetti({ particleCount: 50, spread: 60 });
    setSavedSuccess(true);

    // زامن البيانات من السحابة
    await DataService.syncFromCloud();

    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
      // أطلق حدث تحديث حتى يُعيد App تحميل البيانات
      window.dispatchEvent(new Event('rawdah_storage_update'));
    }, 1500);
  };

  const copySqlPath = () => {
    navigator.clipboard.writeText('database/schema.sql');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <Cloud className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">إعدادات الربط السحابي والأمان (Cloud Integration)</h3>
              <p className="text-[11px] text-slate-500 font-medium">ربط النظام بقاعدة بيانات Supabase السحابية المباشرة</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold p-1">✕</button>
        </div>

        {/* 3 Quick Steps */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2 text-slate-700">
          <div className="font-bold text-emerald-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>خطوات تفعيل السحابة في دقيقة واحدة:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pr-1">
            <li>أنشئ مشروعاً مجانياً على <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-bold inline-flex items-center gap-0.5">Supabase.com <ExternalLink className="w-3 h-3" /></a></li>
            <li>ادخل على <strong>SQL Editor</strong> والصق محتوى ملف <button onClick={copySqlPath} className="text-amber-700 underline font-mono font-bold inline-flex items-center gap-1">database/schema.sql {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}</button> لتوليد الجداول السحابية وقواعد الأمان RLS.</li>
            <li>انسخ <strong>Project URL</strong> و <strong>Anon Key</strong> من إعدادات الـ API والصقهما بالأسفل:</li>
          </ol>
        </div>

        {/* Inputs Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              رابط المشروع السحابي (Supabase Project URL):
            </label>
            <input
              type="url"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              المفتاح العام المشفر (Supabase Anon Key):
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              مفتاح أمان Webhook رسائل الـ SMS (Secret Token):
            </label>
            <input
              type="text"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-amber-600 font-mono"
            />
          </div>

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>تم حفظ الإعدادات بنجاح وجاري إعادة التحميل السحابي...</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              إغلاق
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md shadow-emerald-700/20"
            >
              حفظ وتفعيل الربط السحابي
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
