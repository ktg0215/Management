import { QueryClient } from '@tanstack/react-query';

// Create a query client with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes after being unused
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: (failureCount, error: any) => {
        // Don't retry for 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for critical data
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
      // Background refetch interval for active queries
      refetchInterval: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      // Retry mutations once for network errors
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      retryDelay: 1000,
    },
  },
});

// Query keys factory for consistency
export const queryKeys = {
  // Sales data queries
  sales: {
    all: ['sales'] as const,
    byStore: (storeId: string) => ['sales', 'store', storeId] as const,
    byMonth: (storeId: string, year: number, month: number) => 
      ['sales', 'store', storeId, 'month', year, month] as const,
    byDateRange: (storeId: string, startDate: string, endDate: string) =>
      ['sales', 'store', storeId, 'range', startDate, endDate] as const,
  },
  
  // Store queries
  stores: {
    all: ['stores'] as const,
    byId: (id: string) => ['stores', id] as const,
    byUser: (userId: string) => ['stores', 'user', userId] as const,
  },
  
  // User queries
  users: {
    all: ['users'] as const,
    byId: (id: string) => ['users', id] as const,
    profile: ['users', 'profile'] as const,
  },
  
  // Analytics queries
  analytics: {
    all: ['analytics'] as const,
    sales: ['analytics', 'sales'] as const,
    performance: ['analytics', 'performance'] as const,
  },
} as const;

// Query invalidation helpers
export const invalidateQueries = {
  sales: {
    all: () => queryClient.invalidateQueries({ queryKey: queryKeys.sales.all }),
    byStore: (storeId: string) => 
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.byStore(storeId) }),
    byMonth: (storeId: string, year: number, month: number) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.byMonth(storeId, year, month) }),
  },
  
  stores: {
    all: () => queryClient.invalidateQueries({ queryKey: queryKeys.stores.all }),
    byId: (id: string) => 
      queryClient.invalidateQueries({ queryKey: queryKeys.stores.byId(id) }),
  },
};