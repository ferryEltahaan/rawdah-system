export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Headers for real CSV attachment response
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const headers = ['التاريخ والوقت (Asia/Riyadh)', 'الموظف', 'نوع العملية', 'التفاصيل'];
  
  const sampleRows = [
    ['2026-10-08 08:00', 'المدير العام', 'تهيئة النظام', 'النظام يعمل بشكل صحيح'],
    ['2026-10-08 08:30', 'موظف المبيعات', 'إنشاء طلب جديد', 'طلب رقم #1001 للعميل أحمد محمد السعيد'],
    ['2026-10-08 09:15', 'مسؤول المخزون والتصاريح', 'رفع تصاريح', 'رفع 5 تصاريح للفترة الصباحية']
  ];

  const escapeCell = (str: string) => {
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...sampleRows.map(row => row.map(escapeCell).join(','))
  ];

  // UTF-8 BOM for Arabic text support in Excel
  const csvContent = '\uFEFF' + lines.join('\r\n');
  return res.status(200).send(csvContent);
}
