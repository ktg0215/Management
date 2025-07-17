"use client";
import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { 
  Download, ChevronDown, ChevronUp,  
  Clock,  AlertTriangle, CheckCircle, Settings, X
} from 'lucide-react';
import { useStoreStore } from '@/stores/storeStore';
import apiClient from '@/lib/api';
import ExcelJS from 'exceljs';
import type { ShiftEntry } from '@/stores/shiftStore';
import type { ShiftSubmission } from '@/lib/api';
import AppLayout from '@/app/appLayout/layout';

interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  nickname: string;
  storeId: string;
  storeName?: string;
}

interface PeriodOption {
  year: number;
  month: number;
  isFirstHalf: boolean;
  label: string;
  value: string;
}

const ShiftApproval = () => {
  const { stores, fetchStores } = useStoreStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string>('');
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submissions, setSubmissions] = useState<ShiftSubmission[]>([]);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [showEmployeeOrderModal, setShowEmployeeOrderModal] = useState(false);
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]);
  
  // 並び順をローカルストレージに保存
  const saveEmployeeOrder = (order: string[]) => {
    if (typeof window !== 'undefined' && selectedStoreId) {
      const key = `employeeOrder_${selectedStoreId}`;
      localStorage.setItem(key, JSON.stringify(order));
    }
  };
  
  // 並び順をローカルストレージから読み込み
  const loadEmployeeOrder = (): string[] => {
    if (typeof window !== 'undefined' && selectedStoreId) {
      const key = `employeeOrder_${selectedStoreId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  };
  
  // Generate period options based on current date
  const generatePeriodOptions = (): PeriodOption[] => {
    if (typeof window === 'undefined') return []; // SSR対策
    
    const today = new Date();
    const options: PeriodOption[] = [];
    
    // 過去3ヶ月分
    for (let i = 3; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      // 前半と後半を追加
      options.push({
        year,
        month,
        isFirstHalf: true,
        value: `${year}-${month.toString().padStart(2, '0')}-first`,
        label: `${year}年${month}月 前半`
      });
      options.push({
        year,
        month,
        isFirstHalf: false,
        value: `${year}-${month.toString().padStart(2, '0')}-second`,
        label: `${year}年${month}月 後半`
      });
    }
    
    // 未来3ヶ月分
    for (let i = 1; i <= 3; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      // 前半と後半を追加
      options.push({
        year,
        month,
        isFirstHalf: true,
        value: `${year}-${month.toString().padStart(2, '0')}-first`,
        label: `${year}年${month}月 前半`
      });
      options.push({
        year,
        month,
        isFirstHalf: false,
        value: `${year}-${month.toString().padStart(2, '0')}-second`,
        label: `${year}年${month}月 後半`
      });
    }
    
    return options;
  };
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPeriodOptions(generatePeriodOptions());
    }
  }, []);
  
  const loadShiftData = useCallback(async () => {
    if (!selectedStoreId || !selectedPeriodValue) return;
    try {
      // 従業員一覧を取得
      const employeesResponse = await apiClient.getEmployees();
      if (employeesResponse.success && employeesResponse.data) {
        // 選択された店舗の従業員のみをフィルタリング
        const filteredEmployees = employeesResponse.data.filter(
          (emp: Employee) => emp.storeId === selectedStoreId
        );
        setEmployees(filteredEmployees);
        
        // 保存された並び順を読み込み、なければデフォルト順序を使用
        const savedOrder = loadEmployeeOrder();
        const allEmployeeIds = filteredEmployees.map(emp => emp.id);
        
        if (savedOrder.length > 0) {
          // 保存された順序を基に、新しい従業員も末尾に追加
          const orderedIds = [
            ...savedOrder.filter(id => allEmployeeIds.includes(id)),
            ...allEmployeeIds.filter(id => !savedOrder.includes(id))
          ];
          setEmployeeOrder(orderedIds);
        } else {
          // デフォルト順序（従業員IDの昇順）
          const sortedIds = allEmployeeIds.sort();
          setEmployeeOrder(sortedIds);
        }
      } else {
        console.error('従業員取得エラー:', employeesResponse.error);
        setEmployees([]);
        setEmployeeOrder([]);
      }

      // シフト期間を取得
      const periodsResponse = await apiClient.getShiftPeriods(selectedStoreId);
      if (periodsResponse.success && periodsResponse.data) {
        // 選択された期間に該当するシフト期間を探す
        const selectedPeriod = periodOptions.find(p => p.value === selectedPeriodValue);
        if (selectedPeriod) {
          const targetPeriod = periodsResponse.data.find((period) => {
            const p = period as { startDate: string };
            const periodDate = new Date(p.startDate);
            return periodDate.getFullYear() === selectedPeriod.year && 
                   periodDate.getMonth() + 1 === selectedPeriod.month;
          });

          if (targetPeriod) {
            // シフト提出データを取得
            const submissionsResponse = await apiClient.getShiftSubmissions(targetPeriod.id);
            if (submissionsResponse.success && submissionsResponse.data) {
              // シフトエントリも含めて取得
              const submissionsWithEntries = await Promise.all(
                submissionsResponse.data.map(async (submission: ShiftSubmission) => {
                  const entriesResponse = await apiClient.getShiftEntries(submission.id);
                  return {
                    ...submission,
                    shiftEntries: entriesResponse.success ? entriesResponse.data as ShiftEntry[] : []
                  };
                })
              );
              setSubmissions(submissionsWithEntries);
            } else {
              console.error('シフト提出取得エラー:', submissionsResponse.error);
              setSubmissions([]);
            }
          } else {
            console.log('該当するシフト期間が見つかりません');
            setSubmissions([]);
          }
        }
      } else {
        console.error('シフト期間取得エラー:', periodsResponse.error);
        setSubmissions([]);
      }
    } catch (error) {
      console.error('シフトデータ読み込みエラー:', error);
      setEmployees([]);
      setEmployeeOrder([]);
      setSubmissions([]);
    }
  }, [selectedStoreId, selectedPeriodValue, periodOptions, loadEmployeeOrder]);
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await fetchStores();
        if (selectedStoreId && selectedPeriodValue) {
          await loadShiftData();
        }
      } catch (error) {
        console.error('データ読み込みエラー:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [selectedPeriodValue, selectedStoreId, fetchStores, loadShiftData]);
  
  // Set default store when stores are loaded
  useEffect(() => {
    // Check if there's a selected store from navigation state
    const stateStoreId = undefined;
    
    // Filter out Manager store
    const nonManagerStores = stores.filter(store => 
      store.name.toLowerCase() !== 'manager'
    );
    
    if (stateStoreId && nonManagerStores.some(store => store.id === stateStoreId)) {
      setSelectedStoreId(stateStoreId);
    } else if (nonManagerStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(nonManagerStores[0].id);
    }
  }, [stores, selectedStoreId]);
  
  // Initialize employee order when employees change
  useEffect(() => {
    if (employees.length > 0 && employeeOrder.length === 0) {
      const allEmployeeIds = employees.map(emp => emp.id);
      const savedOrder = loadEmployeeOrder();
      
      if (savedOrder.length > 0) {
        // 保存された順序を基に、新しい従業員も末尾に追加
        const orderedIds = [
          ...savedOrder.filter(id => allEmployeeIds.includes(id)),
          ...allEmployeeIds.filter(id => !savedOrder.includes(id))
        ];
        setEmployeeOrder(orderedIds);
      } else {
        // デフォルト順序（従業員IDの昇順）
        const sortedIds = allEmployeeIds.sort();
        setEmployeeOrder(sortedIds);
      }
    }
  }, [employees, employeeOrder.length, selectedStoreId, loadEmployeeOrder]);
  
  // Get unique employees from submissions and sort by custom order
  const getUniqueEmployees = () => {
    return employees.sort((a, b) => {
      const indexA = employeeOrder.indexOf(a.id);
      const indexB = employeeOrder.indexOf(b.id);
      
      // If both employees are in the order, sort by index
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If one is not in the order, put it at the end
      if (indexA === -1 && indexB !== -1) return 1;
      if (indexA !== -1 && indexB === -1) return -1;
      
      // If neither is in the order, sort by ID
      return a.id.localeCompare(b.id);
    });
  };
  
  // Get submission for a specific employee
  const getEmployeeSubmission = (employeeId: string) => {
    return submissions.find(sub => sub.employeeId === employeeId);
  };
  
  // Check if employee has submitted shifts
  const hasEmployeeSubmitted = (employeeId: string) => {
    const submission = getEmployeeSubmission(employeeId);
    return submission?.status === 'submitted';
  };
  
  // Format time for display
  const formatTimeDisplay = (time: string | null): string => {
    if (!time) return '-';
    
    const [hours, minutes] = time.includes('.') 
      ? [parseInt(time.split('.')[0]), parseInt(time.split('.')[1]) * 6] // Convert .5 to 30 minutes
      : [parseInt(time), 0];
    
    return `${hours}:${minutes === 0 ? '00' : minutes}`;
  };
  
  // Toggle employee expansion
  const toggleEmployeeExpansion = (employeeId: string) => {
    if (expandedEmployeeId === employeeId) {
      setExpandedEmployeeId(null);
    } else {
      setExpandedEmployeeId(employeeId);
    }
  };
  
  // Move employee up in order
  const moveEmployeeUp = (employeeId: string) => {
    const currentIndex = employeeOrder.indexOf(employeeId);
    if (currentIndex > 0) {
      const newOrder = [...employeeOrder];
      [newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]];
      setEmployeeOrder(newOrder);
      saveEmployeeOrder(newOrder); // 並び順を保存
    }
  };
  
  // Move employee down in order
  const moveEmployeeDown = (employeeId: string) => {
    const currentIndex = employeeOrder.indexOf(employeeId);
    if (currentIndex < employeeOrder.length - 1) {
      const newOrder = [...employeeOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      setEmployeeOrder(newOrder);
      saveEmployeeOrder(newOrder); // 並び順を保存
    }
  };
  
  // Export to Excel with the specified template format using ExcelJS
  const exportToExcel = async () => {
    if (!selectedPeriodValue) return;
    
    const selectedPeriod = periodOptions.find(p => p.value === selectedPeriodValue);
    if (!selectedPeriod) return;
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('シフト表');
    
    // Get unique employees and sort by their custom order
    const uniqueEmployees = getUniqueEmployees();
    
    // Calculate the number of days in the period
    const year = selectedPeriod.year;
    const month = selectedPeriod.month;
    const startDay = selectedPeriod.isFirstHalf ? 1 : 16;
    const endDay = selectedPeriod.isFirstHalf ? 15 : (typeof window !== 'undefined' ? new Date(year, month, 0).getDate() : 31);
    const daysInPeriod = endDay - startDay + 1;
    
    // Set column widths
    worksheet.getColumn(1).width = 3;   // A column (empty)
    worksheet.getColumn(2).width = 10;  // B column (employee names)
    
    // Set widths for date columns
    for (let i = 0; i < daysInPeriod * 2; i++) {
      worksheet.getColumn(3 + i).width = 4;
    }
    
    // Row 1: Title with store name
    const currentStore = stores.find(store => store.id === selectedStoreId);
    const storeName = currentStore ? currentStore.name : '全店舗';
    const titleText = `${storeName} ${year}年${month}月${selectedPeriod.isFirstHalf ? '前半' : '後半'}シフト表`;
    
    worksheet.getCell('B1').value = titleText;
    worksheet.mergeCells(`B1:${String.fromCharCode(66 + (daysInPeriod * 2))}1`);
    worksheet.getRow(1).height = 20;
    worksheet.getCell('B1').style = {
      alignment: { horizontal: 'center', vertical: 'middle' },
      font: { bold: true }
    };
    
    // Row 2: Date headers
    let currentCol = 3;
    for (let day = startDay; day <= endDay; day++) {
      const colLetter = String.fromCharCode(65 + currentCol - 1);
      const nextColLetter = String.fromCharCode(65 + currentCol);
      
      worksheet.getCell(`${colLetter}2`).value = day.toString();
      worksheet.mergeCells(`${colLetter}2:${nextColLetter}2`);
      worksheet.getCell(`${colLetter}2`).style = {
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      currentCol += 2;
    }
    worksheet.getRow(2).height = 20;
    
    // Row 3: Day of week labels
    currentCol = 3;
    for (let day = startDay; day <= endDay; day++) {
      const colLetter = String.fromCharCode(65 + currentCol - 1);
      const nextColLetter = String.fromCharCode(65 + currentCol);
      
      if (typeof window !== 'undefined') {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = format(date, 'E', { locale: ja });
        worksheet.getCell(`${colLetter}3`).value = dayOfWeek;
      }
      
      worksheet.mergeCells(`${colLetter}3:${nextColLetter}3`);
      worksheet.getCell(`${colLetter}3`).style = {
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      currentCol += 2;
    }
    worksheet.getRow(3).height = 20;
    
    // Row 4: "出" and "退" headers
    currentCol = 3;
    for (let day = startDay; day <= endDay; day++) {
      const colLetter1 = String.fromCharCode(65 + currentCol - 1);
      const colLetter2 = String.fromCharCode(65 + currentCol);
      
      worksheet.getCell(`${colLetter1}4`).value = '出';
      worksheet.getCell(`${colLetter2}4`).value = '退';
      
      worksheet.getCell(`${colLetter1}4`).style = {
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      worksheet.getCell(`${colLetter2}4`).style = {
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      currentCol += 2;
    }
    worksheet.getRow(4).height = 20;
    
    // Rows 5-6: Empty rows
    worksheet.getRow(5).height = 15;
    worksheet.getRow(6).height = 15;
    
    // Employee data rows (starting from row 7)
    let currentRow = 7;
    for (const employee of uniqueEmployees) {
      const submission = getEmployeeSubmission(employee.id);
      
      // Employee name in column B
      worksheet.getCell(`B${currentRow}`).value = employee.nickname;
      worksheet.getCell(`B${currentRow}`).style = {
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      // Create a map of shifts by date for easy lookup
      const shiftMap = new Map();
      if (submission?.shiftEntries) {
        submission.shiftEntries.forEach(shift => {
          if (typeof window !== 'undefined') {
            const shiftDay = new Date(shift.work_date).getDate();
            shiftMap.set(shiftDay, shift);
          }
        });
      }
      
      // Fill in shift data for each day
      currentCol = 3;
      for (let day = startDay; day <= endDay; day++) {
        const shift = shiftMap.get(day);
        const colLetter1 = String.fromCharCode(65 + currentCol - 1);
        const colLetter2 = String.fromCharCode(65 + currentCol);
        
        if (shift && !shift.isHoliday) {
          // Convert time format: "9" -> "9.0", "9.5" -> "9.5"
          const startTime = shift.startTime ? (shift.startTime.includes('.') ? shift.startTime : `${shift.startTime}.0`) : '';
          const endTime = shift.endTime ? (shift.endTime.includes('.') ? shift.endTime : `${shift.endTime}.0`) : '';
          
          worksheet.getCell(`${colLetter1}${currentRow}`).value = startTime;
          worksheet.getCell(`${colLetter2}${currentRow}`).value = endTime;
        }
        
        // Add borders to all cells
        worksheet.getCell(`${colLetter1}${currentRow}`).style = {
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
        
        worksheet.getCell(`${colLetter2}${currentRow}`).style = {
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
        
        currentCol += 2;
      }
      
      worksheet.getRow(currentRow).height = 18;
      currentRow++;
    }
    
    // Save file
    const fileStore = stores.find(store => store.id === selectedStoreId);
    const fileStoreName = fileStore ? fileStore.name : '全店舗';
    const fileName = `シフト表_${fileStoreName}_${selectedPeriod.year}年${selectedPeriod.month}月${selectedPeriod.isFirstHalf ? '前半' : '後半'}.xlsx`;
    
    // Generate Excel file and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  };
  
  // Calculate submission statistics (excluding admins)
  const getSubmissionStats = () => {
    const totalEmployees = employees.length; // Already filtered to exclude admins
    const submittedEmployees = submissions.filter(sub => sub.status === 'submitted').length;
    
    return {
      total: totalEmployees,
      submitted: submittedEmployees,
      pending: totalEmployees - submittedEmployees,
      percentage: totalEmployees > 0 ? Math.round((submittedEmployees / totalEmployees) * 100) : 0
    };
  };
  
  const stats = getSubmissionStats();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <Clock className="animate-spin h-8 w-8 text-primary-600 mr-3" />
            <span>Loading...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="py-8">
        <div className="space-y-6 slide-up">
          <h1 className="text-2xl font-bold text-gray-900">シフト管理</h1>
          
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label htmlFor="store" className="form-label">店舗</label>
                <select
                  id="store"
                  className="form-input"
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                >
                  {stores.length === 0 ? (
                    <option value="">店舗を読み込み中...</option>
                  ) : (
                    stores
                      .filter(store => store.name.toLowerCase() !== 'manager')
                      .map((store) => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))
                  )}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="period" className="form-label">期間</label>
                <select
                  id="period"
                  className="form-input"
                  value={selectedPeriodValue}
                  onChange={(e) => setSelectedPeriodValue(e.target.value)}
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end space-x-2">
                <button 
                  className="btn-secondary flex items-center"
                  onClick={() => setShowEmployeeOrderModal(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  並び順設定
                </button>
                <button 
                  className="btn-primary flex items-center"
                  onClick={exportToExcel}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Excelで出力
                </button>
              </div>
            </div>
          </div>
          
          {/* Submission Overview */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-medium mb-3">提出状況</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm text-gray-500 mb-1">全従業員</div>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              
              <div className="bg-green-50 p-3 rounded-md">
                <div className="text-sm text-gray-500 mb-1">提出済み</div>
                <p className="text-2xl font-semibold text-green-600">
                  {stats.submitted}
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    （{stats.percentage}%）
                  </span>
                </p>
              </div>
              
              <div className="bg-amber-50 p-3 rounded-md">
                <div className="text-sm text-gray-500 mb-1">未提出</div>
                <p className="text-2xl font-semibold text-amber-600">
                  {stats.pending}
                </p>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm text-gray-500 mb-1">提出期限</div>
                <p className="text-lg font-semibold text-blue-600">
                  {selectedPeriodValue && periodOptions.find(p => p.value === selectedPeriodValue)?.isFirstHalf
                    ? `前月20日` 
                    : `当月5日`
                  }
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full" 
                  style={{ width: `${stats.percentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-right">
                提出率: {stats.percentage}%
              </div>
            </div>
          </div>
          
          {/* Employee Shifts */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium">従業員シフト一覧</h2>
              <p className="text-sm text-gray-600">
                {selectedStoreId && stores.length > 0
                  ? stores.find(s => s.id === selectedStoreId)?.name 
                  : '店舗選択中...'
                } - {selectedPeriodValue && periodOptions.find(p => p.value === selectedPeriodValue)?.label}
              </p>
            </div>
            <div className="overflow-hidden">
              <div className="bg-gray-50 p-3 flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="w-16 sm:w-24">勤怠番号</div>
                <div className="flex-1">氏名</div>
                <div className="w-24 sm:w-32">状態</div>
                <div className="w-8"></div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {getUniqueEmployees().map((employee) => {
                  const submission = getEmployeeSubmission(employee.id);
                  const isExpanded = expandedEmployeeId === employee.id;
                  const hasSubmitted = hasEmployeeSubmitted(employee.id);
                  
                  return (
                    <div key={employee.id} className="bg-white">
                      {/* Employee Row */}
                      <div 
                        className="p-3 flex items-center hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleEmployeeExpansion(employee.id)}
                      >
                        <div className="w-16 sm:w-24 text-sm font-medium">{employee.employeeId}</div>
                        <div className="flex-1 text-sm">
                          {employee.fullName} <span className="text-xs text-gray-500">({employee.nickname})</span>
                        </div>
                        <div className="w-24 sm:w-32">
                          {hasSubmitted ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              <CheckCircle className="h-3 w-3 inline-block mr-1" />
                              提出済み
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              <AlertTriangle className="h-3 w-3 inline-block mr-1" />
                              未提出
                            </span>
                          )}
                        </div>
                        <div className="w-8 text-right">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                          {!hasSubmitted ? (
                            <div className="text-sm text-gray-500 p-4 text-center">
                              <AlertTriangle className="h-5 w-5 text-amber-500 inline-block mr-2" />
                              このシフト期間はまだ提出されていません。
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      日付
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      出勤
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      退勤
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      状態
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {submission?.shiftEntries
                                    ?.sort((a, b) => {
                                      if (typeof window !== 'undefined') {
                                        return new Date(a.work_date).getTime() - new Date(b.work_date).getTime();
                                      }
                                      return 0;
                                    })
                                    .map((shift) => {
                                      if (typeof window === 'undefined') return null;
                                      const date = new Date(shift.work_date);
                                      return (
                                        <tr key={shift.work_date} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 whitespace-nowrap">
                                            <div className="text-sm">
                                              {format(date, 'MM/dd')}
                                              <span className={`ml-1 ${date.getDay() === 0 ? 'text-red-600' : date.getDay() === 6 ? 'text-blue-600' : ''}`}>
                                                ({format(date, 'E', { locale: ja })})
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap">
                                            <div className="text-sm">
                                              {shift.isHoliday ? '-' : formatTimeDisplay(shift.startTime)}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap">
                                            <div className="text-sm">
                                              {shift.isHoliday ? '-' : formatTimeDisplay(shift.endTime)}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap">
                                            {shift.isHoliday ? (
                                              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                                休日
                                              </span>
                                            ) : (
                                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                                出勤
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Employee Order Modal */}
          {showEmployeeOrderModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
              <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl slide-up max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">従業員の並び順設定</h3>
                  <button
                    onClick={() => setShowEmployeeOrderModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Excel出力時の従業員の並び順を設定できます。上下ボタンで順序を変更してください。
                  </p>
                </div>
                
                <div className="space-y-2">
                  {employeeOrder.map((employeeId, index) => {
                    const employee = employees.find(emp => emp.id === employeeId);
                    if (!employee) return null;
                    
                    return (
                      <div key={employeeId} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-500 w-8">{index + 1}.</span>
                          <span className="text-sm font-medium">{employee.fullName}</span>
                          <span className="text-xs text-gray-500 ml-2">({employee.nickname})</span>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => moveEmployeeUp(employeeId)}
                            disabled={index === 0}
                            className={`p-1 rounded ${
                              index === 0 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                            }`}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => moveEmployeeDown(employeeId)}
                            disabled={index === employeeOrder.length - 1}
                            className={`p-1 rounded ${
                              index === employeeOrder.length - 1 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                            }`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowEmployeeOrderModal(false)}
                    className="btn-primary"
                  >
                    設定完了
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default function Page() {
  return (
    <AppLayout>
      <ShiftApproval />
    </AppLayout>
  );
}