import { useCallback } from 'react';
import { useToast } from '../components/Toast';
import { dataUrlToBlob, dataUrlToObjectUrl, canShareImageFile } from '../utils/imageHelpers';

type ShareResult = 'shared' | 'downloaded' | 'unavailable' | 'cancelled';

const UNSAFE_IMAGE_MESSAGE = 'رابط هذه الصورة غير مسموح أو تالف — المسموح روابط https أو صورة محفوظة داخل النظام فقط.';

// عمود image_url يكتبه أي موظف مسجّل الدخول، فقيمة javascript: مخزّنة فيه تتحول إلى
// XSS محفوظة لحظة فتح الرابط في نافذة أو تنزيله — لا نقبل إلا http(s) أو صورة data:image
function isSafeImageUrl(raw: string | null | undefined): boolean {
  const value = String(raw ?? '').trim();
  if (!value || /[\u0000-\u001F\u007F]/.test(value)) return false;
  if (/^data:/i.test(value)) return /^data:image\//i.test(value);
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * إجراءات الصور التي تعمل على الموبايل والكمبيوتر معاً.
 *
 * السبب الرئيسي: صور التصاريح محفوظة كـ data URLs، ومتصفحات الجوال
 * تتجاهل سمة download وتفتح الرابط كصفحة فارغة. الحل هو تحويلها إلى
 * Blob URL قبل التنزيل، واستخدام Web Share API للمشاركة المباشرة.
 */
export function useImageActions() {
  const toast = useToast();

  const download = useCallback(async (imageUrl: string, filename: string): Promise<boolean> => {
    if (!isSafeImageUrl(imageUrl)) {
      toast.error(UNSAFE_IMAGE_MESSAGE);
      return false;
    }
    try {
      const isDataUrl = imageUrl.startsWith('data:');
      const objectUrl = isDataUrl ? await dataUrlToObjectUrl(imageUrl) : imageUrl;
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (isDataUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
      return true;
    } catch {
      // الحل الأخير: فتح الصورة في تبويب جديد ليحفظها المستخدم يدوياً
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
      toast.info('تعذر التحميل المباشر — فُتحت الصورة في تبويب جديد، احفظها يدوياً بالضغط المطول عليها.');
      return false;
    }
  }, [toast]);

  const share = useCallback(async (
    imageUrl: string,
    filename: string,
    options?: { title?: string; text?: string }
  ): Promise<ShareResult> => {
    if (typeof navigator === 'undefined' || !navigator.share) return 'unavailable';
    try {
      const blob = await dataUrlToBlob(imageUrl);
      if (!(await canShareImageFile(blob))) return 'unavailable';
      const file = new File([blob], filename, { type: blob.type || 'image/png' });
      await navigator.share({
        files: [file],
        title: options?.title || filename,
        text: options?.text || '',
      });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      return 'unavailable';
    }
  }, []);

  // مشاركة مباشرة، ومع تعذر المشاركة ننتقل للتحميل تلقائياً
  const shareOrDownload = useCallback(async (
    imageUrl: string,
    filename: string,
    options?: { title?: string; text?: string; downloadedMessage?: string }
  ): Promise<ShareResult> => {
    if (!isSafeImageUrl(imageUrl)) {
      toast.error(UNSAFE_IMAGE_MESSAGE);
      return 'unavailable';
    }
    const result = await share(imageUrl, filename, options);
    if (result === 'shared') {
      toast.success('تم فتح قائمة المشاركة — اختر واتساب لإرسال الصورة مباشرة.');
      return 'shared';
    }
    if (result === 'cancelled') return 'cancelled';
    await download(imageUrl, filename);
    toast.info(options?.downloadedMessage || 'متصفحك لا يدعم المشاركة المباشرة — تم تحميل الصورة على جهازك بدلاً من ذلك.');
    return 'downloaded';
  }, [share, download, toast]);

  // نسخ الصورة للحافظة (كمبيوتر فقط) — على الموبايل نحمّلها كحل بديل
  const copyOrDownload = useCallback(async (imageUrl: string, filename: string): Promise<void> => {
    if (!isSafeImageUrl(imageUrl)) {
      toast.error(UNSAFE_IMAGE_MESSAGE);
      return;
    }
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success('تم نسخ الصورة إلى الحافظة.');
    } catch {
      await download(imageUrl, filename);
      toast.info('لا يدعم هذا المتصفح نسخ الصور — تم تحميلها على جهازك لترفقها في رسالة الواتساب.');
    }
  }, [download, toast]);

  return { download, share, shareOrDownload, copyOrDownload };
}
