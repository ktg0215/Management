export interface WeekdayTarget {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface DailyTarget {
  date: string;
  storeNetSalesTarget?: number;
}

export interface MonthlyTargets {
  year: number;
  month: number;
  monthlyStoreNetSalesTarget?: number;
  weekdayTargets?: WeekdayTarget;
  useWeekdayTargets?: boolean;
  dailyTargets: { [date: string]: DailyTarget };
}

export interface TargetFormData {
  monthlyStoreNetSalesTarget: number;
  useWeekdayTargets: boolean;
  weekdayTargets: WeekdayTarget;
}