"use client";
import React, { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useStoreStore } from "@/stores/storeStore";
import { useRouter } from "next/navigation";
import { User, LogOut, Menu, X, Clock, CalendarCheck, BarChart3, TrendingUp, PieChart, CreditCard, Building, Users, UserPlus } from "lucide-react";
import { NavItem } from "@/components/nav/NavItem";

export const LayoutMobileHeader: React.FC = () => {
  const { user, logout, isAdmin, isSuperAdmin } = useAuthStore();
  const { stores } = useStoreStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const storeName = user?.storeId ? stores.find(store => store.id === user.storeId)?.name : '';
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
      router.push('/login');
    }
  };

  const getRoleIcon = () => {
    if (!user) return <User className="h-6 w-6 text-gray-600" />;
    const iconColors = {
      'user': 'text-blue-600',
      'admin': 'text-green-600',
      'super_admin': 'text-purple-600'
    };
    return <User className={`h-6 w-6 ${iconColors[user.role]}`} />;
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            {getRoleIcon()}
            <div>
              <h1 className="text-lg font-semibold text-gray-900">シフト提出システム</h1>
              <p className="text-sm text-gray-500">{user?.nickname}</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 bottom-0 bg-white z-10 fade-in">
          <div className="flex flex-col py-4">
            <div className="px-4 mb-4">
              <div className="flex flex-col items-start p-3 bg-primary-50 rounded-lg">
                {storeName && (
                  <div className="text-xs text-gray-500 mb-1">{storeName}</div>
                )}
                <div className="flex items-center">
                  <User className="h-5 w-5 text-primary-700" />
                  <span className="ml-2 font-medium">{user?.nickname}</span>
                </div>
              </div>
            </div>
            <div className="space-y-1 px-2">
              {isAdmin() ? (
                <>
                  <NavItem to="/admin/dashboard" icon={<Clock />} label="ダッシュボード" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  <NavItem to="/admin/shifts" icon={<CalendarCheck />} label="シフト管理" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  <NavItem to="/admin/dashboard" icon={<BarChart3 />} label="売上管理" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  <NavItem to="/admin/dashboard" icon={<TrendingUp />} label="月次売上管理" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  <NavItem to="/admin/yearly-progress" icon={<PieChart />} label="損益管理" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  <NavItem to="/admin/payments" icon={<CreditCard />} label="支払い管理" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  <NavItem to="/admin/stores" icon={<Building />} label="店舗管理" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  <NavItem to="/admin/employees" icon={<Users />} label="従業員管理" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  {isSuperAdmin() && (
                    <NavItem to="/admin/add-admin" icon={<UserPlus />} label="管理者追加" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  )}
                </>
              ) : (
                <>
                  {user?.role !== 'user' && (
                    <NavItem to="/employee/dashboard" icon={<Clock />} label="ダッシュボード" onClick={() => setIsMobileMenuOpen(false)} mobile />
                  )}
                  <NavItem to="/employee/shifts" icon={<CalendarCheck />} label="シフト提出・履歴確認" onClick={() => setIsMobileMenuOpen(false)} mobile />
                </>
              )}
              <div className="border-t border-gray-200 my-4"></div>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                <LogOut className="h-5 w-5 mr-3" />
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 