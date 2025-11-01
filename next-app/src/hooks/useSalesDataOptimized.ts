import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MonthlyData, DailySalesData, EDWDailySalesData } from '../types/sales';
import { getDaysInMonth, getDayOfWeek, formatDate } from '../utils/salesUtils';
import { calculateDerivedValues, calculateCumulativeValues } from '../utils/salesCalculations';
import { generateDemoData, generateMultiMonthDemoData } from '../utils/salesDemoData';
import { EDW_SALES_FIELDS } from '../types/sales';
import { salesApi } from '../lib/api';

const STORAGE_KEY = 'salesData';

// Optimized version of useSalesData with performance improvements
export const useSalesDataOptimized = (storeId?: string) => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({
    year: currentYear,
    month: currentMonth,
    dailyData: {},
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // Performance optimization refs
  const loadingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const lastRequestRef = useRef<string>('');

  // Debounced loading state to prevent flashing
  const setLoadingDebounced = useCallback((loading: boolean) => {
    if (loading) {
      setIsLoading(true);
    } else {
      // Delay hiding loading state to prevent flashing
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
      }, 200);
    }
  }, []);

  // Memoize expensive calculations
  const calculationFunctions = useMemo(() => ({
    calculateDerivedValues,
    calculateCumulativeValues
  }), []);

  // 初期EDWデータ生成をメモ化
  const createEmptyEDWData = useCallback((dateKey: string, dayOfWeek: string): Partial<EDWDailySalesData> => {
    const edwBase: Partial<EDWDailySalesData> = {};
    EDW_SALES_FIELDS.forEach(field => {
      (edwBase as any)[field.key] = undefined;
    });
    edwBase['date'] = dateKey;
    edwBase['dayOfWeek'] = dayOfWeek;
    return edwBase;
  }, []);

  // Load data from API with request deduplication and cancellation
  const loadData = useCallback(async (year: number, month: number, storeId?: string) => {
    // Request deduplication
    const requestKey = `${year}-${month}-${storeId || 'none'}`;
    if (lastRequestRef.current === requestKey) {
      return;
    }
    lastRequestRef.current = requestKey;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (!storeId) {
      // 店舗が選択されていない場合は空のデータを設定
      const daysInMonth = getDaysInMonth(year, month);
      const dailyData: { [date: string]: DailySalesData } = {};
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = formatDate(year, month, day);
        const dayOfWeek = getDayOfWeek(year, month, day);
        dailyData[dateKey] = createEmptyEDWData(dateKey, dayOfWeek);
      }
      
      setMonthlyData({
        year,
        month,
        dailyData,
      });
      return;
    }

    setLoadingDebounced(true);
    try {
      const response = await salesApi.getSales(year, month, storeId);
      
      // Check if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
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
          dailyData[dateKey] = createEmptyEDWData(dateKey, dayOfWeek);
        }
        
        setMonthlyData({
          year,
          month,
          dailyData,
        });
      }
    } catch (error) {
      // Don't log errors for cancelled requests
      if (!abortControllerRef.current?.signal.aborted) {
        console.error('売上データ取得エラー:', error);
        // エラーの場合は空のデータを設定
        const daysInMonth = getDaysInMonth(year, month);
        const dailyData: { [date: string]: DailySalesData } = {};
        
        for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = formatDate(year, month, day);
          const dayOfWeek = getDayOfWeek(year, month, day);
          dailyData[dateKey] = createEmptyEDWData(dateKey, dayOfWeek);
        }
        
        setMonthlyData({
          year,
          month,
          dailyData,
        });
      }
    } finally {
      setLoadingDebounced(false);
      abortControllerRef.current = undefined;
    }
  }, [createEmptyEDWData, setLoadingDebounced]);

  // Force reload data from API
  const forceReloadData = useCallback(() => {
    lastRequestRef.current = ''; // Reset request cache
    loadData(currentYear, currentMonth, storeId);
  }, [loadData, currentYear, currentMonth, storeId]);

  // Save data to API with optimistic updates
  const saveData = useCallback(async (data: MonthlyData, storeId?: string) => {
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
  }, []);

  // Load demo data
  const loadDemoData = useCallback(async () => {
    if (!storeId) return;

    setLoadingDebounced(true);
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
      setLoadingDebounced(false);
    }
  }, [currentYear, currentMonth, storeId, saveData, setLoadingDebounced]);

  // Update sales data for a specific date with optimistic updates
  const updateSalesData = useCallback(async (date: string, formData: EDWDailySalesData) => {
    if (!storeId) return;

    const currentData = monthlyData.dailyData[date] || { date, dayOfWeek: '' };
    
    // Calculate derived values using memoized functions
    const updatedData = calculationFunctions.calculateDerivedValues({
      ...currentData,
      ...formData,
    });

    // Update the daily data
    const newDailyData = {
      ...monthlyData.dailyData,
      [date]: updatedData,
    };

    // Calculate cumulative values using memoized functions
    const dailyDataWithCumulatives = calculationFunctions.calculateCumulativeValues(
      newDailyData,
      currentYear,
      currentMonth
    );

    const newMonthlyData = {
      ...monthlyData,
      dailyData: dailyDataWithCumulatives,
    };

    // Optimistic update - update UI immediately
    setMonthlyData(newMonthlyData);
    
    // Save to API in background
    try {
      await saveData(newMonthlyData, storeId);
    } catch (error) {
      // On error, revert the optimistic update
      console.error('保存エラー、データを元に戻します:', error);
      forceReloadData();
    }
  }, [monthlyData, currentYear, currentMonth, storeId, saveData, calculationFunctions, forceReloadData]);

  // Memoized helper functions
  const getDailyData = useCallback((date: string): EDWDailySalesData | undefined => {
    return monthlyData.dailyData[date];
  }, [monthlyData.dailyData]);

  const hasData = useCallback((date: string): boolean => {
    const data = monthlyData.dailyData[date];
    return !!(data && data.storeNetSales !== undefined);
  }, [monthlyData.dailyData]);

  const changeMonth = useCallback((year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load data when year/month or storeId changes with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData(currentYear, currentMonth, storeId);
    }, 100); // Small debounce to prevent rapid API calls

    return () => clearTimeout(timeoutId);
  }, [currentYear, currentMonth, storeId, loadData]);

  // メモ化された返り値
  const returnValue = useMemo(() => ({
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
  }), [
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
  ]);

  return returnValue;
};