import { useState, useEffect } from 'react';
import { MonthlyTargets, DailyTarget, TargetFormData, WeekdayTarget } from '../types/targets';
import { getDaysInMonth, getDayOfWeek, formatDate } from '../utils/dateUtils';

const TARGETS_STORAGE_KEY = 'salesTargets';

const defaultWeekdayTargets: WeekdayTarget = {
  monday: 400000,
  tuesday: 420000,
  wednesday: 450000,
  thursday: 480000,
  friday: 520000,
  saturday: 600000,
  sunday: 580000,
};

export const useTargets = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTargets>({
    year: currentYear,
    month: currentMonth,
    dailyTargets: {},
  });

  // Load targets from localStorage
  const loadTargets = (year: number, month: number) => {
    const key = `${TARGETS_STORAGE_KEY}_${year}_${month}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      const parsedData = JSON.parse(stored);
      setMonthlyTargets(parsedData);
    } else {
      // Initialize empty targets
      const daysInMonth = getDaysInMonth(year, month);
      const dailyTargets: { [date: string]: DailyTarget } = {};
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = formatDate(year, month, day);
        dailyTargets[dateKey] = {
          date: dateKey,
        };
      }
      
      setMonthlyTargets({
        year,
        month,
        dailyTargets,
        weekdayTargets: defaultWeekdayTargets,
        useWeekdayTargets: false,
      });
    }
  };

  // Save targets to localStorage
  const saveTargets = (targets: MonthlyTargets) => {
    const key = `${TARGETS_STORAGE_KEY}_${targets.year}_${targets.month}`;
    localStorage.setItem(key, JSON.stringify(targets));
  };

  // Get weekday name in English for mapping
  const getWeekdayKey = (dayOfWeek: string): keyof WeekdayTarget => {
    const mapping: { [key: string]: keyof WeekdayTarget } = {
      '月': 'monday',
      '火': 'tuesday',
      '水': 'wednesday',
      '木': 'thursday',
      '金': 'friday',
      '土': 'saturday',
      '日': 'sunday',
    };
    return mapping[dayOfWeek] || 'monday';
  };

  // Auto-distribute targets based on weekday settings
  const autoDistributeByWeekday = (weekdayTargets: WeekdayTarget) => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const newDailyTargets: { [date: string]: DailyTarget } = {};
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDate(currentYear, currentMonth, day);
      const dayOfWeek = getDayOfWeek(currentYear, currentMonth, day);
      const weekdayKey = getWeekdayKey(dayOfWeek);
      
      newDailyTargets[dateKey] = {
        date: dateKey,
        storeNetSalesTarget: weekdayTargets[weekdayKey],
      };
    }
    
    return newDailyTargets;
  };

  // Auto-distribute monthly target evenly
  const autoDistributeMonthly = (monthlyTarget: number) => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const dailyTarget = Math.round(monthlyTarget / daysInMonth);
    const newDailyTargets: { [date: string]: DailyTarget } = {};
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDate(currentYear, currentMonth, day);
      
      newDailyTargets[dateKey] = {
        date: dateKey,
        storeNetSalesTarget: dailyTarget,
      };
    }
    
    return newDailyTargets;
  };

  // Update targets
  const updateTargets = (formData: TargetFormData) => {
    let newDailyTargets = { ...monthlyTargets.dailyTargets };
    
    if (formData.useWeekdayTargets) {
      newDailyTargets = autoDistributeByWeekday(formData.weekdayTargets);
    } else if (formData.monthlyStoreNetSalesTarget > 0) {
      newDailyTargets = autoDistributeMonthly(formData.monthlyStoreNetSalesTarget);
    }
    
    const newTargets: MonthlyTargets = {
      ...monthlyTargets,
      monthlyStoreNetSalesTarget: formData.monthlyStoreNetSalesTarget,
      weekdayTargets: formData.weekdayTargets,
      useWeekdayTargets: formData.useWeekdayTargets,
      dailyTargets: newDailyTargets,
    };
    
    setMonthlyTargets(newTargets);
    saveTargets(newTargets);
  };

  // Update single daily target
  const updateDailyTarget = (date: string, target: Partial<DailyTarget>) => {
    const newTargets = {
      ...monthlyTargets,
      dailyTargets: {
        ...monthlyTargets.dailyTargets,
        [date]: {
          ...monthlyTargets.dailyTargets[date],
          ...target,
        },
      },
    };
    
    setMonthlyTargets(newTargets);
    saveTargets(newTargets);
  };

  // Get daily target
  const getDailyTarget = (date: string): DailyTarget | undefined => {
    return monthlyTargets.dailyTargets[date];
  };

  // Check if targets exist
  const hasTargets = (): boolean => {
    return !!(monthlyTargets.monthlyStoreNetSalesTarget || monthlyTargets.useWeekdayTargets);
  };

  // Change month
  const changeMonth = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // Load targets when year/month changes
  useEffect(() => {
    loadTargets(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  return {
    currentYear,
    currentMonth,
    monthlyTargets,
    updateTargets,
    updateDailyTarget,
    getDailyTarget,
    hasTargets,
    changeMonth,
    defaultWeekdayTargets,
  };
};