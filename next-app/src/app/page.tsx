"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // ハイドレーション完了を待つ
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // ハイドレーション完了前は何もしない
    if (!isHydrated) return;

    // ローディング中は何もしない（無限リダイレクトを防ぐ）
    if (isLoading) return;

    // 認証済みの場合は適切なダッシュボードにリダイレクト
    if (isAuthenticated) {
      if (isAdmin()) {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/employee/dashboard");
      }
    } else {
      // 未認証の場合のみログインページにリダイレクト
      router.replace("/login");
    }
  }, [router, isAuthenticated, isLoading, isAdmin, isHydrated]);

  // ハイドレーション完了前またはローディング中は読み込み画面を表示
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return null;
}
