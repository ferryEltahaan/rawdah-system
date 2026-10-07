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
  link.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
