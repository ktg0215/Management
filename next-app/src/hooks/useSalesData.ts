import { useState, useEffect } from 'react';
import { MonthlyData, DailySalesData, EDWDailySalesData } from '../types/sales';
import { getDaysInMonth, getDayOfWeek, formatDate } from '../utils/salesUtils';
import { calculateDerivedValues, calculateCumulativeValues } from '../utils/salesCalculations';
import { generateDemoData, generateMultiMonthDemoData } from '../utils/salesDemoData';
import { EDW_SALES_FIELDS } from '../types/sales';
import { salesApi } from '../lib/api';

const STORAGE_KEY = 'salesData';

export const useSalesData = (storeId?: string) => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({
    year: currentYear,
    month: currentMonth,
    dailyData: {},
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load data from API
  const loadData = async (year: number, month: number, storeId?: string) => {
    if (!storeId) {
      // 店舗が選択されていない場合は空のデータを設定
      const daysInMonth = getDaysInMonth(year, month);
      const dailyData: { [date: string]: DailySalesData } = {};
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = formatDate(year, month, day);
        const dayOfWeek = getDayOfWeek(year, month, day);
        // EDW_SALES_FIELDSの全項目で初期化
        const edwBase: any = {};
        EDW_SALES_FIELDS.forEach(field => {
          edwBase[field.key] = undefined;
        });
        edwBase['date'] = dateKey;
        edwBase['dayOfWeek'] = dayOfWeek;
        dailyData[dateKey] = edwBase;
      }
      
      setMonthlyData({
        year,
        month,
        dailyData,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await salesApi.getSales(year, month, storeId);
      
      if (response.success && response.data) {
        // DBから取得したデータを設定
        const dbData = response.data;
        setMonthlyData({
          year: dbData.year,
          month: dbData.month,
          dailyData: dbData.daily_data || {},
        });
      } else {
        // データが存在しない場合は空のデータを初期化
        const daysInMonth = getDaysInMonth(year, month);
        const dailyData: { [date: string]: DailySalesData } = {};
        
        for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = formatDate(year, month, day);
          const dayOfWeek = getDayOfWeek(year, month, day);
          // EDW_SALES_FIELDSの全項目で初期化
          const edwBase: any = {};
          EDW_SALES_FIELDS.forEach(field => {
            edwBase[field.key] = undefined;
          });
          edwBase['date'] = dateKey;
          edwBase['dayOfWeek'] = dayOfWeek;
          dailyData[dateKey] = edwBase;
        }
        
        setMonthlyData({
          year,
          month,
          dailyData,
        });
      }
    } catch (error) {
      console.error('売上データ取得エラー:', error);
      // エラーの場合は空のデータを設定
      const daysInMonth = getDaysInMonth(year, month);
      const dailyData: { [date: string]: DailySalesData } = {};
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = formatDate(year, month, day);
        const dayOfWeek = getDayOfWeek(year, month, day);
        const edwBase: any = {};
        EDW_SALES_FIELDS.forEach(field => {
          edwBase[field.key] = undefined;
        });
        edwBase['date'] = dateKey;
        edwBase['dayOfWeek'] = dayOfWeek;
        dailyData[dateKey] = edwBase;
      }
      
      setMonthlyData({
        year,
        month,
        dailyData,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Force reload data from API
  const forceReloadData = () => {
    loadData(currentYear, currentMonth, storeId);
  };

  // Save data to API
  const saveData = async (data: MonthlyData, storeId?: string) => {
    if (!storeId) return;

    try {
      const response = await salesApi.saveSales(data.year, data.month, storeId, data.dailyData);
      
      if (response.success) {
        console.log('売上データがDBに保存されました:', {
          year: data.year,
          month: data.month,
          storeId,
          dataCount: Object.keys(data.dailyData).length
        });
      } else {
        console.error('売上データ保存エラー:', response.error);
      }
    } catch (error) {
      console.error('売上データ保存エラー:', error);
    }
  };

  // Load demo data
  const loadDemoData = async () => {
    if (!storeId) return;

    setIsLoading(true);
    try {
      // 現在の月のデモデータを生成
      const demoData = generateDemoData(currentYear, currentMonth);
      setMonthlyData(demoData);
      await saveData(demoData, storeId);
      
      // 過去3ヶ月分のデモデータも生成してDBに保存
      const multiMonthData = generateMultiMonthDemoData(currentYear, currentMonth - 2, 3);
      
      // 各月のデータをDBに保存
      for (const [key, monthlyData] of Object.entries(multiMonthData)) {
        await saveData(monthlyData, storeId);
      }
      
      console.log('デモデータがDBに生成されました:', {
        currentMonth: `${currentYear}年${currentMonth}月`,
        generatedMonths: Object.keys(multiMonthData).length,
        storeId
      });
    } catch (error) {
      console.error('デモデータ生成エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update sales data for a specific date
  const updateSalesData = async (date: string, formData: EDWDailySalesData) => {
    if (!storeId) return;

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
    await saveData(newMonthlyData, storeId);
  };

  // Get data for a specific date
  const getDailyData = (date: string): EDWDailySalesData | undefined => {
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

  // Load data when year/month or storeId changes
  useEffect(() => {
    loadData(currentYear, currentMonth, storeId);
  }, [currentYear, currentMonth, storeId]);

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
    isLoading,
  };
}; 