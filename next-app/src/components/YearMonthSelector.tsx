"use client";

import React from 'react';
import { Calendar } from 'lucide-react';

interface YearMonthSelectorProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  minYear?: number;
  maxYear?: number;
}

export default function YearMonthSelector({
  year,
  month,
  onYearChange,
  onMonthChange,
  minYear = 2020,
  maxYear = 2030
}: YearMonthSelectorProps) {
  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => minYear + i
  );

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-indigo-600" />
        <select
          className="px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 text-sm"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button
            key={m}
            onClick={() => onMonthChange(m)}
            className={`
              px-2.5 py-1 text-xs font-medium rounded transition-all
              ${month === m
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {m}月
          </button>
        ))}
      </div>
    </div>
  );
}
