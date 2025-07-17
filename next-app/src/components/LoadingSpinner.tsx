import { Clock } from 'lucide-react';

const LoadingSpinner = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
      <div className="flex justify-center items-center mb-4">
        <Clock className="animate-spin h-6 w-6 text-blue-600 mr-3" />
        <span className="text-lg text-gray-700">読み込み中...</span>
      </div>
    </div>
  );
};

export default LoadingSpinner;