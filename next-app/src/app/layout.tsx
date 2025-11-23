import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ErrorBoundary } from "@/components/errorBoundary/ErrorBoundary";
import { OfflineDetector } from "@/components/offline/OfflineDetector";
import { ClientLayout } from "./ClientLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "シフト管理システム",
  description: "店舗シフト管理システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/bb/manifest.json" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <QueryProvider>
            <OfflineDetector />
            <ClientLayout>{children}</ClientLayout>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
