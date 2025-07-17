"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  mobile?: boolean;
  onClick?: () => void;
  isActive?: boolean;
  isCollapsed?: boolean;
}

export const NavItem: React.FC<NavItemProps> = ({ to, icon, label, mobile = false, onClick, isActive, isCollapsed = false }) => {
  const pathname = usePathname();
  const active = isActive !== undefined ? isActive : pathname === to;
  return (
    <Link
      href={to}
      className={`flex items-center py-${mobile ? '3' : '2'} rounded-lg transition-all duration-200 group ${
        active 
          ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-500 font-medium' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } ${isCollapsed ? 'px-2 justify-center' : 'px-4'}`}
      onClick={onClick}
      title={isCollapsed ? label : ''}
    >
      <span className={`h-5 w-5 transition-colors ${
        active ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
      } ${isCollapsed ? '' : 'mr-3'}`}>
        {icon}
      </span>
      {!isCollapsed && (
      <span className="font-medium">{label}</span>
      )}
    </Link>
  );
}; 