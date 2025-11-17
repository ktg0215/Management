'use client';

import React, { useMemo, memo } from 'react';
import { Edit2 } from 'lucide-react';
import { SalesFieldConfig } from '@/types/sales-field-config';
import { formatNumber, isSaturday, isSunday } from '../../utils/salesUtils';

interface DynamicSalesTableProps {
  dailyData: { [date: string]: Record<string, any> };
  hasData: (date: string) => boolean;
  onEditClick: (date: string) => void;
  currentYear: number;
  currentMonth: number;
  fields: SalesFieldConfig[];
}

const DynamicSalesTable: React.FC<DynamicSalesTableProps> = memo(({
  dailyData,
  hasData,
  onEditClick,
  currentYear,
  currentMonth,
  fields,
}) => {
  // Debug logging
  console.log('[DynamicSalesTable] Rendering with props:', {
    dailyDataKeys: Object.keys(dailyData || {}).length,
    sampleKeys: Object.keys(dailyData || {}).slice(0, 3),
    currentYear,
    currentMonth,
    fieldsCount: fields.length
  });

  // Get visible fields
  const visibleFields = useMemo(() =>
    fields.filter(f => f.isVisible).sort((a, b) => a.order - b.order),
    [fields]
  );

  // Memoize sorted dates to prevent unnecessary recalculation
  const sortedDates = useMemo(() => {
    const sorted = Object.keys(dailyData).sort();
    console.log('[DynamicSalesTable] Sorted dates count:', sorted.length);
    return sorted;
  }, [dailyData]);

  const getCellClassName = (date: string, dayOfWeek: string, index: number) => {
    const baseClass = "px-3 py-2 text-right border-r border-gray-200";
    const isEvenRow = index % 2 === 0;

    if (isSaturday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-blue-50' : 'bg-blue-100'}`;
    } else if (isSunday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-red-50' : 'bg-red-100'}`;
    } else {
      return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
    }
  };

  const getDateCellClassName = (date: string, dayOfWeek: string, index: number) => {
    const baseClass = "px-3 py-2 text-center font-medium border-r border-gray-300";
    const isEvenRow = index % 2 === 0;

    if (isSaturday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-blue-50' : 'bg-blue-100'}`;
    } else if (isSunday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-red-50' : 'bg-red-100'}`;
    } else {
      return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
    }
  };

  const getDayOfWeekCellClassName = (date: string, dayOfWeek: string, index: number) => {
    const baseClass = "px-3 py-2 text-center font-medium border-r border-gray-300";
    const isEvenRow = index % 2 === 0;

    if (isSaturday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-blue-50' : 'bg-blue-100'} text-blue-700`;
    } else if (isSunday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-red-50' : 'bg-red-100'} text-red-700`;
    } else {
      return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
    }
  };

  const getActionCellClassName = (index: number) => {
    const baseClass = "px-2 py-2 text-center border-l border-gray-200";
    const isEvenRow = index % 2 === 0;
    return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
  };

  const formatValue = (value: any, field: SalesFieldConfig) => {
    if (value === undefined || value === null || value === '') return '-';

    if (field.type === 'currency' || field.type === 'number' || field.type === 'count') {
      return typeof value === 'number' ? formatNumber(value) : String(value);
    } else if (field.type === 'percentage') {
      return typeof value === 'number' ? `${value}%` : String(value);
    }

    return String(value);
  };

  // Memoize expensive cell className calculations
  const memoizedCellData = useMemo(() => {
    return sortedDates.map((date, index) => {
      const data = dailyData[date];
      const day = parseInt(date.split('-')[2]);
      return {
        date,
        data,
        day,
        index,
        dayOfWeek: data?.dayOfWeek || '',
        dateCellClass: getDateCellClassName(date, data?.dayOfWeek || '', index),
        dayOfWeekCellClass: getDayOfWeekCellClassName(date, data?.dayOfWeek || '', index),
        cellClass: getCellClassName(date, data?.dayOfWeek || '', index),
        actionCellClass: getActionCellClassName(index),
      };
    });
  }, [sortedDates, dailyData]);

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 w-20">
              日付
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 w-16">
              曜日
            </th>
            {visibleFields
              .filter(f => f.key !== 'date' && f.key !== 'dayOfWeek')
              .map(field => (
                <th key={field.id} className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                  <div className="flex items-center justify-end space-x-1">
                    <span>{field.label}</span>
                    {field.unit && <span className="text-gray-500">({field.unit})</span>}
                  </div>
                </th>
              ))}
            <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-l border-gray-200 w-20">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {memoizedCellData.length > 0 ? (
            memoizedCellData.map((cellData) => (
              <tr key={cellData.date} className="hover:bg-gray-100 transition-colors">
                <td className={cellData.dateCellClass}>{cellData.day}</td>
                <td className={cellData.dayOfWeekCellClass}>{cellData.dayOfWeek}</td>
                {visibleFields
                  .filter(f => f.key !== 'date' && f.key !== 'dayOfWeek')
                  .map(field => (
                    <td key={field.id} className={cellData.cellClass}>
                      {formatValue(cellData.data?.[field.key], field)}
                    </td>
                  ))}
                <td className={cellData.actionCellClass}>
                  <button
                    onClick={() => onEditClick(cellData.date)}
                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    title="編集"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={visibleFields.length + 1}
                className="px-6 py-12 text-center text-gray-500"
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <p className="text-lg font-medium">データがありません</p>
                  <p className="text-sm">上部の「新規登録」ボタンからデータを入力してください</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});

DynamicSalesTable.displayName = 'DynamicSalesTable';

export { DynamicSalesTable };
