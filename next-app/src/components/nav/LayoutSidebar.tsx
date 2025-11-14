"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useStoreStore } from "@/stores/storeStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { User, LogOut, Clock, CalendarCheck, BarChart3, TrendingUp, PieChart, CreditCard, Building, Users, UserPlus, Building2, FileText, Menu, ChevronLeft, Receipt } from "lucide-react";
import { NavItem } from "@/components/nav/NavItem";

export const LayoutSidebar: React.FC = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { stores } = useStoreStore();
  const { isCollapsed, isHydrated, toggleSidebar } = useSidebarStore();
  const [isClient, setIsClient] = useState(false);
  const storeName = user?.storeId ? stores.find(store => store.id === user.storeId)?.name : '';

  // Use isHydrated to prevent hydration mismatch
  const actualCollapsed = isHydrated && isClient ? isCollapsed : false;

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
      // エラーが発生してもログインページに移動
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

  const getRoleBadge = () => {
    if (!user) return null;
    const roleColors = {
      'user': 'bg-blue-100 text-blue-800',
      'admin': 'bg-green-100 text-green-800',
      'super_admin': 'bg-purple-100 text-purple-800'
    };
    const roleLabels = {
      'user': '従業員',
      'admin': '管理者',
      'super_admin': 'スーパー管理者'
    };
    return (
      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${roleColors[user.role]}`}>
        {roleLabels[user.role]}
      </span>
    );
  };

  // Don't render sidebar until client-side hydration is complete
  if (!isClient) {
    return (
      <aside 
        className="hidden md:flex md:flex-col transition-all duration-300 border-r border-gray-200 bg-white shadow-lg"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          height: '100vh',
          width: '256px',
          zIndex: 1000,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <div className="h-16 flex items-center border-b border-gray-200 bg-white px-4">
          <div className="animate-pulse">
            <div className="h-6 w-6 bg-gray-200 rounded"></div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside 
      className="hidden md:flex md:flex-col transition-all duration-300 border-r border-gray-200 bg-white shadow-lg"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        height: '100vh',
        width: actualCollapsed ? '64px' : '256px',
        zIndex: 1000,
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: isClient ? 'width 0.3s ease' : 'none'
      }}
    >
      <div className="h-16 flex items-center border-b border-gray-200 bg-white px-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          {actualCollapsed ? (
            <Menu className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          )}
        </button>
        {!actualCollapsed && (
          <>
            {getRoleIcon()}
            <span className="ml-2 text-lg font-semibold">
              シフト提出システム
              {getRoleBadge()}
            </span>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        {!actualCollapsed && (
          <div className="px-4 py-4">
            <div className="flex flex-col items-start p-3 bg-blue-50 rounded-lg">
              {storeName && (
                <div className="text-xs text-gray-500 mb-1">{storeName}</div>
              )}
              <div className="flex items-center">
                <User className="h-5 w-5 text-blue-700" />
                <span className="ml-2 font-medium">ユーザー</span>
              </div>
            </div>
          </div>
        )}
        <div className="px-2 space-y-1 py-4">
          {/* Admin-specific navigation items */}
          {isClient && user && (user.role === 'admin' || user.role === 'super_admin') && (
            <>
              <NavItem to="/admin/dashboard" icon={<Clock />} label="ダッシュボード" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/shifts" icon={<CalendarCheck />} label="シフト管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/sales-management" icon={<BarChart3 />} label="売上管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/monthly-sales" icon={<TrendingUp />} label="月次売上管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/yearly-progress" icon={<PieChart />} label="損益管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/payments" icon={<Receipt />} label="支払い管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/companies" icon={<CreditCard />} label="取引先管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/business-types" icon={<Building2 />} label="業態管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/stores" icon={<Building />} label="店舗管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/employees" icon={<Users />} label="従業員管理" isCollapsed={actualCollapsed} />
              <NavItem to="/admin/add-admin" icon={<UserPlus />} label="管理者追加" isCollapsed={actualCollapsed} />
            </>
          )}
          {/* Employee-specific navigation items - only shown to regular users */}
          {isClient && user?.role === 'user' && (
            <>
              <NavItem to="/employee/shifts" icon={<CalendarCheck />} label="シフト提出" isCollapsed={actualCollapsed} />
            </>
          )}
        </div>
      </div>
      <div className="p-4 border-t border-gray-200 bg-white">
        <button
          onClick={handleLogout}
          className={`flex items-center w-full py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors ${
            actualCollapsed ? 'px-2 justify-center' : 'px-4'
          }`}
          title={actualCollapsed ? "ログアウト" : ""}
        >
          <LogOut className="h-5 w-5" />
          {!actualCollapsed && (
            <span className="ml-3">ログアウト</span>
          )}
        </button>
      </div>
    </aside>
  );
}; 