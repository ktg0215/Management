export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

export const getDayOfWeek = (year: number, month: number, day: number): string => {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const date = new Date(year, month - 1, day);
  return dayNames[date.getDay()];
};

export const formatDate = (year: number, month: number, day: number): string => {
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

export const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '';
  return num.toLocaleString();
};

export const isWeekend = (dayOfWeek: string): boolean => {
  return dayOfWeek === '土' || dayOfWeek === '日';
};

export const isSaturday = (dayOfWeek: string): boolean => {
  return dayOfWeek === '土';
};

export const isSunday = (dayOfWeek: string): boolean => {
  return dayOfWeek === '日';
};