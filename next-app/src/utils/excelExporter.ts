// Excel export functionality - dynamically loaded
import type { DailySalesData } from '../types/sales';

export const exportToExcel = async (data: { [date: string]: DailySalesData }, year: number, month: number) => {
  // Dynamic import of ExcelJS to reduce initial bundle size
  const ExcelJS = await import('exceljs');
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`${year}年${month}月売上データ`);
  
  // Configure worksheet
  worksheet.columns = [
    { header: '日付', key: 'date', width: 12 },
    { header: '曜日', key: 'dayOfWeek', width: 8 },
    { header: '店舗純売上', key: 'storeNetSales', width: 15 },
    { header: 'EDW純売上', key: 'edwNetSales', width: 15 },
    { header: 'OHB純売上', key: 'ohbNetSales', width: 15 },
    // Add more columns as needed
  ];
  
  // Add data rows
  Object.values(data).forEach(dayData => {
    worksheet.addRow({
      date: dayData.date,
      dayOfWeek: dayData.dayOfWeek,
      storeNetSales: dayData.storeNetSales || 0,
      edwNetSales: dayData.edwNetSales || 0,
      ohbNetSales: dayData.ohbNetSales || 0,
    });
  });
  
  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F3FF' }
  };
  
  // Generate Excel file buffer
  const buffer = await workbook.xlsx.writeBuffer();
  
  // Create download
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `売上データ_${year}年${month}月.xlsx`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default exportToExcel;