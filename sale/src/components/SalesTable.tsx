import React from 'react';
import { Edit2 } from 'lucide-react';
import { DailySalesData } from '../types/sales';
import { formatNumber, isSaturday, isSunday } from '../utils/dateUtils';

interface SalesTableProps {
  dailyData: { [date: string]: DailySalesData };
  hasData: (date: string) => boolean;
  onEditClick: (date: string) => void;
}

const SalesTable: React.FC<SalesTableProps> = ({
  dailyData,
  hasData,
  onEditClick,
}) => {
  const sortedDates = Object.keys(dailyData).sort();

  const getCellClassName = (date: string, dayOfWeek: string, index: number) => {
    const baseClass = "px-1 py-2 text-center border-r border-gray-200 text-xs min-w-[50px]";
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
    const baseClass = "px-2 py-2 text-center font-medium border-r border-gray-300 sticky left-0 z-10 text-xs w-8";
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
    const baseClass = "px-2 py-2 text-center font-medium border-r border-gray-300 sticky left-8 z-10 text-xs w-8";
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
    const baseClass = "px-1 py-2 text-center sticky right-0 z-10 border-l border-gray-200";
    const isEvenRow = index % 2 === 0;
    return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
  };

  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      {/* Title */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-900">
          {new Date().getFullYear()}年{new Date().getMonth() + 1}月の売上データ
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

      <div className="overflow-x-auto">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-8" />
            <col className="w-20" />
            <col className="w-12" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-12" />
            <col className="w-20" />
            <col className="w-12" />
            <col className="w-12" />
            <col className="w-16" />
            <col className="w-12" />
            <col className="w-12" />
            <col className="w-16" />
            <col className="w-12" />
            <col className="w-12" />
          </colgroup>
          {/* Header */}
          <thead className="bg-gray-50">
            <tr>
              <th rowSpan={3} className="px-1 py-3 text-center font-medium text-gray-700 border-r border-gray-300 sticky left-0 z-20 bg-gray-50 text-xs">
                日
              </th>
              <th rowSpan={3} className="px-1 py-3 text-center font-medium text-gray-700 border-r border-gray-300 sticky left-8 z-20 bg-gray-50 text-xs">
                曜<br/>日
              </th>
              <th colSpan={6} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                売上詳細
              </th>
              <th colSpan={6} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                人件費・生産性
              </th>
              <th rowSpan={3} className="px-1 py-3 text-center font-medium text-gray-700 border-r border-gray-300 text-xs">
                VOID<br/>件数
              </th>
              <th rowSpan={3} className="px-1 py-3 text-center font-medium text-gray-700 sticky right-0 z-20 bg-gray-50 text-xs">
                操作
              </th>
            </tr>
            <tr>
              <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                店<br/>舗<br/>純<br/>売<br/>上
              </th>
              <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                目<br/>標<br/>比
              </th>
              <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                店<br/>舗<br/>純<br/>売<br/>上<br/>累<br/>計
              </th>
              <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                EDW
              </th>
              <th rowSpan={2} className="px-1 py-2 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                OHB<br/>純売<br/>上
              </th>
              <th colSpan={3} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                組数
              </th>
              <th colSpan={3} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                客数
              </th>
            </tr>
            <tr>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                純売<br/>上
              </th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                前年<br/>比
              </th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                計
              </th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                客<br/>数
              </th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                組<br/>単<br/>価
              </th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                社<br/>員<br/>時<br/>間
              </th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                AS<br/>時<br/>間
              </th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 text-xs">
                人<br/>時<br/>売<br/>上<br/>高
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedDates.map((date, index) => {
              const data = dailyData[date];
              const day = parseInt(date.split('-')[2]);
              
              return (
                <tr key={date} className="hover:bg-gray-50">
                  <td className={getDateCellClassName(date, data.dayOfWeek)}>
                    {day}
                  </td>
                  <td className={getDayOfWeekCellClassName(date, data.dayOfWeek)}>
                    {data.dayOfWeek}
                  </td>
                  {/* 売上詳細 */}
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {formatNumber(data.storeNetSales)}
                  </td>
                  <td className={getCellClassName(date, data.dayOfWeek, index)}>
                    -
                  </td>
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {formatNumber(data.storeNetSalesCumulative)}
                  </td>
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {formatNumber(data.edwNetSales)}
                  </td>
                  <td className={getCellClassName(date, data.dayOfWeek, index)}>
                    -
                  </td>
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {formatNumber(data.ohbNetSales)}
                  </td>
                  {/* 人件費・生産性 */}
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {formatNumber(data.totalGroups)}
                  </td>
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {formatNumber(data.totalCustomers)}
                  </td>
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {data.groupUnitPrice ? formatNumber(Math.round(data.groupUnitPrice)) : ''}
                  </td>
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {data.employeeHours ? data.employeeHours.toFixed(1) : ''}
                  </td>
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {data.asHours ? data.asHours.toFixed(1) : ''}
                  </td>
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {data.salesPerLaborHour ? formatNumber(Math.round(data.salesPerLaborHour)) : ''}
                  </td>
                  {/* その他 */}
                  <td className={`${getCellClassName(date, data.dayOfWeek, index)} text-right`}>
                    {formatNumber(data.voidCount)}
                  </td>
                  {/* 操作 */}
                  <td className={getActionCellClassName(index)}>
                    <button
                      onClick={() => onEditClick(date)}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors duration-200"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesTable;