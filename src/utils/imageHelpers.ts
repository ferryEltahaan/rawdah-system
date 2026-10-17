export const MAX_IMAGE_FILE_MB = 10;

/**
 * يقرأ ملف صورة من الجهاز ويضغطه (تصغير الأبعاد + JPEG/PNG) ويعيده كـ data URL
 * جاهزاً للحفظ — يحافظ على شفافية PNG عند الحاجة ويختار الأصغر حجماً.
 */
export async function compressImageFile(file: File, maxDimension: number): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode-failed'));
    img.src = dataUrl;
  });

  const largestSide = Math.max(image.width, image.height);
  const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;
  if (scale === 1 && dataUrl.length < 100_000) return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  const isPng = file.type === 'image/png';
  if (!isPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const candidates: string[] = [];
  if (isPng) {
    const png = canvas.toDataURL('image/png');
    candidates.push(png);
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const flatCtx = flat.getContext('2d');
    if (flatCtx) {
      flatCtx.fillStyle = '#ffffff';
      flatCtx.fillRect(0, 0, flat.width, flat.height);
      flatCtx.drawImage(canvas, 0, 0);
      const jpeg = flat.toDataURL('image/jpeg', 0.78);
      // نفضّل PNG للشعارات ذات الخلفية الشفافة، وJPEG فقط عند توفير كبير في الحجم
      if (jpeg.length <= png.length * 0.7) candidates.push(jpeg);
    }
  } else {
    candidates.push(canvas.toDataURL('image/jpeg', 0.78));
  }

  return candidates.reduce((smallest, candidate) => (candidate.length < smallest.length ? candidate : smallest), dataUrl);
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'الملف المختار ليس صورة صالحة — اختر ملف JPG أو PNG أو WebP.';
  }
  if (file.size > MAX_IMAGE_FILE_MB * 1024 * 1024) {
    return `حجم الصورة كبير جداً — الحد الأقصى ${MAX_IMAGE_FILE_MB} ميجابايت.`;
  }
  return null;
}

export function describeDataUrlSize(dataUrl: string): string {
  return `${Math.max(1, Math.round(dataUrl.length / 1024))} كيلوبايت`;
}

/**
 * يحوّل data URL إلى Blob — هذا شرط أساسي للحصول على رابط حقيقي يعمل على الموبايل،
 * لأن متصفحات الجوال ترفض تنزيل روابط data: وتفتحها كصفحة فارغة.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error('fetch-failed');
  return await response.blob();
}

export async function dataUrlToObjectUrl(dataUrl: string): Promise<string> {
  return URL.createObjectURL(await dataUrlToBlob(dataUrl));
}

/** هل يمكن مشاركة هذا الملف مباشرة من داخل الموقع (زر "مشاركة" → واتساب)؟ */
export async function canShareImageFile(blob: Blob): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.canShare) return false;
    return navigator.canShare({ files: [new File([blob], 'permit.png', { type: blob.type || 'image/png' })] });
  } catch {
    return false;
  }
}
