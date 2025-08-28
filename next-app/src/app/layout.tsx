"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ErrorBoundary } from "@/components/errorBoundary/ErrorBoundary";
import { OfflineDetector } from "@/components/offline/OfflineDetector";
import { registerServiceWorker } from "@/lib/serviceWorker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 認証状態の初期化
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
    
    // Register service worker for offline support
    if (typeof window !== 'undefined') {
      registerServiceWorker();
    }
  }, []); // 依存関係配列から checkAuth を削除し、マウント時に一度だけ実行

  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <QueryProvider>
            <OfflineDetector />
            {children}
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
