"use client";
import React, { useState, useEffect } from 'react';
import { Store, TrendingUp, Calendar, BarChart3, PieChart, CreditCard, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName } from '@/utils/storeDisplay';
import Information from '@/components/Information';

function AdminDashboard() {
  const router = useRouter(); 
  const { user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const [currentDate, setCurrentDate] = useState('');

  React.useEffect(() => {
    if (stores.length === 0) fetchStores();
  }, [stores.length, fetchStores]);

  // クライアントサイドでのみ日付を設定
  useEffect(() => {
    const date = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    setCurrentDate(date);
  }, []);

  // 所属店舗名を取得
  const storeName = user?.storeId ? 
    (stores.find(store => store.id === user.storeId) ? 
      formatStoreName(stores.find(store => store.id === user.storeId)!) : 
      '') : 
    '';

  const handleShiftManagement = () => {
    router.push('/admin/shifts');
  };

  const handlePLManagement = () => {
    router.push('/admin/yearly-progress');
  };

  const handlePaymentManagement = () => {
    router.push('/admin/payments');
  };

  const handleMonthlySalesManagement = () => {
    router.push('/admin/monthly-sales');
  };

  const handleSalesManagement = () => {
    router.push('/admin/sales-management'); // 売上管理ページにリダイレクト
  };

  const handleReportManagement = () => {
    router.push('/admin/yearly-progress'); // 損益管理と同じページにリダイレクト（レポート系）
  };

  // 未実装ページ用のハンドラー（ダッシュボードにリダイレクト）
  const handleComingSoon = () => {
    // 現在のページがダッシュボードなので何もしない、または将来的にアラートを表示
    console.log('このページは開発中です');
  };

  return (
    <div className="bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Store className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{storeName}</h1>
                <p className="text-sm text-gray-500">店舗管理システム</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{currentDate}</p>
              <p className="text-xs text-gray-500">管理者</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Information Section */}
        <Information />

        {/* Main Navigation Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* Sales Management Card */}
          <div className="group cursor-pointer" onClick={handleSalesManagement}>
            <div className="bg-green-500 rounded-lg p-8 text-white hover:shadow-lg transition-shadow duration-200 h-[320px] relative">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 rounded-lg">
                    <BarChart3 className="h-8 w-8" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">管理機能</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="text-2xl font-bold mb-4">売上管理</h3>
                  <p className="text-green-100 mb-6 leading-relaxed flex-1">
                    日次・月次売上の確認、商品別売上分析、売上レポートの作成などの機能にアクセスできます。
                  </p>
                  <div className="flex items-center text-sm font-medium mt-auto">
                    <span>管理画面へ移動</span>
                    <div className="ml-2">→</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shift Management Card */}
          <div className="group cursor-pointer" onClick={handleShiftManagement}>
            <div className="bg-blue-600 rounded-lg p-8 text-white hover:shadow-lg transition-shadow duration-200 h-[320px] relative">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 rounded-lg">
                    <Calendar className="h-8 w-8" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">管理機能</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="text-2xl font-bold mb-4">シフト管理</h3>
                  <p className="text-blue-100 mb-6 leading-relaxed flex-1">
                    スタッフのシフト作成、勤怠管理、シフト変更申請の承認などの機能にアクセスできます。
                  </p>
                  <div className="flex items-center text-sm font-medium mt-auto">
                    <span>管理画面へ移動</span>
                    <div className="ml-2">→</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Sales Management Card */}
          <div className="group cursor-pointer" onClick={handleMonthlySalesManagement}>
            <div className="bg-orange-500 rounded-lg p-8 text-white hover:shadow-lg transition-shadow duration-200 h-[320px] relative">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 rounded-lg">
                    <TrendingUp className="h-8 w-8" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">管理機能</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="text-2xl font-bold mb-4">月次売上管理</h3>
                  <p className="text-orange-100 mb-6 leading-relaxed flex-1">
                    月別売上推移、前年同月比較、売上目標達成率の確認などの機能にアクセスできます。
                  </p>
                  <div className="flex items-center text-sm font-medium mt-auto">
                    <span>管理画面へ移動</span>
                    <div className="ml-2">→</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* P&L Management Card */}
          <div className="group cursor-pointer" onClick={handlePLManagement}>
            <div className="bg-red-500 rounded-lg p-8 text-white hover:shadow-lg transition-shadow duration-200 h-[320px] relative">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 rounded-lg">
                    <PieChart className="h-8 w-8" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">管理機能</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="text-2xl font-bold mb-4">損益管理</h3>
                  <p className="text-red-100 mb-6 leading-relaxed flex-1">
                    収益・費用の分析、利益率の確認、損益計算書の作成などの機能にアクセスできます。
                  </p>
                  <div className="flex items-center text-sm font-medium mt-auto">
                    <span>管理画面へ移動</span>
                    <div className="ml-2">→</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Management Card */}
          <div className="group cursor-pointer" onClick={handlePaymentManagement}>
            <div className="bg-purple-600 rounded-lg p-8 text-white hover:shadow-lg transition-shadow duration-200 h-[320px] relative">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 rounded-lg">
                    <CreditCard className="h-8 w-8" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">管理機能</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="text-2xl font-bold mb-4">支払い管理</h3>
                  <p className="text-purple-100 mb-6 leading-relaxed flex-1">
                    給与計算、支払い処理、給与明細の作成などの機能にアクセスできます。
                  </p>
                  <div className="flex items-center text-sm font-medium mt-auto">
                    <span>管理画面へ移動</span>
                    <div className="ml-2">→</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Report Management Card */}
          <div className="group cursor-pointer" onClick={handleReportManagement}>
            <div className="bg-indigo-600 rounded-lg p-8 text-white hover:shadow-lg transition-shadow duration-200 h-[320px] relative">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 rounded-lg">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">管理機能</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="text-2xl font-bold mb-4">レポート管理</h3>
                  <p className="text-indigo-100 mb-6 leading-relaxed flex-1">
                    各種レポートの作成、データエクスポート、分析レポートの作成などの機能にアクセスできます。
                  </p>
                  <div className="flex items-center text-sm font-medium mt-auto">
                    <span>管理画面へ移動</span>
                    <div className="ml-2">→</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    
      <AdminDashboard />
    
  );
}