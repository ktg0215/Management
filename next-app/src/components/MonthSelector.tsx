import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface MonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onMonthChange,
}) => {
  const [year, month] = selectedMonth.split('-').map(Number);
  const [formattedMonth, setFormattedMonth] = useState('');

  const changeMonth = (delta: number) => {
    if (typeof window === 'undefined') return; // SSR対策
    const date = new Date(year, month - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    onMonthChange(newMonth);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') { // SSR対策
      const formatted = new Date(year, month - 1).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long'
      });
      setFormattedMonth(formatted);
    }
  }, [year, month]);

  return (
    <div className="flex items-center justify-center space-x-4 bg-white rounded-lg shadow-sm border p-4">
      <button
        onClick={() => changeMonth(-1)}
        className="p-2 rounded-md hover:bg-gray-100 transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>
      
      <div className="flex items-center space-x-2 min-w-[140px] justify-center">
        <Calendar className="w-5 h-5 text-blue-600" />
        <span className="text-lg font-medium text-gray-900">
          {formattedMonth}
        </span>
      </div>
      
      <button
        onClick={() => changeMonth(1)}
        className="p-2 rounded-md hover:bg-gray-100 transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  );
};