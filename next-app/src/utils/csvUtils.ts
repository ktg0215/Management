// CSV生成・処理ユーティリティ

/**
 * CSV行をエスケープする
 */
export function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * CSV行を生成する
 */
export function createCsvRow(values: any[]): string {
  return values.map(escapeCsvValue).join(',');
}

/**
 * BOM付きUTF-8のBlobを作成する
 */
export function createCsvBlob(csvContent: string): Blob {
  // BOM (Byte Order Mark) を追加（Excel互換性のため）
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  return blob;
}

/**
 * CSVファイルをダウンロードする
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = createCsvBlob(csvContent);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 日付をYYYY-MM-DD形式に変換する
 */
export function formatDateForCsv(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * CSVの日付文字列をDateオブジェクトに変換する
 * YYYY-MM-DD または YYYY/MM/DD 形式に対応
 */
export function parseCsvDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  
  // YYYY-MM-DD形式
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]) - 1;
    const day = parseInt(isoMatch[3]);
    return new Date(year, month, day);
  }
  
  // YYYY/MM/DD形式
  const slashMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (slashMatch) {
    const year = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]) - 1;
    const day = parseInt(slashMatch[3]);
    return new Date(year, month, day);
  }
  
  // その他の形式を試す
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

