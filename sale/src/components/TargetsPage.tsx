import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Target, 
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronRight,
  Edit2,
  Calculator
} from 'lucide-react';
import { useTargets } from '../hooks/useTargets';
import { TargetFormData, DailyTarget, WeekdayTarget } from '../types/targets';
import { formatNumber, getDayOfWeek } from '../utils/dateUtils';

interface TargetsPageProps {
  isOpen: boolean;
  onClose: () => void;
}

const TargetsPage: React.FC<TargetsPageProps> = ({ isOpen, onClose }) => {
  const {
    currentYear,
    currentMonth,
    monthlyTargets,
    updateTargets,
    updateDailyTarget,
    hasTargets,
    changeMonth,
    defaultWeekdayTargets,
  } = useTargets();

  const [formData, setFormData] = useState<TargetFormData>({
    monthlyStoreNetSalesTarget: 0,
    useWeekdayTargets: false,
    weekdayTargets: defaultWeekdayTargets,
  });

  const [showDailyTargets, setShowDailyTargets] = useState(false);
  const [editingDaily, setEditingDaily] = useState<string | null>(null);
  const [dailyEditData, setDailyEditData] = useState<Partial<DailyTarget>>({});

  // Load existing targets into form
  useEffect(() => {
    if (monthlyTargets) {
      setFormData({
        monthlyStoreNetSalesTarget: monthlyTargets.monthlyStoreNetSalesTarget || 0,
        useWeekdayTargets: monthlyTargets.useWeekdayTargets || false,
        weekdayTargets: monthlyTargets.weekdayTargets || defaultWeekdayTargets,
      });
    }
  }, [monthlyTargets, defaultWeekdayTargets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTargets(formData);
    alert('目標を保存しました！');
  };

  const handleInputChange = (field: keyof TargetFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleWeekdayTargetChange = (weekday: keyof WeekdayTarget, value: number) => {
    setFormData(prev => ({
      ...prev,
      weekdayTargets: {
        ...prev.weekdayTargets,
        [weekday]: value,
      },
    }));
  };

  const handleYearChange = (year: number) => {
    changeMonth(year, currentMonth);
  };

  const handleMonthChange = (month: number) => {
    changeMonth(currentYear, month);
  };

  const handleDailyEdit = (date: string) => {
    const target = monthlyTargets.dailyTargets[date];
    setEditingDaily(date);
    setDailyEditData({
      storeNetSalesTarget: target?.storeNetSalesTarget || 0,
    });
  };

  const handleDailySave = () => {
    if (editingDaily) {
      updateDailyTarget(editingDaily, dailyEditData);
      setEditingDaily(null);
      setDailyEditData({});
    }
  };

  const handleDailyCancel = () => {
    setEditingDaily(null);
    setDailyEditData({});
  };

  if (!isOpen) return null;

  const currentDate = new Date();
  const years = Array.from(
    { length: 11 },
    (_, i) => currentDate.getFullYear() - 5 + i
  );
  
  const months = [
    { value: 1, label: '1月' },
    { value: 2, label: '2月' },
    { value: 3, label: '3月' },
    { value: 4, label: '4月' },
    { value: 5, label: '5月' },
    { value: 6, label: '6月' },
    { value: 7, label: '7月' },
    { value: 8, label: '8月' },
    { value: 9, label: '9月' },
    { value: 10, label: '10月' },
    { value: 11, label: '11月' },
    { value: 12, label: '12月' },
  ];

  const weekdayLabels = {
    monday: '月曜日',
    tuesday: '火曜日',
    wednesday: '水曜日',
    thursday: '木曜日',
    friday: '金曜日',
    saturday: '土曜日',
    sunday: '日曜日',
  };

  const sortedDates = Object.keys(monthlyTargets.dailyTargets).sort();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900">売上目標設定</h2>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Year Selector */}
              <div className="relative">
                <select
                  value={currentYear}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="appearance-none bg-white border border-gray-300 px-3 py-1.5 pr-8 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Month Selector */}
              <div className="relative">
                <select
                  value={currentMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  className="appearance-none bg-white border border-gray-300 px-3 py-1.5 pr-8 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Target Setting Method */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
              <div className="flex items-center space-x-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">目標設定方法</h3>
              </div>
              
              <div className="space-y-4">
                {/* Monthly Target Option */}
                <label className="flex items-start space-x-3 p-4 bg-white rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-50 transition-colors duration-200">
                  <input
                    type="radio"
                    name="targetMethod"
                    checked={!formData.useWeekdayTargets}
                    onChange={() => handleInputChange('useWeekdayTargets', false)}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-gray-900">月次目標で設定</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">月間の総売上目標を設定し、日数で均等に配分します</p>
                    <input
                      type="number"
                      value={formData.monthlyStoreNetSalesTarget}
                      onChange={(e) => handleInputChange('monthlyStoreNetSalesTarget', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="例: 15000000"
                      disabled={formData.useWeekdayTargets}
                    />
                  </div>
                </label>

                {/* Weekday Target Option */}
                <label className="flex items-start space-x-3 p-4 bg-white rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-50 transition-colors duration-200">
                  <input
                    type="radio"
                    name="targetMethod"
                    checked={formData.useWeekdayTargets}
                    onChange={() => handleInputChange('useWeekdayTargets', true)}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-gray-900">曜日別目標で設定</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">各曜日ごとに異なる売上目標を設定します</p>
                    
                    {formData.useWeekdayTargets && (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {Object.entries(weekdayLabels).map(([key, label]) => (
                          <div key={key} className="bg-gray-50 rounded p-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {label}
                            </label>
                            <input
                              type="number"
                              value={formData.weekdayTargets[key as keyof WeekdayTarget]}
                              onChange={(e) => handleWeekdayTargetChange(key as keyof WeekdayTarget, Number(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Daily Targets Section */}
            <div className="bg-gray-50 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setShowDailyTargets(!showDailyTargets)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="flex items-center space-x-2">
                  <Calculator className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">日次目標詳細</span>
                  <span className="text-sm text-gray-500">
                    ({sortedDates.filter(date => monthlyTargets.dailyTargets[date]?.storeNetSalesTarget).length}/{sortedDates.length} 日設定済み)
                  </span>
                </div>
                {showDailyTargets ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {showDailyTargets && (
                <div className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">日付</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">曜日</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700">店舗純売上目標</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sortedDates.map((date) => {
                          const target = monthlyTargets.dailyTargets[date];
                          const day = parseInt(date.split('-')[2]);
                          const dayOfWeek = getDayOfWeek(currentYear, currentMonth, day);
                          const isEditing = editingDaily === date;
                          
                          return (
                            <tr key={date} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">{day}日</td>
                              <td className="px-3 py-2">{dayOfWeek}曜日</td>
                              <td className="px-3 py-2 text-right">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={dailyEditData.storeNetSalesTarget || ''}
                                    onChange={(e) => setDailyEditData(prev => ({ ...prev, storeNetSalesTarget: Number(e.target.value) }))}
                                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                ) : (
                                  <span className="font-mono">
                                    {target?.storeNetSalesTarget ? `¥${formatNumber(target.storeNetSalesTarget)}` : '-'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={handleDailySave}
                                      className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                                    >
                                      <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleDailyCancel}
                                      className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDailyEdit(date)}
                                    className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-2 transition-colors duration-200"
              >
                <Save className="w-4 h-4" />
                <span>目標を保存</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TargetsPage;