import React, { useMemo, memo } from 'react';
import { Edit2 } from 'lucide-react';
import { DailySalesData, EDW_SALES_FIELDS } from '../../types/sales';
import { formatNumber, isSaturday, isSunday } from '../../utils/salesUtils';

interface SalesTableProps {
  dailyData: { [date: string]: DailySalesData };
  hasData: (date: string) => boolean;
  onEditClick: (date: string) => void;
  currentYear: number;
  currentMonth: number;
}

const SalesTable: React.FC<SalesTableProps> = memo(({
  dailyData,
  hasData,
  onEditClick,
  currentYear,
  currentMonth,
}) => {
  // Memoize sorted dates to prevent unnecessary recalculation
  const sortedDates = useMemo(() => 
    Object.keys(dailyData).sort(), 
    [dailyData]
  );

  const getCellClassName = (date: string, dayOfWeek: string, index: number) => {
    const baseClass = "px-2 py-2 text-center border-r border-gray-200 text-xs min-w-[80px]";
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
    const baseClass = "px-3 py-2 text-center font-medium border-r border-gray-300 sticky left-0 z-10 text-xs w-12";
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
    const baseClass = "px-3 py-2 text-center font-medium border-r border-gray-300 sticky left-12 z-10 text-xs w-12";
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
    const baseClass = "px-2 py-2 text-center sticky right-0 z-10 border-l border-gray-200";
    const isEvenRow = index % 2 === 0;
    return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
  };

  const formatValue = (value: any, field: any) => {
    if (value === undefined || value === null || value === '') return '-';
    
    if (field.type === 'auto') {
      // 自動計算項目は数値として表示
      return typeof value === 'number' ? formatNumber(value) : String(value);
    } else {
      // 手動項目はそのまま表示
      return typeof value === 'number' ? formatNumber(value) : String(value);
    }
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
        dateCellClass: getDateCellClassName(date, data.dayOfWeek, index),
        dayOfWeekCellClass: getDayOfWeekCellClassName(date, data.dayOfWeek, index),
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
        <div className="flex items-center space-x-4 mt-2 text-xs">
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

      <div className="overflow-x-auto max-w-none">
        <table className="w-full text-xs min-w-[2000px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-center font-medium text-gray-700 border-r border-gray-300 sticky left-0 z-20 bg-gray-50 text-xs min-w-[48px]">
                日
              </th>
              <th className="px-3 py-3 text-center font-medium text-gray-700 border-r border-gray-300 sticky left-12 z-20 bg-gray-50 text-xs min-w-[48px]">
                曜日
              </th>
              {EDW_SALES_FIELDS.map((field) => (
                <th key={field.key} className="px-2 py-3 text-center font-medium text-gray-700 border-r border-gray-200 text-xs min-w-[90px]">
                  <div className="text-xs leading-tight">
                    {field.label}
                    {field.type === 'auto' && (
                      <div className="text-xs text-blue-600 font-normal">自動</div>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-2 py-3 text-center font-medium text-gray-700 sticky right-0 z-20 bg-gray-50 text-xs min-w-[48px]">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {memoizedCellData.map(({ date, data, day, index, dateCellClass, dayOfWeekCellClass, actionCellClass }) => (
                <TableRow
                  key={date}
                  date={date}
                  data={data}
                  day={day}
                  index={index}
                  dateCellClass={dateCellClass}
                  dayOfWeekCellClass={dayOfWeekCellClass}
                  actionCellClass={actionCellClass}
                  onEditClick={onEditClick}
                  getCellClassName={getCellClassName}
                  formatValue={formatValue}
                />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// Memoized table row component to prevent unnecessary re-renders
const TableRow = memo<{
  date: string;
  data: any;
  day: number;
  index: number;
  dateCellClass: string;
  dayOfWeekCellClass: string;
  actionCellClass: string;
  onEditClick: (date: string) => void;
  getCellClassName: (date: string, dayOfWeek: string, index: number) => string;
  formatValue: (value: any, field: any) => string;
}>(({ date, data, day, index, dateCellClass, dayOfWeekCellClass, actionCellClass, onEditClick, getCellClassName, formatValue }) => (
  <tr className="hover:bg-gray-50">
    <td className={dateCellClass}>
      {day}
    </td>
    <td className={dayOfWeekCellClass}>
      {data.dayOfWeek}
    </td>
    {EDW_SALES_FIELDS.map((field) => (
      <td key={field.key} className={`${getCellClassName(date, data.dayOfWeek, index)} ${field.type === 'auto' ? 'bg-blue-50' : ''}`}>
        {formatValue((data as any)[field.key], field)}
      </td>
    ))}
    <td className={actionCellClass}>
      <button
        onClick={() => onEditClick(date)}
        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
      >
        <Edit2 className="h-3 w-3" />
      </button>
    </td>
  </tr>
));

export { SalesTable };