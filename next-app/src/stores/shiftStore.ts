import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, format, parse, startOfMonth, endOfMonth } from 'date-fns';
import { apiClient } from '../lib/api';
import type { ShiftSubmission } from '../lib/api';

export interface ShiftEntry {
  work_date: string; // ISO date string
  startTime: string | null; // Format: "9", "9.5", etc.
  endTime: string | null; // Format: "17", "17.5", etc.
  isHoliday: boolean;
}

export interface ShiftPeriod {
  id: string;
  storeId: string;
  employeeId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  isFirstHalf: boolean; // true = 1-15, false = 16-end
  submissionDeadline: string; // ISO date string
  isSubmitted: boolean;
  submittedAt: string | null; // ISO date-time string
  shifts: ShiftEntry[];
}

export type ShiftPeriodStatus = 'upcoming' | 'current' | 'past';
export type ShiftSubmissionStatus = 'draft' | 'submitted' | 'overdue';

interface ShiftState {
  currentPeriods: ShiftPeriod[];
  draftPeriods: ShiftPeriod[];
  selectedPeriod: ShiftPeriod | null;
  
  // Actions
  initializeCurrentPeriods: (storeId: string, employeeId: string) => void;
  selectPeriod: (periodId: string) => void;
  updateShift: (date: string, startTime: string | null, endTime: string | null, isHoliday: boolean) => void;
  bulkUpdateShifts: (dates: string[], startTime: string | null, endTime: string | null, isHoliday: boolean) => void;
  copyPreviousPeriod: () => boolean;
  submitShift: (periodId: string) => Promise<boolean>;
  
  // Helper methods
  getPeriodStatus: (period: ShiftPeriod) => ShiftPeriodStatus;
  getSubmissionStatus: (period: ShiftPeriod) => ShiftSubmissionStatus;
}

// Mock function to generate periods based on current date
const generatePeriods = (storeId: string, employeeId: string): ShiftPeriod[] => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Generate periods for current month and next month
  const periods: ShiftPeriod[] = [];
  
  // Helper function to create a period
  const createPeriod = (year: number, month: number, isFirstHalf: boolean): ShiftPeriod => {
    const monthStart = startOfMonth(new Date(year, month));
    const monthEnd = endOfMonth(new Date(year, month));
    
    const startDate = isFirstHalf 
      ? format(monthStart, 'yyyy-MM-dd')
      : format(new Date(year, month, 16), 'yyyy-MM-dd');
    
    const endDate = isFirstHalf 
      ? format(new Date(year, month, 15), 'yyyy-MM-dd')
      : format(monthEnd, 'yyyy-MM-dd');
    
    // Submission deadline is 20th of previous month for first half
    // and 5th of current month for second half
    const deadlineMonth = isFirstHalf ? (month === 0 ? 11 : month - 1) : month;
    const deadlineYear = isFirstHalf ? (month === 0 ? year - 1 : year) : year;
    const deadlineDay = isFirstHalf ? 20 : 5;
    
    const submissionDeadline = format(new Date(deadlineYear, deadlineMonth, deadlineDay), 'yyyy-MM-dd');
    
    // Create empty shifts for each day in the period
    const shifts: ShiftEntry[] = [];
    const start = parse(startDate, 'yyyy-MM-dd', new Date());
    const end = parse(endDate, 'yyyy-MM-dd', new Date());
    
    for (let day = start; day <= end; day = addDays(day, 1)) {
      shifts.push({
        work_date: format(day, 'yyyy-MM-dd'),
        startTime: null,
        endTime: null,
        isHoliday: false
      });
    }
    
    // id生成をUUIDに変更（ダミーの場合はuuid生成、API利用時はAPIのidを使う）
    const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return {
      id: uuidv4(), // ここでダミーUUIDを生成
      storeId,
      employeeId,
      startDate,
      endDate,
      isFirstHalf,
      submissionDeadline,
      isSubmitted: false,
      submittedAt: null,
      shifts
    };
  };
  
  
  // Current month, first half
  periods.push(createPeriod(currentYear, currentMonth, true));
  
  // Current month, second half
  periods.push(createPeriod(currentYear, currentMonth, false));
  
  // Next month, first half
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  periods.push(createPeriod(nextYear, nextMonth, true));
  
  return periods;
};

export const useShiftStore = create<ShiftState>()(
  persist(
    (set, get) => {
      // UUID形式かどうかを判定する関数
      const isUUID = (id: string) => /^[0-9a-fA-F-]{36}$/.test(id);
      // 状態セット時にUUID形式でないperiodを除外（draftPeriodsも常にフィルタ）
      const safeSet = (partial: Partial<ShiftState>) => {
        set({
          ...partial,
          currentPeriods: partial.currentPeriods ? partial.currentPeriods.filter((p: ShiftPeriod) => isUUID(p.id)) : get().currentPeriods.filter((p: ShiftPeriod) => isUUID(p.id)),
          draftPeriods: partial.draftPeriods ? partial.draftPeriods.filter((p: ShiftPeriod) => isUUID(p.id)) : get().draftPeriods.filter((p: ShiftPeriod) => isUUID(p.id)),
          selectedPeriod: partial.selectedPeriod && isUUID(partial.selectedPeriod.id) ? partial.selectedPeriod : null,
        });
      };
      
      return {
        currentPeriods: [],
        draftPeriods: [],
        selectedPeriod: null,
        
        initializeCurrentPeriods: async (storeId, employeeId) => {
          // Generate local periods
          const localPeriods = generatePeriods(storeId, employeeId);
          
          // Check existing submissions from API
          try {
            // Get current user from auth store
            const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
            if (!authToken) {
              console.error('認証トークンが見つかりません');
              set({ currentPeriods: localPeriods });
              return;
            }
            
            // Decode JWT token to get user info
            const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
            const currentEmployeeId = tokenPayload.employeeId;
            
            // Get periods from API
            const periodsResponse = await apiClient.getShiftPeriods(storeId);
            let apiPeriods: ShiftPeriod[] = [];
            
            if (periodsResponse.success && periodsResponse.data) {
              apiPeriods = periodsResponse.data;
            }
            
            // Combine local and API periods
            const allPeriods = [...localPeriods];
            
            // Add API periods that don't exist in local periods
            apiPeriods.forEach((apiPeriod: ShiftPeriod) => {
              const exists = allPeriods.find((localPeriod: ShiftPeriod) => 
                localPeriod.startDate === apiPeriod.startDate && 
                localPeriod.endDate === apiPeriod.endDate
              );
              
              if (!exists) {
                // Convert API period to local format
                const localPeriod: ShiftPeriod = {
                  id: apiPeriod.id, // ここでAPIのUUIDを優先
                  storeId: apiPeriod.storeId,
                  employeeId: employeeId,
                  startDate: apiPeriod.startDate,
                  endDate: apiPeriod.endDate,
                  isFirstHalf: new Date(apiPeriod.startDate).getDate() <= 15,
                  submissionDeadline: apiPeriod.submissionDeadline,
                  isSubmitted: false,
                  submittedAt: null,
                  shifts: []
                };
                
                // Generate shifts for this period
                const start = parse(apiPeriod.startDate, 'yyyy-MM-dd', new Date());
                const end = parse(apiPeriod.endDate, 'yyyy-MM-dd', new Date());
                
                for (let day = start; day <= end; day = addDays(day, 1)) {
                  localPeriod.shifts.push({
                    work_date: format(day, 'yyyy-MM-dd'),
                    startTime: null,
                    endTime: null,
                    isHoliday: false
                  });
                }
                
                allPeriods.push(localPeriod);
              }
            });
            
            // Check submissions for all periods
            const updatedPeriods = await Promise.all(
              allPeriods.map(async (period: ShiftPeriod) => {
                // Check if this period has been submitted
                const submissionsResponse = await apiClient.getShiftSubmissions(period.id);
                if (submissionsResponse.success && submissionsResponse.data) {
                  const submission = submissionsResponse.data.find((s: ShiftSubmission) => s.employeeId === currentEmployeeId);
                  if (submission && submission.status === 'submitted') {
                    // Get shift entries for this submission
                    const entriesResponse = await apiClient.getShiftEntries(submission.id);
                    let updatedShifts = period.shifts;
                    
                    if (entriesResponse.success && entriesResponse.data && entriesResponse.data.length > 0) {
                      // Update shifts with actual data from API
                      updatedShifts = period.shifts.map((shift: ShiftEntry) => {
                        const entry = entriesResponse.data!.find((e: ShiftEntry) => e.work_date === shift.work_date);
                        if (entry) {
                          return {
                            work_date: shift.work_date,
                            startTime: entry.startTime,
                            endTime: entry.endTime,
                            isHoliday: entry.isHoliday
                          };
                        }
                        return shift;
                      });
                    }
                    
                    return {
                      ...period,
                      isSubmitted: true,
                      submittedAt: submission.submittedAt || (submission as unknown as { createdAt?: string }).createdAt || null,
                      shifts: updatedShifts
                    };
                  }
                }
                return period;
              })
            );
            
            safeSet({
              currentPeriods: updatedPeriods.filter(p => isUUID(p.id)),
              draftPeriods: get().draftPeriods.filter(p => isUUID(p.id)),
            });
          } catch (error) {
            console.error('シフト期間初期化エラー:', error);
            set({ currentPeriods: localPeriods });
          }
        },
        
        selectPeriod: (periodId) => {
          const { currentPeriods, draftPeriods } = get();
          
          // First check in current periods
          let period = currentPeriods.find((p: ShiftPeriod) => p.id === periodId);
          
          // Then check in drafts
          if (!period) {
            period = draftPeriods.find((p: ShiftPeriod) => p.id === periodId);
          }
          
          // If found a period, set it as selected
          if (period) {
            set({ selectedPeriod: period });
          }
        },
        
        updateShift: (date, startTime, endTime, isHoliday) => {
          const { selectedPeriod, draftPeriods } = get();
          
          if (!selectedPeriod) {
            return;
          }
          
          // Create a new draft if this is a submitted period
          let updatedPeriod = {
              ...selectedPeriod,
              isSubmitted: false,
              submittedAt: null
            };
          
          // Update the shift for the specific date
          const updatedShifts = updatedPeriod.shifts.map((shift: ShiftEntry) => {
            if (shift.work_date === date) {
              return { ...shift, startTime, endTime, isHoliday };
            }
            return shift;
          });
          
          updatedPeriod = { ...updatedPeriod, shifts: updatedShifts };
          
          // If this is a draft (not in currentPeriods), update the drafts array
          if (!selectedPeriod.isSubmitted) {
            const updatedDrafts = draftPeriods.map((draft: ShiftPeriod) => 
              draft.id === updatedPeriod.id ? updatedPeriod : draft
            );
            
            // If not found in existing drafts, add it
            if (!draftPeriods.find((d: ShiftPeriod) => d.id === updatedPeriod.id)) {
              updatedDrafts.push(updatedPeriod);
            }
            
            safeSet({ 
              draftPeriods: updatedDrafts,
              selectedPeriod: updatedPeriod
            });
          } else {
            // Add to drafts
            safeSet({
              draftPeriods: [...draftPeriods, updatedPeriod],
              selectedPeriod: updatedPeriod
            });
          }
        },
        
        bulkUpdateShifts: (dates, startTime, endTime, isHoliday) => {
          const { selectedPeriod, draftPeriods } = get();
          
          if (!selectedPeriod) return;
          
          // Create a new draft if this is a submitted period
          let updatedPeriod = {
              ...selectedPeriod,
              isSubmitted: false,
              submittedAt: null
            };
          
          // Update all shifts for the specified dates
          const updatedShifts = updatedPeriod.shifts.map((shift: ShiftEntry) => 
            dates.includes(shift.work_date)
              ? { ...shift, startTime, endTime, isHoliday }
              : shift
          );
          
          updatedPeriod = { ...updatedPeriod, shifts: updatedShifts };
          
          // If this is a draft (not in currentPeriods), update the drafts array
          if (!selectedPeriod.isSubmitted) {
            const updatedDrafts = draftPeriods.map((draft: ShiftPeriod) => 
              draft.id === updatedPeriod.id ? updatedPeriod : draft
            );
            
            // If not found in existing drafts, add it
            if (!draftPeriods.find((d: ShiftPeriod) => d.id === updatedPeriod.id)) {
              updatedDrafts.push(updatedPeriod);
            }
            
            safeSet({ 
              draftPeriods: updatedDrafts,
              selectedPeriod: updatedPeriod
            });
          } else {
            // Add to drafts
            safeSet({
              draftPeriods: [...draftPeriods, updatedPeriod],
              selectedPeriod: updatedPeriod
            });
          }
        },
        
        copyPreviousPeriod: () => {
          const { selectedPeriod, currentPeriods, draftPeriods } = get();
          
          if (!selectedPeriod) return false;
          
          // Find the previous period
          const periods = [...currentPeriods, ...draftPeriods];
          const sorted = periods.sort((a: ShiftPeriod, b: ShiftPeriod) => {
            return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
          });
          
          const currentIndex = sorted.findIndex((p: ShiftPeriod) => p.id === selectedPeriod.id);
          if (currentIndex === -1 || currentIndex === sorted.length - 1) {
            // No previous period found
            return false;
          }
          
          const previousPeriod = sorted[currentIndex + 1];
          
          // Create a new draft from the current period, copying shifts from the previous period
          const updatedPeriod = {
            ...selectedPeriod,
            isSubmitted: false,
            submittedAt: null
          };
          
          // Map the shifts from previous period to current period dates
          updatedPeriod.shifts = selectedPeriod.shifts.map((shift: ShiftEntry, index: number) => {
            // If index is out of bounds for previous period, keep the original shift
            if (index >= previousPeriod.shifts.length) {
              return shift;
            }
            
            // Copy the time data from previous period
            const prevShift = previousPeriod.shifts[index];
            return {
              work_date: shift.work_date, // Keep current date
              startTime: prevShift.startTime,
              endTime: prevShift.endTime,
              isHoliday: prevShift.isHoliday
            };
          });
          
          // Update drafts
          const updatedDrafts = draftPeriods.filter((d: ShiftPeriod) => d.id !== updatedPeriod.id);
          updatedDrafts.push(updatedPeriod);
          
          safeSet({
            draftPeriods: updatedDrafts,
            selectedPeriod: updatedPeriod
          });
          
          return true;
        },
        
        submitShift: async (periodId) => {
          const { currentPeriods, draftPeriods } = get();
          
          // Find the period to submit
          const draftPeriod = draftPeriods.find((p: ShiftPeriod) => p.id === periodId);
          
          if (!draftPeriod) return false;
          
          try {
            // Get current user from auth store
            const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
            if (!authToken) {
              console.error('認証トークンが見つかりません');
              return false;
            }
            
            // Decode JWT token to get user info (simple base64 decode for now)
            const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
            const employeeId = tokenPayload.employeeId;
            
            // First, create or update shift submission
            const submissionData = {
              periodId: periodId,
              employeeId: employeeId,
              shiftEntries: draftPeriod.shifts,
            };
            
            // Check if submission already exists
            const existingSubmissions = await apiClient.getShiftSubmissions(periodId);
            let submissionId: string;
            
            if (existingSubmissions.success && existingSubmissions.data && existingSubmissions.data.length > 0) {
              // Update existing submission
              const existingSubmission = existingSubmissions.data.find((s: ShiftSubmission) => s.employeeId === employeeId);
              if (existingSubmission) {
                const updateResult = await apiClient.updateShiftSubmission(existingSubmission.id, { status: 'submitted', shiftEntries: draftPeriod.shifts });
                if (!updateResult.success) {
                  console.error('シフト提出更新エラー:', updateResult.error);
                  return false;
                }
                submissionId = existingSubmission.id;
              } else {
                // Create new submission
                const createResult = await apiClient.createShiftSubmission(submissionData);
                if (!createResult.success || !createResult.data) {
                  console.error('シフト提出作成エラー:', createResult.error);
                  return false;
                }
                submissionId = createResult.data.id;
              }
            } else {
              // Create new submission
              const createResult = await apiClient.createShiftSubmission(submissionData);
              if (!createResult.success || !createResult.data) {
                console.error('シフト提出作成エラー:', createResult.error);
                return false;
              }
              submissionId = createResult.data.id;
            }
            
            // Create shift entries for each shift (including holidays)
            for (const shift of draftPeriod.shifts) {
              const entryData = {
                submissionId: submissionId,
                work_date: shift.work_date,
                startTime: shift.startTime,
                endTime: shift.endTime,
                isHoliday: shift.isHoliday,
              };
              const entryResult = await apiClient.createShiftEntry(entryData);
              if (!entryResult.success) {
                console.error('シフトエントリ作成エラー:', entryResult.error);
                // Continue with other entries even if one fails
              }
            }
            
            // Update the current period with the submitted data
            const updatedCurrentPeriods = currentPeriods.map((period: ShiftPeriod) => {
              if (period.id === periodId) {
                return {
                  ...draftPeriod,
                  isSubmitted: true,
                  submittedAt: new Date().toISOString()
                };
              }
              return period;
            });
            
            // Remove from drafts
            const updatedDrafts = draftPeriods.filter((d: ShiftPeriod) => d.id !== periodId);
            
            safeSet({
              currentPeriods: updatedCurrentPeriods,
              draftPeriods: updatedDrafts,
              selectedPeriod: null
            });
            
            return true;
          } catch (error) {
            console.error('シフト提出エラー:', error);
            return false;
          }
        },
        
        getPeriodStatus: (period) => {
          const today = new Date();
          const startDate = new Date(period.startDate);
          const endDate = new Date(period.endDate);
          
          if (today > endDate) return 'past';
          if (today < startDate) return 'upcoming';
          return 'current';
        },
        
        getSubmissionStatus: (period) => {
          if (period.isSubmitted) return 'submitted';
          
          const today = new Date();
          const deadline = new Date(period.submissionDeadline);
          
          if (today > deadline) return 'overdue';
          return 'draft';
        }
      };
    },
    {
      name: 'shift-storage',
      partialize: (state) => ({
        draftPeriods: state.draftPeriods,
        // Don't persist selected period or currentPeriods
      })
    }
  )
);

// アプリ初回ロード時にlocalStorageのshift-storageをクリア（UUID形式でないIDが残っている場合のみ）
if (typeof window !== 'undefined') {
  try {
    const persisted = typeof window !== 'undefined' ? localStorage.getItem('shift-storage') : null;
    if (persisted && persisted.includes('2025-6-second')) {
      localStorage.removeItem('shift-storage');
      console.warn('古いdraftPeriodsを検出し、shift-storageをクリアしました');
    }
  } catch {}
}