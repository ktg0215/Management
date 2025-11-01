// Shift type definitions - separated to avoid circular dependency

export type ShiftStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface ShiftEntry {
  id?: string;
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

export interface ShiftSubmission {
  id: string;
  employeeId: string;
  storeId?: string;
  periodId?: string;
  status: ShiftStatus;
  period?: ShiftPeriod;
  entries?: ShiftEntry[];
  shiftEntries?: ShiftEntry[];
  submittedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
