import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isCollapsed: boolean;
  isHydrated: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setHydrated: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      isHydrated: false,
      toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setSidebarCollapsed: (collapsed: boolean) => set({ isCollapsed: collapsed }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'sidebar-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
); 