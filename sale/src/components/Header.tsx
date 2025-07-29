import React from 'react';
import { ChevronDown, Plus, Settings, Database, Target } from 'lucide-react';

interface HeaderProps {
  currentYear: number;
  currentMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onOpenForm: () => void;
  onOpenSettings: () => void;
  onDataReload?: () => void;
  onLoadDemoData?: () => void;
  onOpenTargets?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  currentYear,
  currentMonth,
  onYearChange,
  onMonthChange,
  onOpenForm,
  onOpenSettings,
  onDataReload,
  onLoadDemoData,
  onOpenTargets,
}) => {
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

  const handleLoadDemoData = () => {
    if (onLoadDemoData) {
      onLoadDemoData();
      alert('デモデータを読み込みました！');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-medium text-gray-900">売上管理</h1>
          
          <div className="flex items-center space-x-3">
            {/* Year Selector */}
            <div className="relative">
              <select
                value={currentYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
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
                onChange={(e) => onMonthChange(Number(e.target.value))}
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

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenTargets}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2 rounded transition-colors duration-200"
            title="目標設定"
          >
            <Target className="w-4 h-4" />
          </button>
          <button
            onClick={handleLoadDemoData}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2 rounded transition-colors duration-200"
            title="デモデータ読み込み"
          >
            <Database className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2 rounded transition-colors duration-200"
            title="設定"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenForm}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-2 transition-colors duration-200 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>売上登録</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;