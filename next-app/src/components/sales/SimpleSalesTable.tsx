import React, { useMemo, memo } from 'react';
import { Edit2 } from 'lucide-react';
import { formatNumber, isSaturday, isSunday } from '../../utils/salesUtils';

interface SimpleDailySalesData {
  date: string;
  dayOfWeek: string;
  revenue?: number;
  cost?: number;
  profit?: number;
}

interface SimpleSalesTableProps {
  dailyData: { [date: string]: SimpleDailySalesData };
  hasData: (date: string) => boolean;
  onEditClick: (date: string) => void;
  currentYear: number;
  currentMonth: number;
}

const SimpleSalesTable: React.FC<SimpleSalesTableProps> = memo(({
  dailyData,
  hasData,
  onEditClick,
  currentYear,
  currentMonth,
}) => {
  // Debug logging
  console.log('[SimpleSalesTable] Rendering with props:', {
    dailyDataKeys: Object.keys(dailyData || {}).length,
    sampleKeys: Object.keys(dailyData || {}).slice(0, 3),
    currentYear,
    currentMonth
  });

  // Memoize sorted dates to prevent unnecessary recalculation
  const sortedDates = useMemo(() => {
    const sorted = Object.keys(dailyData).sort();
    console.log('[SimpleSalesTable] Sorted dates count:', sorted.length);
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

  const formatValue = (value: any) => {
    if (value === undefined || value === null || value === '') return '-';
    return typeof value === 'number' ? formatNumber(value) : String(value);
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
        dateCellClass: getDateCellClassName(date, data?.dayOfWeek || '', index),
        dayOfWeekCellClass: getDayOfWeekCellClassName(date, data?.dayOfWeek || '', index),
        actionCellClass: getActionCellClassName(index)
      };
    });
  }, [sortedDates, dailyData]);

  return (
    <div className="bg-white border border-gray-200 overflow-hidden rounded-lg shadow">
      {/* Title */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-900">
          {currentYear}年{currentMonth}月の売上データ
        </h2>
        <div className="flex items-center space-x-4 mt-2 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-50 border border-blue-200"></div>
            <span className="text-gray-600">土曜日</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-50 border border-red-200"></div>
            <span className="text-gray-600">日曜・祝日</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-center font-medium text-gray-700 border-r border-gray-300">
                日
              </th>
              <th className="px-3 py-3 text-center font-medium text-gray-700 border-r border-gray-300">
                曜日
              </th>
              <th className="px-3 py-3 text-center font-medium text-gray-700 border-r border-gray-200">
                売上
              </th>
              <th className="px-3 py-3 text-center font-medium text-gray-700 border-r border-gray-200">
                原価
              </th>
              <th className="px-3 py-3 text-center font-medium text-gray-700 border-r border-gray-200">
                利益
              </th>
              <th className="px-2 py-3 text-center font-medium text-gray-700">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {memoizedCellData.map(({ date, data, day, index, dateCellClass, dayOfWeekCellClass, actionCellClass }) => (
              <tr key={date} className="hover:bg-gray-50">
                <td className={dateCellClass}>
                  {day}
                </td>
                <td className={dayOfWeekCellClass}>
                  {data?.dayOfWeek || ''}
                </td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)}>
                  {formatValue(data?.revenue)}
                </td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)}>
                  {formatValue(data?.cost)}
                </td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)}>
                  {formatValue(data?.profit)}
                </td>
                <td className={actionCellClass}>
                  <button
                    onClick={() => onEditClick(date)}
                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                    title="編集"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

SimpleSalesTable.displayName = 'SimpleSalesTable';

export { SimpleSalesTable };
