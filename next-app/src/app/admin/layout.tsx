"use client";
import React from "react";
import { LayoutSidebar } from "@/components/nav/LayoutSidebar";
import { LayoutMobileHeader } from "@/components/nav/LayoutMobileHeader";
import { useSidebarStore } from "@/stores/sidebarStore";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isHydrated } = useSidebarStore();
  const [isClient, setIsClient] = React.useState(false);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Use consistent default for SSR
  const actualCollapsed = isHydrated ? isCollapsed : false;
  const marginLeft = isClient ? (actualCollapsed ? '64px' : '256px') : '0px';
  
  return (
    <div className="min-h-screen bg-gray-50">
      <LayoutMobileHeader />
      <LayoutSidebar />
      <main 
        className={`main-content-with-sidebar transition-all duration-300 min-h-screen ${
          actualCollapsed ? 'sidebar-collapsed' : ''
        }`}
        style={{
          marginLeft: marginLeft,
          transition: 'margin-left 0.3s ease',
          minHeight: '100vh'
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}