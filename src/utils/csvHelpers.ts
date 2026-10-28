export function formatDateTimeRiyadh(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const time = date.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} ${time}`;
}

export function todayRiyadh(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

/**
 * التحقق مما إذا كانت الفترة الزمنية للتصريح قد انقضت بتوقيت مكة المكرمة (الرياض GMT+3)
 * @param slotDate تاريخ الفترة YYYY-MM-DD
 * @param slotHour ساعة الفترة 0..23
 * @param slotMinute دقيقة الفترة 0, 20, 40
 * @param graceMinutes فترة السماح بعد بدء الفترة بالدقائق (افتراضياً 180 دقيقة / 3 ساعات للسماح بالمرونة التشغيلية وسحب التصاريح لنفس اليوم)
 */
export function isSlotPast(
  slotDate: string,
  slotHour: number,
  slotMinute: number,
  graceMinutes = 180
): boolean {
  if (!slotDate) return false;
  const today = todayRiyadh();
  // التواريخ السابقة تعتبر منتهية دائماً
  if (slotDate < today) return true;
  // التواريخ المستقبلية لا تنتهي أبداً
  if (slotDate > today) return false;

  // بالنسبة لفترات اليوم الحالي: فترة سماح واسعة (3 ساعات) من بداية الفترة
  const pad = (n: number) => String(n).padStart(2, '0');
  const slotStartTime = new Date(`${slotDate}T${pad(slotHour)}:${pad(slotMinute)}:00+03:00`).getTime();
  if (isNaN(slotStartTime)) return false;
  const slotEndTime = slotStartTime + graceMinutes * 60 * 1000;
  return Date.now() > slotEndTime;
}

// أسماء العملاء تصل من نموذج تسجيل عام بدون مصادقة، فأي خلية تبدأ بأحد هذه
// المحارف تتحول إلى صيغة تُنفَّذ في جهاز الموظف لحظة فتح الملف في إكسل
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCsvCell(value: string | number | undefined | null, numeric: boolean = false): string {
  let text = String(value ?? '');
  // القيم الرقمية الحقيقية لا تحمل صيغاً، وبادئة الاقتباس كانت ستُفسد الأعمدة المالية
  if (!numeric && typeof value === 'string' && CSV_FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][],
  numericColumns?: number[]
): void {
  try {
    const numeric = new Set(numericColumns ?? []);
    const lines = [
      headers.map(header => escapeCsvCell(header)).join(','),
      ...rows.map(row => row.map((cell, index) => escapeCsvCell(cell, numeric.has(index))).join(',')),
    ];
    // BOM في البداية حتى تفتح إكسل الملف بالعربية بشكل صحيح
    const csvContent = '\uFEFF' + lines.join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`);
    link.style.visibility = 'hidden';
    link.style.position = 'absolute';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 200);
  } catch (err) {
    console.error('Failed to download CSV:', err);
  }
}
