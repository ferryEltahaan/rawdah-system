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

function escapeCsvCell(value: string | number | undefined | null): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][]
): void {
  const lines = [headers, ...rows].map(row => row.map(escapeCsvCell).join(','));
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
