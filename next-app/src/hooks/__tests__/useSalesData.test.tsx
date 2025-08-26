import { renderHook, act, waitFor } from '@testing-library/react';
import { useSalesData } from '../useSalesData';
import { salesApi } from '../../lib/api';
import { generateDemoData } from '../../utils/salesDemoData';

// Mock external dependencies
jest.mock('../../lib/api', () => ({
  salesApi: {
    getSales: jest.fn(),
    saveSales: jest.fn(),
  },
}));

jest.mock('../../utils/salesDemoData', () => ({
  generateDemoData: jest.fn(),
  generateMultiMonthDemoData: jest.fn(),
}));

const mockedSalesApi = salesApi as jest.Mocked<typeof salesApi>;
const mockedGenerateDemoData = generateDemoData as jest.MockedFunction<typeof generateDemoData>;

describe('useSalesData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful API responses
    mockedSalesApi.getSales.mockResolvedValue({
      success: true,
      data: {
        year: 2024,
        month: 1,
        daily_data: {
          '2024-01-01': {
            date: '2024-01-01',
            storeNetSales: 100000,
          },
        },
      },
    });

    mockedSalesApi.saveSales.mockResolvedValue({
      success: true,
      data: {
        year: 2024,
        month: 1,
        daily_data: {},
      },
    });
  });

  test('should initialize with current year and month', () => {
    const { result } = renderHook(() => useSalesData('store-1'));
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    expect(result.current.currentYear).toBe(currentYear);
    expect(result.current.currentMonth).toBe(currentMonth);
  });

  test('should load data when storeId is provided', async () => {
    const { result } = renderHook(() => useSalesData('store-1'));
    
    await waitFor(() => {
      expect(mockedSalesApi.getSales).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'store-1'
      );
    });
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.monthlyData.dailyData['2024-01-01']).toBeDefined();
  });

  test('should create empty data when no storeId is provided', () => {
    const { result } = renderHook(() => useSalesData());
    
    expect(mockedSalesApi.getSales).not.toHaveBeenCalled();
    expect(result.current.monthlyData.dailyData).toBeDefined();
  });

  test('should update sales data correctly', async () => {
    const { result } = renderHook(() => useSalesData('store-1'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const updateData = {
      date: '2024-01-01',
      storeNetSales: 150000,
      totalSales: 165000,
    };

    await act(async () => {
      await result.current.updateSalesData('2024-01-01', updateData);
    });

    expect(mockedSalesApi.saveSales).toHaveBeenCalled();
    expect(result.current.getDailyData('2024-01-01')?.storeNetSales).toBeDefined();
  });

  test('should handle API errors gracefully', async () => {
    mockedSalesApi.getSales.mockRejectedValue(new Error('API Error'));
    
    const { result } = renderHook(() => useSalesData('store-1'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // エラーが発生してもクラッシュせず、空のデータが設定される
    expect(result.current.monthlyData.dailyData).toBeDefined();
  });

  test('should change month correctly', async () => {
    const { result } = renderHook(() => useSalesData('store-1'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.changeMonth(2024, 2);
    });

    expect(result.current.currentYear).toBe(2024);
    expect(result.current.currentMonth).toBe(2);
    
    await waitFor(() => {
      expect(mockedSalesApi.getSales).toHaveBeenCalledWith(2024, 2, 'store-1');
    });
  });

  test('should load demo data correctly', async () => {
    const mockDemoData = {
      year: 2024,
      month: 1,
      dailyData: {
        '2024-01-01': {
          date: '2024-01-01',
          storeNetSales: 100000,
        },
      },
    };

    mockedGenerateDemoData.mockReturnValue(mockDemoData);
    
    const { result } = renderHook(() => useSalesData('store-1'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadDemoData();
    });

    expect(mockedGenerateDemoData).toHaveBeenCalled();
    expect(mockedSalesApi.saveSales).toHaveBeenCalled();
  });

  test('should check if data exists correctly', async () => {
    const { result } = renderHook(() => useSalesData('store-1'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // データが存在する日付
    expect(result.current.hasData('2024-01-01')).toBe(true);
    
    // データが存在しない日付
    expect(result.current.hasData('2024-01-02')).toBe(false);
  });

  test('should force reload data', async () => {
    const { result } = renderHook(() => useSalesData('store-1'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.forceReloadData();
    });

    // APIが再度呼ばれることを確認
    expect(mockedSalesApi.getSales).toHaveBeenCalledTimes(2);
  });
});