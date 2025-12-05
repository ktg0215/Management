import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { salesApi } from '@/lib/api';
import { MonthlyData, EDWDailySalesData } from '@/types/sales';
import { calculateDerivedValues, calculateCumulativeValues } from '@/utils/salesCalculations';
import { getDaysInMonth, getDayOfWeek, formatDate } from '@/utils/salesUtils';
import { EDW_SALES_FIELDS } from '@/types/sales';

// Hook for fetching monthly sales data with intelligent caching
export const useSalesData = (storeId: string | undefined, year: number, month: number) => {
  const result = useQuery({
    queryKey: queryKeys.sales.byMonth(storeId || '', year, month),
    queryFn: async () => {
      if (!storeId) {
        // Return empty data structure when no store is selected
        return createEmptyMonthlyData(year, month);
      }
      
      const response = await salesApi.getSales(year, month, storeId);
      
      // 天気データの確認
      const firstKeyValue = response.data?.daily_data ? (() => {
        const keys = Object.keys(response.data.daily_data);
        if (keys.length > 0) {
          const firstValue = response.data.daily_data[keys[0]];
          return {
            key: keys[0],
            weather: firstValue?.weather,
            temperature: firstValue?.temperature,
            event: firstValue?.event,
            hasWeather: !!firstValue?.weather,
            hasTemperature: firstValue?.temperature !== null && firstValue?.temperature !== undefined
          };
        }
        return null;
      })() : null;
      
      console.log(`[useSalesData] API response for ${year}/${month}:`, JSON.stringify({
        success: response.success,
        hasData: !!response.data,
        hasDailyData: !!response.data?.daily_data,
        dailyDataType: typeof response.data?.daily_data,
        dailyDataKeys: response.data?.daily_data ? Object.keys(response.data.daily_data).length : 0,
        sampleKeys: response.data?.daily_data ? Object.keys(response.data.daily_data).slice(0, 5) : [],
        firstKeyValue
      }, null, 2));
      
      if (response.success && response.data) {
        // Check if daily_data exists and is not null/undefined
        if (!response.data.daily_data) {
          console.warn(`[useSalesData] No daily_data in response for ${year}/${month}:`, JSON.stringify(response.data, null, 2));
          return createEmptyMonthlyData(year, month);
        }

        let dailyDataRaw;
        try {
          dailyDataRaw = typeof response.data.daily_data === "string"
            ? JSON.parse(response.data.daily_data)
            : (response.data.daily_data || {});
        } catch (parseError) {
          console.error(`[useSalesData] Failed to parse daily_data for ${year}/${month}:`, parseError);
          console.error(`[useSalesData] daily_data type: ${typeof response.data.daily_data}`, response.data.daily_data);
          return createEmptyMonthlyData(year, month);
        }

        // Check if dailyDataRaw is empty or invalid
        if (!dailyDataRaw || typeof dailyDataRaw !== 'object' || Array.isArray(dailyDataRaw)) {
          console.warn(`[useSalesData] dailyDataRaw is invalid for ${year}/${month}:`, {
            type: typeof dailyDataRaw,
            isArray: Array.isArray(dailyDataRaw),
            value: dailyDataRaw
          });
          return createEmptyMonthlyData(year, month);
        }

        const rawKeys = Object.keys(dailyDataRaw);
        if (rawKeys.length === 0) {
          console.warn(`[useSalesData] dailyDataRaw is empty for ${year}/${month}`);
          return createEmptyMonthlyData(year, month);
        }

        console.log(`[useSalesData] dailyDataRaw after parsing:`, JSON.stringify({
          type: typeof dailyDataRaw,
          keysCount: Object.keys(dailyDataRaw).length,
          sampleKeys: Object.keys(dailyDataRaw).slice(0, 5),
          firstValue: Object.keys(dailyDataRaw).length > 0 ? dailyDataRaw[Object.keys(dailyDataRaw)[0]] : null
        }, null, 2));

        const transformedDailyData: Record<string, any> = {};
        let skippedCount = 0;
        let processedCount = 0;
        
        for (const dayStr in dailyDataRaw) {
          // Skip null/undefined values
          if (dailyDataRaw[dayStr] == null) {
            skippedCount++;
            continue;
          }
          
          // Ensure dayData is an object
          const dayData = dailyDataRaw[dayStr];
          if (typeof dayData !== 'object' || Array.isArray(dayData)) {
            console.warn(`[useSalesData] Invalid day data type for day ${dayStr} in ${year}/${month}:`, typeof dayData);
            skippedCount++;
            continue;
          }
          
          // 日付キーが日付文字列形式（YYYY-MM-DD）か数値形式かを判定
          let dateKey: string;
          let day: number;
          
          if (dayStr.includes('-')) {
            // YYYY-MM-DD形式の場合
            const dateMatch = dayStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateMatch) {
              const [, keyYear, keyMonth, keyDay] = dateMatch;
              // 年月が一致するか確認
              if (parseInt(keyYear) === year && parseInt(keyMonth) === month) {
                dateKey = dayStr;
                day = parseInt(keyDay);
              } else {
                console.warn(`[useSalesData] Date key ${dayStr} does not match year/month ${year}/${month}`);
                skippedCount++;
                continue;
              }
            } else {
              console.warn(`[useSalesData] Invalid date format: ${dayStr}`);
              skippedCount++;
              continue;
            }
          } else {
            // 数値形式（1-31）の場合
            day = parseInt(dayStr);
            if (isNaN(day) || day < 1 || day > 31) {
              console.warn(`[useSalesData] Invalid day key: ${dayStr} for ${year}/${month}`);
              skippedCount++;
              continue;
            }
            
            // Validate date is within the month's range
            const daysInMonth = getDaysInMonth(year, month);
            if (day > daysInMonth) {
              console.warn(`[useSalesData] Day ${day} exceeds days in month (${daysInMonth}) for ${year}/${month}`);
              skippedCount++;
              continue;
            }
            
            dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          }
          
          // 天気データを明示的に保持（APIから取得したデータをそのまま使用）
          // dayDataに既に含まれている場合はそのまま、含まれていない場合はundefined
          // 空文字列も有効な値として扱う
          const weather = dayData.weather !== undefined ? dayData.weather : undefined;
          const temperature = dayData.temperature !== undefined ? dayData.temperature : undefined;
          const event = dayData.event !== undefined ? dayData.event : undefined;
          
          // is_predictedフラグを明示的に処理（true, 'true', 1などの場合にtrueに設定）
          const isPredicted = dayData.is_predicted === true || dayData.is_predicted === 'true' || dayData.is_predicted === 1;
          
          transformedDailyData[dateKey] = {
            ...dayData,
            date: dateKey,
            dayOfWeek: getDayOfWeek(year, month, day),
            weather,
            temperature,
            event,
            is_predicted: isPredicted  // 予測フラグを保持
          };
          
          // デバッグ: 最初の3日分の天気データをログ出力
          if (processedCount < 3) {
            console.log(`[useSalesData] Day ${dayStr} (${dateKey}):`, {
              hasWeather: weather !== undefined,
              weather: weather,
              weatherType: typeof weather,
              hasTemperature: temperature !== undefined,
              temperature: temperature,
              hasEvent: event !== undefined,
              is_predicted_raw: dayData.is_predicted,
              is_predicted_type: typeof dayData.is_predicted,
              is_predicted_final: isPredicted,
              event: event,
              is_predicted: dayData.is_predicted,
              dayDataKeys: Object.keys(dayData),
              dayDataWeather: dayData.weather,
              dayDataTemperature: dayData.temperature,
              netSales: dayData.netSales,
              edwNetSales: dayData.edwNetSales,
              ohbNetSales: dayData.ohbNetSales
            });
          }
          
          processedCount++;
        }
        
        if (skippedCount > 0) {
          console.warn(`[useSalesData] Skipped ${skippedCount} invalid entries for ${year}/${month}, processed ${processedCount}`);
        }
        
        if (processedCount === 0) {
          console.warn(`[useSalesData] No valid data processed for ${year}/${month}, returning empty data`);
          return createEmptyMonthlyData(year, month);
        }
        
        // 天気データの確認
        const sampleEntry = Object.keys(transformedDailyData).length > 0 
          ? transformedDailyData[Object.keys(transformedDailyData)[0]] 
          : null;
        
        console.log(`[useSalesData] transformedDailyData:`, JSON.stringify({
          keysCount: Object.keys(transformedDailyData).length,
          sampleKeys: Object.keys(transformedDailyData).slice(0, 5),
          skippedCount,
          firstEntry: sampleEntry ? {
            key: Object.keys(transformedDailyData)[0],
            weather: sampleEntry.weather,
            temperature: sampleEntry.temperature,
            event: sampleEntry.event,
            hasWeather: !!sampleEntry.weather,
            hasTemperature: sampleEntry.temperature !== null && sampleEntry.temperature !== undefined
          } : null
        }, null, 2));

        return {
          year: response.data.year,
          month: response.data.month,
          dailyData: transformedDailyData,
        } as MonthlyData;
      } else {
        // Log why data is not available
        console.warn(`[useSalesData] No data available for ${year}/${month}:`, {
          success: response.success,
          hasData: !!response.data,
          response: response
        });
        // Return empty data structure when no data exists
        return createEmptyMonthlyData(year, month);
      }
    },
    enabled: !!storeId, // Only run query when storeId exists
    staleTime: 2 * 60 * 1000, // 2 minutes - sales data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes for active queries
    // 初回ロード時もisLoadingをtrueにするため、placeholderDataを設定しない
    placeholderData: undefined,
  });

  // Debug logging with detailed information (using JSON.stringify for better visibility)
  const logData = {
    storeId,
    year,
    month,
    isLoading: result.isLoading || result.isFetching,
    isError: result.isError,
    error: result.error ? String(result.error) : null,
    dataExists: !!result.data,
    dailyDataKeys: result.data?.dailyData ? Object.keys(result.data.dailyData).length : 0,
    sampleKeys: result.data?.dailyData ? Object.keys(result.data.dailyData).slice(0, 5) : [],
    dailyDataSample: result.data?.dailyData ? Object.keys(result.data.dailyData).slice(0, 3).map(key => ({
      key,
      hasNetSales: !!(result.data!.dailyData[key] as any)?.netSales
    })) : []
  };
  
  console.log(`[useSalesData] Query Result for ${year}/${month}:`, JSON.stringify(logData, null, 2));

  return result;
};

// Optimistic mutation hook for updating sales data
export const useSalesDataMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      storeId,
      year,
      month,
      date,
      formData,
    }: {
      storeId: string;
      year: number;
      month: number;
      date: string;
      formData: EDWDailySalesData;
    }) => {
      // Calculate derived values before saving
      const updatedData = calculateDerivedValues(formData);
      
      // Save to API
      const response = await salesApi.saveDailySales(year, month, storeId, date, updatedData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to save sales data');
      }
      
      return { date, data: updatedData };
    },
    
    // Optimistic update
    onMutate: async ({ storeId, year, month, date, formData }) => {
      const queryKey = queryKeys.sales.byMonth(storeId, year, month);
      
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<MonthlyData>(queryKey);
      
      if (previousData) {
        // Calculate derived values for optimistic update
        const currentData = previousData.dailyData[date] || { date, dayOfWeek: '' };
        const updatedData = calculateDerivedValues({
          ...currentData,
          ...formData,
        });
        
        // Update the daily data optimistically
        const newDailyData = {
          ...previousData.dailyData,
          [date]: updatedData,
        };
        
        // Calculate cumulative values
        const dailyDataWithCumulatives = calculateCumulativeValues(
          newDailyData,
          year,
          month
        );
        
        const optimisticData: MonthlyData = {
          ...previousData,
          dailyData: dailyDataWithCumulatives,
        };
        
        // Optimistically update to the new value
        queryClient.setQueryData(queryKey, optimisticData);
      }
      
      // Return a context object with the snapshotted value
      return { previousData, queryKey };
    },
    
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    
    // Always refetch after error or success to ensure consistency
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sales.byMonth(variables.storeId, variables.year, variables.month)
      });
    },
  });
};

// Batch update mutation for multiple sales entries
export const useBatchSalesDataMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      storeId,
      year,
      month,
      updates,
    }: {
      storeId: string;
      year: number;
      month: number;
      updates: Array<{ date: string; data: EDWDailySalesData }>;
    }) => {
      const response = await salesApi.saveBatchSales(year, month, storeId, updates);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to save batch sales data');
      }
      
      return updates;
    },
    
    onMutate: async ({ storeId, year, month, updates }) => {
      const queryKey = queryKeys.sales.byMonth(storeId, year, month);
      
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<MonthlyData>(queryKey);
      
      if (previousData) {
        const newDailyData = { ...previousData.dailyData };

        // Apply all updates optimistically
        updates.forEach(({ date, data }) => {
          const currentData = newDailyData[date] || { date, dayOfWeek: '' };
          const updatedData = calculateDerivedValues({
            ...currentData,
            ...data,
          });
          newDailyData[date] = updatedData;
        });
        
        // Calculate cumulative values for all updated data
        const dailyDataWithCumulatives = calculateCumulativeValues(
          newDailyData,
          year,
          month
        );
        
        const optimisticData: MonthlyData = {
          ...previousData,
          dailyData: dailyDataWithCumulatives,
        };
        
        queryClient.setQueryData(queryKey, optimisticData);
      }
      
      return { previousData, queryKey };
    },
    
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sales.byMonth(variables.storeId, variables.year, variables.month)
      });
    },
  });
};

// Prefetch hook for preloading adjacent months
export const usePrefetchAdjacentMonths = (
  storeId: string | undefined,
  currentYear: number,
  currentMonth: number
) => {
  const queryClient = useQueryClient();
  
  const prefetchMonths = () => {
    if (!storeId) return;
    
    // Calculate previous and next month
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    
    // Prefetch previous month
    queryClient.prefetchQuery({
      queryKey: queryKeys.sales.byMonth(storeId, prevYear, prevMonth),
      queryFn: () => salesApi.getSales(prevYear, prevMonth, storeId),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
    
    // Prefetch next month
    queryClient.prefetchQuery({
      queryKey: queryKeys.sales.byMonth(storeId, nextYear, nextMonth),
      queryFn: () => salesApi.getSales(nextYear, nextMonth, storeId),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };
  
  return { prefetchMonths };
};

// Helper function to create empty monthly data structure
const createEmptyMonthlyData = (year: number, month: number): MonthlyData => {
  const daysInMonth = getDaysInMonth(year, month);
  const dailyData: MonthlyData['dailyData'] = {};
  
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
  
  return {
    year,
    month,
    dailyData,
  };
};