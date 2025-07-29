export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

export const getDayOfWeek = (year: number, month: number, day: number): string => {
  const date = new Date(year, month - 1, day);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return dayNames[date.getDay()];
};

export const formatDate = (year: number, month: number, day: number): string => {
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

export const formatNumber = (value?: number): string => {
  if (value === undefined || value === null) return '';
  return value.toLocaleString();
};

export const isSaturday = (dayOfWeek: string): boolean => {
  return dayOfWeek === '土';
};

export const isSunday = (dayOfWeek: string): boolean => {
  return dayOfWeek === '日';
}; 