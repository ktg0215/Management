'use client';

import React from 'react';
import { WifiOff, RefreshCw, Home } from 'lucide-react';

const OfflinePage = () => {
  const handleRetry = () => {
    window.location.reload();
  };

  const goHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 text-gray-400">
            <WifiOff className="w-full h-full" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            オフラインです
          </h1>
          
          <p className="text-gray-600 mb-6">
            インターネット接続がありません。ネットワーク設定を確認し、もう一度お試しください。
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              再読み込み
            </button>
            
            <button
              onClick={goHome}
              className="w-full flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
            >
              <Home className="w-5 h-5 mr-2" />
              ホームページに戻る
            </button>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              オフラインでも利用可能な機能
            </h3>
            <ul className="text-sm text-blue-700 text-left space-y-1">
              <li>• 過去に閲覧したデータの表示</li>
              <li>• データ入力（オンライン復旧時に同期）</li>
              <li>• ローカルに保存されたドラフト</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflinePage;