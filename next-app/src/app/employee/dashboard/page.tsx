"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, isAfter } from 'date-fns';
import { CalendarCheck, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useShiftStore } from '@/stores/shiftStore';
import type { ShiftPeriod } from '@/types/shift';
import Information from '@/components/Information';

const Dashboard = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { 
    currentPeriods, 
    draftPeriods,
    initializeCurrentPeriods,
    // getPeriodStatus, // 未使用のため削除
    getSubmissionStatus
  } = useShiftStore();
  
  // 一般ユーザーは直接シフト提出ページにリダイレクト
  useEffect(() => {
    if (isAuthenticated && user && user.role === 'user') {
      router.replace('/employee/shifts');
      return;
    }
  }, [isAuthenticated, user, router]);
  
  const [currentPeriod, setCurrentPeriod] = useState<ShiftPeriod | null>(null);
  const [upcomingDeadline, setUpcomingDeadline] = useState<ShiftPeriod | null>(null);
  
  const initializeShifts = useCallback(async () => {
    if (user) {
      try {
        await initializeCurrentPeriods(user.storeId, user.employeeId);
      } catch (error) {
        console.error('シフト初期化エラー:', error);
      }
    }
  }, [user]);
  
  useEffect(() => {
    initializeShifts();
  }, [user]);
  
  // メモ化された計算
  const { currentPeriodMemo, upcomingDeadlineMemo, overduePeriods, draftCount } = useMemo(() => {
    if (!currentPeriods.length) {
      return {
        currentPeriodMemo: null,
        upcomingDeadlineMemo: null,
        overduePeriods: [],
        draftCount: 0
      };
    }
    
    const current = null;
    
    // クライアントサイドでのみ日付計算を実行
    if (typeof window !== 'undefined') {
      const today = new Date();
      
      const upcomingPeriods = currentPeriods.filter(period => {
        const deadlineDate = new Date(period.submissionDeadline);
        return isAfter(deadlineDate, today) && !period.isSubmitted;
      });
      
      let upcoming = null;
      if (upcomingPeriods.length > 0) {
        // Sort by deadline (ascending)
        const sorted = upcomingPeriods.sort((a, b) => {
          const dateA = new Date(a.submissionDeadline);
          const dateB = new Date(b.submissionDeadline);
          return dateA.getTime() - dateB.getTime();
        });
        
        upcoming = sorted[0];
      }
      
      // Check for overdue periods
      const overdue = currentPeriods.filter(period => {
        return getSubmissionStatus(period) === 'overdue';
      });
      
      // Count draft periods
      const draft = draftPeriods.length;
      
      return {
        currentPeriodMemo: current,
        upcomingDeadlineMemo: upcoming,
        overduePeriods: overdue,
        draftCount: draft
      };
    }
    
    return {
      currentPeriodMemo: null,
      upcomingDeadlineMemo: null,
      overduePeriods: [],
      draftCount: 0
    };
  }, [currentPeriods, draftPeriods, getSubmissionStatus]);
  
  useEffect(() => {
    setCurrentPeriod(currentPeriodMemo ?? null);
    setUpcomingDeadline(upcomingDeadlineMemo);
  }, [currentPeriodMemo, upcomingDeadlineMemo]);
  
  // クライアントサイドでのみ日付計算を実行
  useEffect(() => {
    if (typeof window !== 'undefined' && currentPeriods.length > 0) {
      const today = new Date();
      
      // 提出期限が過ぎていない期間を抽出
      const validPeriods = currentPeriods.filter(period => {
        const deadlineDate = new Date(period.submissionDeadline);
        return deadlineDate >= today;
      });

      // 提出期限順にソート
      const sortedPeriods = validPeriods.sort((a, b) => {
        const dateA = new Date(a.submissionDeadline);
        const dateB = new Date(b.submissionDeadline);
        return dateA.getTime() - dateB.getTime();
      });

      setUpcomingDeadline(sortedPeriods[0] ?? null);
    }
  }, [currentPeriods]);
  
  return (
    <div className="min-h-screen bg-white">
      <main className="py-8">
        <div className="space-y-6 slide-up">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            こんにちは、{user?.nickname}さん
          </h1>
          
          {/* Information Section - Only for admin and super_admin */}
          <Information />
          
          {/* Alert for overdue shifts */}
          {overduePeriods.length > 0 && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-md fade-in">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    提出期限が過ぎているシフトがあります
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc pl-5 space-y-1">
                      {overduePeriods.map(period => (
                        <li key={period.id}>
                          {format(new Date(period.startDate), 'yyyy年MM月')}
                          {period.isFirstHalf ? '前半' : '後半'}
                          （期限：{format(new Date(period.submissionDeadline), 'yyyy年MM月dd日')}）
                          <Link href="/employee/shifts" className="ml-2 text-red-800 underline">
                            今すぐ提出する
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Period Card */}
            {currentPeriod && (
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">現在のシフト期間</h2>
                  <span className="shift-period shift-period-current">現在</span>
                </div>
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">期間</div>
                  <p className="font-medium">
                    {format(new Date(currentPeriod.startDate), 'yyyy年MM月dd日')} - 
                    {format(new Date(currentPeriod.endDate), 'yyyy年MM月dd日')}
                  </p>
                </div>
                <div className="mb-6">
                  <div className="text-sm text-gray-500 mb-1">ステータス</div>
                  <div className="flex items-center">
                    {currentPeriod.isSubmitted ? (
                      <span className="shift-status shift-status-submitted">提出済み</span>
                    ) : (
                      <span className="shift-status shift-status-draft">未提出</span>
                    )}
                    {!currentPeriod.isSubmitted && (
                      <span className="ml-2 text-sm text-gray-500">
                        期限: {format(new Date(currentPeriod.submissionDeadline), 'yyyy年MM月dd日')}
                      </span>
                    )}
                  </div>
                </div>
                {!currentPeriod.isSubmitted && (
                  <Link href="/employee/shifts" className="btn-primary flex items-center justify-center">
                    <CalendarCheck className="h-4 w-4 mr-2" />
                    シフトを提出する
                  </Link>
                )}
                {currentPeriod.isSubmitted && (
                  <Link href="/employee/shifts" className="btn-outline flex items-center justify-center">
                    <Clock className="h-4 w-4 mr-2" />
                    提出内容を確認する
                  </Link>
                )}
              </div>
            )}
            
            {/* Upcoming Deadline Card */}
            {upcomingDeadline && (
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">次回の提出期限</h2>
                  <span className="shift-period shift-period-upcoming">今後</span>
                </div>
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">期間</div>
                  <p className="font-medium">
                    {format(new Date(upcomingDeadline.startDate), 'yyyy年MM月dd日')} - 
                    {format(new Date(upcomingDeadline.endDate), 'yyyy年MM月dd日')}
                  </p>
                </div>
                <div className="mb-6">
                  <div className="text-sm text-gray-500 mb-1">提出期限</div>
                  <p className="font-medium text-accent-600">
                    {format(new Date(upcomingDeadline.submissionDeadline), 'yyyy年MM月dd日')}
                  </p>
                </div>
                <Link href="/employee/shifts" className="btn-primary flex items-center justify-center">
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  シフトを提出する
                </Link>
              </div>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">クイックアクション</h2>
            <div className="space-y-2">
              <Link 
                href="/employee/shifts" 
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <CalendarCheck className="h-5 w-5 text-primary-700 mr-3" />
                  <span>シフト提出</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
              
              <Link 
                href="/employee/shifts" 
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-primary-700 mr-3" />
                  <span>提出履歴確認</span>
                  {draftCount > 0 && (
                    <span className="ml-3 px-2 py-0.5 bg-accent-100 text-accent-800 rounded-full text-xs">
                      下書き {draftCount}件
                    </span>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;