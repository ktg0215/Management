"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { 
  Calendar,  Save, CheckCircle, Copy, 
  AlertTriangle, ArrowLeft 
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useShiftStore } from '@/stores/shiftStore';
import type { ShiftPeriod, ShiftEntry } from '@/types/shift';

const ShiftSubmission = () => {
  const navigate = useRouter();
  const { user } = useAuthStore();
  const { 
    currentPeriods, 
    draftPeriods,
    selectedPeriod,
    selectPeriod,
    updateShift,
    bulkUpdateShifts,
    copyPreviousPeriod,
    submitShift,
    getPeriodStatus,
    getSubmissionStatus,
    initializeCurrentPeriods
  } = useShiftStore();
  
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkStartTime, setBulkStartTime] = useState<string | null>(null);
  const [bulkEndTime, setBulkEndTime] = useState<string | null>(null);
  const [bulkIsHoliday, setBulkIsHoliday] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Get the period ID from the location state
  useEffect(() => {
    const periodId = undefined;
    if (periodId) {
      // draftPeriods優先で選択
      const draft = draftPeriods.find(p => p.id === periodId);
      if (draft) {
        selectPeriod(draft.id);
        return;
      }
      selectPeriod(periodId);
    } else {
      // draftPeriodsに未提出の期間があれば優先して選択
      if (draftPeriods.length > 0) {
        selectPeriod(draftPeriods[0].id);
        return;
      }
      // isSubmitted: falseのcurrentPeriodsを優先して選択
      const notSubmitted = currentPeriods.find(p => !p.isSubmitted);
      if (notSubmitted) {
        selectPeriod(notSubmitted.id);
        return;
      }
      // 「現在」または「今後」の期間を優先して選択
      const nowOrUpcoming = currentPeriods.find(p => {
        const status = getPeriodStatus(p);
        return status === 'current' || status === 'upcoming';
      });
      if (nowOrUpcoming) {
        selectPeriod(nowOrUpcoming.id);
      } else if (currentPeriods.length > 0) {
        selectPeriod(currentPeriods[0].id);
      }
    }
  }, [currentPeriods, draftPeriods, selectPeriod, getPeriodStatus]);

  // Generate time options for dropdowns
  const generateStartTimeOptions = () => {
    const options = [];
    for (let hour = 9; hour <= 18; hour++) {
      options.push(
        <option key={`${hour}`} value={hour}>{hour}:00</option>,
        <option key={`${hour}.5`} value={`${hour}.5`}>{hour}:30</option>
      );
    }
    return options;
  };

  const generateEndTimeOptions = (startTime: string | null = null) => {
    const options = [];
    let minHour = 11;
    
    // If start time is provided, calculate minimum end time
    if (startTime) {
      const startHour = parseFloat(startTime);
      // End time must be at least 1 hour after start time
      minHour = Math.max(11, Math.ceil(startHour + 1));
    }
    
    for (let hour = minHour; hour <= 22; hour++) {
      options.push(
        <option key={`${hour}`} value={hour}>{hour}:00</option>,
        <option key={`${hour}.5`} value={`${hour}.5`}>{hour}:30</option>
      );
    }
    return options;
  };
  
  // Handle form submission
  const handleSubmitShift = async () => {
    if (!selectedPeriod) return;
    // UUID形式チェック
    const isUUID = (id: string) => /^[0-9a-fA-F-]{36}$/.test(id);
    console.log('submitShift: selectedPeriod.id', selectedPeriod.id);
    console.log('submitShift: selectedPeriod', selectedPeriod);
    if (!isUUID(selectedPeriod.id)) {
      setErrorMessage('シフト期間IDが不正です（UUID形式のみ許可）。画面を再読み込みしてください。');
      return;
    }
    
    // Check if all required shifts have been filled
    const emptyShifts = selectedPeriod.shifts.filter(shift => 
      !shift.isHoliday && (shift.startTime === null || shift.endTime === null)
    );
    
    if (emptyShifts.length > 0) {
      setErrorMessage('未入力の日があります。休みの場合は休日にチェックしてください。');
      return;
    }
    
    // Check for invalid time combinations
    const invalidShifts = selectedPeriod.shifts.filter(shift => {
      if (shift.isHoliday || !shift.startTime || !shift.endTime) return false;
      const startHour = parseFloat(shift.startTime);
      const endHour = parseFloat(shift.endTime);
      return endHour <= startHour;
    });
    
    if (invalidShifts.length > 0) {
      setErrorMessage('終了時間は開始時間より後に設定してください。');
      return;
    }
    
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
      const success = await submitShift(selectedPeriod.id);
      
      if (success) {
        setSuccessMessage('シフトが正常に提出されました。');
        
        // Force refresh the shift store state
        if (user) {
          try {
            await initializeCurrentPeriods(user.storeId, user.employeeId);
          } catch (error) {
            console.error('シフト状態更新エラー:', error);
          }
        }
        
        // Wait a bit then navigate based on user role
        setTimeout(() => {
          if (user?.role === 'user') {
            // 一般ユーザーはシフトページに留まる
            window.location.reload();
          } else {
            navigate.push('/employee/dashboard');
          }
        }, 1500);
      } else {
        setErrorMessage('シフトの提出に失敗しました。');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage('シフトの提出中にエラーが発生しました: ' + err.message);
      } else {
      setErrorMessage('シフトの提出中にエラーが発生しました。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle copy from previous period
  const handleCopyPrevious = () => {
    const success = copyPreviousPeriod();
    if (success) {
      setSuccessMessage('前回のシフトをコピーしました。');
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } else {
      setErrorMessage('前回のシフトをコピーできませんでした。');
      setTimeout(() => {
        setErrorMessage('');
      }, 3000);
    }
  };
  
  // Handle shift updates
  const handleShiftUpdate = (
    shift: ShiftEntry,
    field: 'startTime' | 'endTime' | 'isHoliday',
    value: string | null | boolean
  ) => {
    let startTime = shift.startTime;
    let endTime = shift.endTime;
    let isHoliday = shift.isHoliday;
    
    if (field === 'startTime') {
      startTime = value as string | null;
      if (endTime && startTime) {
        const startHour = parseFloat(startTime);
        const endHour = parseFloat(endTime);
        if (endHour <= startHour) {
          endTime = null;
        }
      }
    } else if (field === 'endTime') {
      endTime = value as string | null;
    } else if (field === 'isHoliday') {
      isHoliday = value as boolean;
      if (isHoliday) {
        startTime = null;
        endTime = null;
      }
    }
    
    updateShift(shift.work_date, startTime, endTime, isHoliday);
  };
  
  // Bulk edit functions
  const toggleDateSelection = (date: string) => {
    setSelectedDates(prev => 
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };
  
  const handleBulkEdit = () => {
    if (selectedDates.length === 0) return;
    setShowBulkEditModal(true);
  };
  
  const applyBulkEdit = () => {
    if (selectedDates.length === 0) return;
    
    // Validate bulk edit times
    if (!bulkIsHoliday && bulkStartTime && bulkEndTime) {
      const startHour = parseFloat(bulkStartTime);
      const endHour = parseFloat(bulkEndTime);
      if (endHour <= startHour) {
        setErrorMessage('終了時間は開始時間より後に設定してください。');
        return;
      }
    }
    
    bulkUpdateShifts(
      selectedDates,
      bulkIsHoliday ? null : bulkStartTime,
      bulkIsHoliday ? null : bulkEndTime,
      bulkIsHoliday
    );
    
    setShowBulkEditModal(false);
    setSelectedDates([]);
    setBulkStartTime(null);
    setBulkEndTime(null);
    setBulkIsHoliday(false);
    
    setSuccessMessage('一括編集が適用されました。');
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };
  
  // Check if a period is past its deadline
  const isPastDeadline = (period: ShiftPeriod): boolean => {
    if (typeof window === 'undefined') return false; // SSR対策
    const today = new Date();
    const deadline = new Date(period.submissionDeadline);
    return today > deadline;
  };
  
  // UUID形式かどうかを判定する関数
  const isUUID = (id: string) => /^[0-9a-fA-F-]{36}$/.test(id);

  if (!selectedPeriod || !isUUID(selectedPeriod.id)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <p className="text-lg text-gray-700 mb-2">シフト期間データが不正です。</p>
        <p className="text-sm text-gray-500 mb-4">URLや遷移元が不正、またはデータが破損している可能性があります。</p>
        <button className="btn-primary" onClick={() => navigate.push('/employee/dashboard')}>ダッシュボードに戻る</button>
      </div>
    );
  }
  
  // shiftsの各要素でwork_dateとdateが混在している場合も警告
  if (selectedPeriod.shifts.some(s => !s.work_date)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <p className="text-lg text-gray-700 mb-2">シフトデータ形式が不正です。</p>
        <p className="text-sm text-gray-500 mb-4">work_dateが存在しないシフトデータがあります。管理者にご連絡ください。</p>
        <button className="btn-primary" onClick={() => navigate.push('/employee/dashboard')}>ダッシュボードに戻る</button>
      </div>
    );
  }
  
  const periodStatus = getPeriodStatus(selectedPeriod);
  const submissionStatus = getSubmissionStatus(selectedPeriod);
  const isOverdue = isPastDeadline(selectedPeriod);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="py-8">
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            {user?.role !== 'user' && (
              <button
                onClick={() => navigate.push('/employee/dashboard')}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>戻る</span>
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">シフト管理</h1>
            <div className="w-6"></div> {/* Spacer for centering */}
          </div>
          
          {/* Tab Navigation */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('submit')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'submit'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  シフト提出
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  提出履歴
                </button>
              </nav>
            </div>
          </div>
          
          {/* Tab Content */}
          {activeTab === 'submit' ? (
            <>
              {/* Period selection and status */}
              <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="mb-4 md:mb-0">
                <h2 className="text-lg font-medium">
                  {format(new Date(selectedPeriod.startDate), 'yyyy年MM月')}
                  {selectedPeriod.isFirstHalf ? '前半' : '後半'}
                  （{format(new Date(selectedPeriod.startDate), 'M/d')} - {format(new Date(selectedPeriod.endDate), 'M/d')}）
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  提出期限: {format(new Date(selectedPeriod.submissionDeadline), 'yyyy年MM月dd日')}
                </p>
              </div>
              <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-3">
                <div className="flex items-center">
                  <span className={`shift-period ${
                    periodStatus === 'current' ? 'shift-period-current' : 
                    periodStatus === 'upcoming' ? 'shift-period-upcoming' : 
                    'shift-period-past'
                  }`}>
                    {periodStatus === 'current' ? '現在' : 
                     periodStatus === 'upcoming' ? '今後' : '過去'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`shift-status ${
                    submissionStatus === 'submitted' ? 'shift-status-submitted' : 
                    submissionStatus === 'overdue' ? 'shift-status-overdue' : 
                    'shift-status-draft'
                  }`}>
                    {submissionStatus === 'submitted' ? '提出済み' : 
                     submissionStatus === 'overdue' ? '期限超過' : '下書き'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Success/Error Messages */}
          {successMessage && (
            <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded-md fade-in">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="ml-3 text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          )}
          
          {errorMessage && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-md fade-in">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <p className="ml-3 text-sm text-red-700">{errorMessage}</p>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button 
              onClick={handleCopyPrevious}
              className="btn-outline flex items-center justify-center"
            >
              <Copy className="h-4 w-4 mr-2" />
              前回のシフトをコピー
            </button>
            
            <button 
              onClick={handleBulkEdit}
              disabled={selectedDates.length === 0}
              className={`btn-outline flex items-center justify-center ${
                selectedDates.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Calendar className="h-4 w-4 mr-2" />
              選択した日を一括編集 {selectedDates.length > 0 && `(${selectedDates.length}日)`}
            </button>
          </div>
          
          {/* Warning about overdue submission */}
          {isOverdue && !selectedPeriod.isSubmitted && (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-md">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">
                    提出期限が過ぎています
                  </h3>
                  <div className="mt-1 text-sm text-amber-700">
                    <p>期限を過ぎていますが、シフトの提出は可能です。</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Shift Calendar */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 sm:w-40">
                      日付
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      シフト時間
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      休日
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-14">
                      選択
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedPeriod.shifts.map((shift) => {
                    let dateObj: Date | null = null;
                    try {
                      // SSR対策: クライアントサイドでのみ日付処理
                      if (typeof window !== 'undefined') {
                        dateObj = new Date(shift.work_date);
                        if (isNaN(dateObj.getTime())) dateObj = null;
                      }
                    } catch {
                      dateObj = null;
                    }
                    const isWeekend = dateObj ? (dateObj.getDay() === 0 || dateObj.getDay() === 6) : false;
                    const isSelected = selectedDates.includes(shift.work_date);
                    
                    return (
                      <tr 
                        key={shift.work_date}
                        className={`${isWeekend ? 'bg-gray-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {dateObj ? (
                                <>
                                  {format(dateObj, 'MM/dd')}
                                  <span className={`ml-1 ${dateObj.getDay() === 0 ? 'text-red-600' : dateObj.getDay() === 6 ? 'text-blue-600' : ''}`}>
                                    ({format(dateObj, 'E', { locale: ja })})
                                  </span>
                                </>
                              ) : (
                                '-'
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {!shift.isHoliday && (
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                              <div className="flex items-center">
                                <label htmlFor={`start-${shift.work_date}`} className="text-sm font-medium text-gray-700 mr-2">開始</label>
                                <select
                                  id={`start-${shift.work_date}`}
                                  value={shift.startTime || ''}
                                  onChange={(e) => handleShiftUpdate(shift, 'startTime', e.target.value || null)}
                                  disabled={selectedPeriod.isSubmitted || shift.isHoliday}
                                  className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                >
                                  <option value="">選択</option>
                                  {generateStartTimeOptions()}
                                </select>
                              </div>
                              
                              <div className="flex items-center">
                                <label htmlFor={`end-${shift.work_date}`} className="text-sm font-medium text-gray-700 mr-2">終了</label>
                                <select
                                  id={`end-${shift.work_date}`}
                                  value={shift.endTime || ''}
                                  onChange={(e) => handleShiftUpdate(shift, 'endTime', e.target.value || null)}
                                  disabled={selectedPeriod.isSubmitted || shift.isHoliday}
                                  className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                >
                                  <option value="">選択</option>
                                  {generateEndTimeOptions(shift.startTime)}
                                </select>
                              </div>
                            </div>
                          )}
                          {shift.isHoliday && (
                            <span className="text-sm text-gray-500">休日</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            id={`holiday-${shift.work_date}`}
                            checked={shift.isHoliday}
                            onChange={(e) => handleShiftUpdate(shift, 'isHoliday', e.target.checked)}
                            disabled={selectedPeriod.isSubmitted}
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            id={`select-${shift.work_date}`}
                            checked={isSelected}
                            onChange={() => toggleDateSelection(shift.work_date)}
                            disabled={selectedPeriod.isSubmitted}
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmitShift}
              disabled={selectedPeriod.isSubmitted || isSubmitting}
              className={`btn-primary flex items-center justify-center ${
                selectedPeriod.isSubmitted ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  提出中...
                </span>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  シフトを提出する
                </>
              )}
            </button>
          </div>
          
          {/* Bulk Edit Modal */}
          {showBulkEditModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
              <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl slide-up">
                <h3 className="text-lg font-semibold mb-4">一括編集</h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-2">
                    {selectedDates.length}日を一括編集します。
                  </p>
                </div>
                
                <div className="mb-4">
                  <label className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      checked={bulkIsHoliday}
                      onChange={(e) => setBulkIsHoliday(e.target.checked)}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">休日に設定</span>
                  </label>
                  
                  {!bulkIsHoliday && (
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="bulk-start" className="form-label">開始時間</label>
                        <select
                          id="bulk-start"
                          value={bulkStartTime || ''}
                          onChange={(e) => {
                            setBulkStartTime(e.target.value || null);
                            // Clear end time if it's now invalid
                            if (bulkEndTime && e.target.value) {
                              const startHour = parseFloat(e.target.value);
                              const endHour = parseFloat(bulkEndTime);
                              if (endHour <= startHour) {
                                setBulkEndTime(null);
                              }
                            }
                          }}
                          className="form-input"
                        >
                          <option value="">選択</option>
                          {generateStartTimeOptions()}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="bulk-end" className="form-label">終了時間</label>
                        <select
                          id="bulk-end"
                          value={bulkEndTime || ''}
                          onChange={(e) => setBulkEndTime(e.target.value || null)}
                          className="form-input"
                        >
                          <option value="">選択</option>
                          {generateEndTimeOptions(bulkStartTime)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowBulkEditModal(false)}
                    className="btn-outline"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={applyBulkEdit}
                    className="btn-primary"
                    disabled={!bulkIsHoliday && (!bulkStartTime || !bulkEndTime)}
                  >
                    適用する
                  </button>
                </div>
              </div>
            </div>
          )}
            </>
          ) : (
            /* History Tab Content */
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">提出履歴（過去1ヶ月）</h3>
              
              {(() => {
                // 今日から一ヶ月前までの期間をフィルタリング
                const today = new Date();
                const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                
                const recentPeriods = currentPeriods.filter(period => {
                  const periodEndDate = new Date(period.endDate);
                  return periodEndDate >= oneMonthAgo && periodEndDate <= today;
                }).sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
                
                if (recentPeriods.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-gray-500">過去1ヶ月の提出履歴がありません。</p>
                      <p className="text-sm text-gray-400 mt-1">
                        （対象期間: {format(oneMonthAgo, 'yyyy年MM月dd日')} 〜 {format(today, 'yyyy年MM月dd日')}）
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 mb-4">
                      表示期間: {format(oneMonthAgo, 'yyyy年MM月dd日')} 〜 {format(today, 'yyyy年MM月dd日')}
                    </p>
                    {recentPeriods.map((period) => {
                      const periodStatus = getPeriodStatus(period);
                      const submissionStatus = getSubmissionStatus(period);
                      
                      return (
                        <div key={period.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium">
                                {format(new Date(period.startDate), 'yyyy年MM月')}
                                {period.isFirstHalf ? '前半' : '後半'}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {format(new Date(period.startDate), 'M/d')} - {format(new Date(period.endDate), 'M/d')}
                              </p>
                              <p className="text-sm text-gray-600">
                                提出期限: {format(new Date(period.submissionDeadline), 'yyyy年MM月dd日')}
                              </p>
                            </div>
                            <div className="flex flex-col items-end space-y-2">
                              <span className={`shift-period ${
                                periodStatus === 'current' ? 'shift-period-current' : 
                                periodStatus === 'upcoming' ? 'shift-period-upcoming' : 
                                'shift-period-past'
                              }`}>
                                {periodStatus === 'current' ? '現在' : 
                                 periodStatus === 'upcoming' ? '今後' : '過去'}
                              </span>
                              <span className={`shift-status ${
                                submissionStatus === 'submitted' ? 'shift-status-submitted' : 
                                submissionStatus === 'overdue' ? 'shift-status-overdue' : 
                                'shift-status-draft'
                              }`}>
                                {submissionStatus === 'submitted' ? '提出済み' : 
                                 submissionStatus === 'overdue' ? '期限超過' : '下書き'}
                              </span>
                            </div>
                          </div>
                          
                          {period.isSubmitted && period.submittedAt && (
                            <p className="text-sm text-gray-600 mb-3">
                              提出日時: {format(new Date(period.submittedAt), 'yyyy年MM月dd日 HH:mm')}
                            </p>
                          )}
                          
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-600">
                              勤務予定日数: {period.shifts.filter(s => !s.isHoliday).length}日
                            </div>
                            {!period.isSubmitted && (
                              <button
                                onClick={() => {
                                  selectPeriod(period.id);
                                  setActiveTab('submit');
                                }}
                                className="btn-primary text-sm"
                              >
                                編集する
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ShiftSubmission;