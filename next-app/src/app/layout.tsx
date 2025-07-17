"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 認証状態の初期化
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, []); // 依存関係配列から checkAuth を削除し、マウント時に一度だけ実行

  return (
    <html lang="ja">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
