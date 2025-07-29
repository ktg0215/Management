import { useState, useEffect } from 'react';
import { MonthlyData, DailySalesData, SalesFormData } from '../types/sales';
import { getDaysInMonth, getDayOfWeek, formatDate } from '../utils/dateUtils';
import { calculateDerivedValues, calculateCumulativeValues } from '../utils/calculations';
import { generateDemoData } from '../utils/demoData';

const STORAGE_KEY = 'salesData';

export const useSalesData = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({
    year: currentYear,
    month: currentMonth,
    dailyData: {},
  });

  // Load data from localStorage
  const loadData = (year: number, month: number) => {
    const key = `${STORAGE_KEY}_${year}_${month}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      const parsedData = JSON.parse(stored);
      setMonthlyData(parsedData);
    } else {
      // Initialize empty month data
      const daysInMonth = getDaysInMonth(year, month);
      const dailyData: { [date: string]: DailySalesData } = {};
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = formatDate(year, month, day);
        const dayOfWeek = getDayOfWeek(year, month, day);
        
        dailyData[dateKey] = {
          date: dateKey,
          dayOfWeek,
        };
      }
      
      setMonthlyData({
        year,
        month,
        dailyData,
      });
    }
  };

  // Force reload data from localStorage
  const forceReloadData = () => {
    loadData(currentYear, currentMonth);
  };

  // Save data to localStorage
  const saveData = (data: MonthlyData) => {
    const key = `${STORAGE_KEY}_${data.year}_${data.month}`;
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Load demo data
  const loadDemoData = () => {
    const demoData = generateDemoData(currentYear, currentMonth);
    setMonthlyData(demoData);
    saveData(demoData);
    
    // Also generate previous month data
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevMonthData = generateDemoData(prevYear, prevMonth);
    const prevKey = `${STORAGE_KEY}_${prevYear}_${prevMonth}`;
    localStorage.setItem(prevKey, JSON.stringify(prevMonthData));
  };

  // Update sales data for a specific date
  const updateSalesData = (date: string, formData: SalesFormData) => {
    const currentData = monthlyData.dailyData[date] || { date, dayOfWeek: '' };
    
    // Calculate derived values
    const updatedData = calculateDerivedValues({
      ...currentData,
      ...formData,
    });

    // Update the daily data
    const newDailyData = {
      ...monthlyData.dailyData,
      [date]: updatedData,
    };

    // Calculate cumulative values
    const dailyDataWithCumulatives = calculateCumulativeValues(
      newDailyData,
      currentYear,
      currentMonth
    );

    const newMonthlyData = {
      ...monthlyData,
      dailyData: dailyDataWithCumulatives,
    };

    setMonthlyData(newMonthlyData);
    saveData(newMonthlyData);
  };

  // Get data for a specific date
  const getDailyData = (date: string): DailySalesData | undefined => {
    return monthlyData.dailyData[date];
  };

  // Check if data exists for a date
  const hasData = (date: string): boolean => {
    const data = monthlyData.dailyData[date];
    return !!(data && data.storeNetSales !== undefined);
  };

  // Change year/month
  const changeMonth = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // Load data when year/month changes
  useEffect(() => {
    loadData(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  return {
    currentYear,
    currentMonth,
    monthlyData,
    updateSalesData,
    getDailyData,
    hasData,
    changeMonth,
    forceReloadData,
    loadDemoData,
  };
};