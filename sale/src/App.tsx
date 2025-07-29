import React, { useState } from 'react';
import Header from './components/Header';
import SalesTable from './components/SalesTable';
import SalesForm from './components/SalesForm';
import SettingsPage from './components/SettingsPage';
import TargetsPage from './components/TargetsPage';
import { useSalesData } from './hooks/useSalesData';

function App() {
  const {
    currentYear,
    currentMonth,
    monthlyData,
    updateSalesData,
    getDailyData,
    hasData,
    changeMonth,
    forceReloadData,
    loadDemoData,
  } = useSalesData();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTargetsOpen, setIsTargetsOpen] = useState(false);

  const handleOpenForm = (date?: string) => {
    if (date) {
      setSelectedDate(date);
    } else {
      // 新規登録の場合、今日の日付を設定
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
      setSelectedDate(todayStr);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedDate('');
  };

  const handleSaveData = (formData: any) => {
    updateSalesData(selectedDate, formData);
  };

  const handleYearChange = (year: number) => {
    changeMonth(year, currentMonth);
  };

  const handleMonthChange = (month: number) => {
    changeMonth(currentYear, month);
  };

  const handleDataReload = () => {
    forceReloadData();
  };

  const handleLoadDemoData = () => {
    loadDemoData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        currentYear={currentYear}
        currentMonth={currentMonth}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
        onOpenForm={() => handleOpenForm()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDataReload={handleDataReload}
        onLoadDemoData={handleLoadDemoData}
        onOpenTargets={() => setIsTargetsOpen(true)}
      />
      
      <main className="max-w-7xl mx-auto px-6 py-6">
        <SalesTable
          dailyData={monthlyData.dailyData}
          hasData={hasData}
          onEditClick={handleOpenForm}
        />
      </main>

      <SalesForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveData}
        selectedDate={selectedDate}
        initialData={getDailyData(selectedDate)}
      />

      <SettingsPage
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <TargetsPage
        isOpen={isTargetsOpen}
        onClose={() => setIsTargetsOpen(false)}
      />
    </div>
  );
}

export default App;