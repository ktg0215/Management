"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { registerServiceWorker } from "@/lib/serviceWorker";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const setSidebarHydrated = useSidebarStore((state) => state.setHydrated);

  useEffect(() => {
    // Manually trigger hydration for all stores
    useAuthStore.persist.rehydrate();
    useSidebarStore.persist.rehydrate();

    // Mark sidebar as hydrated
    setSidebarHydrated();

    // Mark as hydrated
    setIsHydrated(true);

    // Check auth after hydration
    checkAuth();

    // Service Worker registration is disabled (sw.js not found)
    // if (typeof window !== 'undefined') {
    //   registerServiceWorker();
    // }
  }, []); // 依存関係配列から checkAuth を削除し、マウント時に一度だけ実行

  return <>{children}</>;
}
