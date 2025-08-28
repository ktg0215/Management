// Lazy-loaded components for better code splitting
import dynamic from 'next/dynamic';

// Sales Management Components
export const SalesForm = dynamic(() => 
  import('../sales/SalesForm').then(mod => ({ default: mod.SalesForm })), {
  loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />,
  ssr: false, // Forms don't need SSR
});

export const SalesTable = dynamic(() => 
  import('../sales/SalesTable').then(mod => ({ default: mod.SalesTable })), {
  loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
});

// Monthly Sales Components
export const MonthlyDataTable = dynamic(() => 
  import('../monthly-sales/MonthlyDataTable'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
});

export const DataEntryModal = dynamic(() => 
  import('../monthly-sales/DataEntryModal'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />,
  ssr: false,
});

// Excel Export Functionality - Heavy dependency
export const ExcelExporter = dynamic(() => 
  import('../../utils/excelExporter'), {
  loading: () => <div className="inline-block animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />,
  ssr: false,
});