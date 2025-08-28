import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { salesApi } from '@/lib/api';
import { MonthlyData, EDWDailySalesData } from '@/types/sales';
import { calculateDerivedValues, calculateCumulativeValues } from '@/utils/salesCalculations';
import { getDaysInMonth, getDayOfWeek, formatDate } from '@/utils/salesUtils';
import { EDW_SALES_FIELDS } from '@/types/sales';

// Hook for fetching monthly sales data with intelligent caching
export const useSalesData = (storeId: string | undefined, year: number, month: number) => {
  return useQuery({
    queryKey: queryKeys.sales.byMonth(storeId || '', year, month),
    queryFn: async () => {
      if (!storeId) {
        // Return empty data structure when no store is selected
        return createEmptyMonthlyData(year, month);
      }
      
      const response = await salesApi.getSales(year, month, storeId);
      
      if (response.success && response.data) {
        return {
          year: response.data.year,
          month: response.data.month,
          dailyData: response.data.daily_data || {},
        } as MonthlyData;
      } else {
        // Return empty data structure when no data exists
        return createEmptyMonthlyData(year, month);
      }
    },
    enabled: !!storeId, // Only run query when storeId exists
    staleTime: 2 * 60 * 1000, // 2 minutes - sales data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes for active queries
  });
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
        let newDailyData = { ...previousData.dailyData };
        
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