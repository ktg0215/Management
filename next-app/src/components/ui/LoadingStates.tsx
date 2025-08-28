import React from 'react';
import { Loader2, TrendingUp, Database } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text, 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      {text && <p className="mt-2 text-sm text-gray-600">{text}</p>}
    </div>
  );
};

export const TableSkeleton: React.FC = () => (
  <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
      <div className="h-6 bg-gray-200 rounded animate-pulse w-64"></div>
    </div>
    <div className="overflow-x-auto">
      <div className="min-w-[2000px]">
        {/* Header skeleton */}
        <div className="bg-gray-50 border-b border-gray-200 p-3">
          <div className="flex space-x-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
            ))}
          </div>
        </div>
        
        {/* Row skeletons */}
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div key={rowIndex} className="border-b border-gray-100 p-3">
            <div className="flex space-x-4">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-12"></div>
              <div className="h-4 bg-gray-100 rounded animate-pulse w-16"></div>
              {Array.from({ length: 20 }).map((_, colIndex) => (
                <div key={colIndex} className="h-4 bg-gray-100 rounded animate-pulse w-20"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const FormSkeleton: React.FC = () => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
      {/* Header skeleton */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="h-6 bg-white/20 rounded animate-pulse w-32"></div>
              <div className="h-4 bg-white/20 rounded animate-pulse w-24 mt-2"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Form content skeleton */}
      <div className="flex-1 overflow-y-auto p-8">
        {Array.from({ length: 5 }).map((_, categoryIndex) => (
          <div key={categoryIndex} className="mb-8">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-48 mb-4"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, fieldIndex) => (
                <div key={fieldIndex} className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                  <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer skeleton */}
      <div className="bg-gray-50 px-8 py-6 rounded-b-2xl border-t border-gray-200">
        <div className="flex justify-end space-x-4">
          <div className="h-10 bg-gray-200 rounded-xl animate-pulse w-24"></div>
          <div className="h-10 bg-blue-200 rounded-xl animate-pulse w-20"></div>
        </div>
      </div>
    </div>
  </div>
);

export const DataLoadingState: React.FC<{ message?: string }> = ({ 
  message = "データを読み込み中..." 
}) => (
  <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
    <div className="flex items-center space-x-3 mb-4">
      <Database className="h-8 w-8 text-blue-600" />
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
    <p className="text-gray-600 text-lg font-medium">{message}</p>
    <div className="mt-4 w-64">
      <div className="bg-blue-200 h-1 rounded-full overflow-hidden">
        <div className="bg-blue-600 h-full rounded-full animate-pulse w-3/4"></div>
      </div>
    </div>
  </div>
);

export const ErrorState: React.FC<{ 
  message?: string; 
  onRetry?: () => void; 
}> = ({ 
  message = "データの読み込みに失敗しました", 
  onRetry 
}) => (
  <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border border-red-200">
    <div className="text-red-500 text-6xl mb-4">⚠️</div>
    <p className="text-gray-800 text-lg font-medium mb-2">{message}</p>
    <p className="text-gray-600 text-sm mb-6">しばらく待ってから再試行してください</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        再試行
      </button>
    )}
  </div>
);