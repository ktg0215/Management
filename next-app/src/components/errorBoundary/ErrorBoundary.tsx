'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  retryCount: number;
  maxRetries: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the optional error callback
    this.props.onError?.(error, errorInfo);

    // Send error to monitoring service (if available)
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    const { children } = this.props;
    const { hasError } = this.state;
    
    // If we had an error and now we have different children, reset the error boundary
    if (hasError && prevProps.children !== children) {
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }
  }

  componentWillUnmount() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  private reportError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Here you would typically send the error to a monitoring service
    // like Sentry, LogRocket, or your own logging system
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
        url: typeof window !== 'undefined' ? window.location.href : '',
      };
      
      // Example: Send to your logging endpoint
      // fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData),
      // }).catch(console.error);
      
      console.error('Error reported:', errorData);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private resetError = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1,
    }));
  };

  private autoRetry = () => {
    const maxRetries = this.props.maxRetries ?? 3;
    
    if (this.state.retryCount < maxRetries) {
      this.timeoutId = setTimeout(() => {
        this.resetError();
      }, 2000 + this.state.retryCount * 1000); // Exponential backoff
    }
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback: Fallback, maxRetries = 3 } = this.props;

    if (hasError && error) {
      // Use custom fallback component if provided
      if (Fallback) {
        return (
          <Fallback
            error={error}
            resetError={this.resetError}
            retryCount={retryCount}
            maxRetries={maxRetries}
          />
        );
      }

      // Default error fallback
      return (
        <DefaultErrorFallback
          error={error}
          resetError={this.resetError}
          retryCount={retryCount}
          maxRetries={maxRetries}
        />
      );
    }

    return children;
  }
}

// Default error fallback component
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  retryCount,
  maxRetries,
}) => {
  const canRetry = retryCount < maxRetries;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-lg rounded-lg p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 text-red-500">
            <AlertTriangle className="w-full h-full" />
          </div>
          
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            問題が発生しました
          </h1>
          
          <p className="text-gray-600 mb-4">
            申し訳ございません。予期しないエラーが発生しました。
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-4 p-3 bg-gray-50 rounded text-left text-sm">
              <summary className="cursor-pointer font-medium mb-2">
                エラー詳細 (開発モード)
              </summary>
              <pre className="whitespace-pre-wrap text-xs text-red-600">
                {error.message}
                {'\n\n'}
                {error.stack}
              </pre>
            </details>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            {canRetry && (
              <button
                onClick={resetError}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                再試行 ({maxRetries - retryCount} 回まで)
              </button>
            )}
            
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              ホームに戻る
            </button>
          </div>
          
          {!canRetry && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                最大再試行回数に達しました。ページを再読み込みするか、管理者にお問い合わせください。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Higher-order component for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Hook for handling errors in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);
  
  const resetError = React.useCallback(() => {
    setError(null);
  }, []);
  
  const throwError = React.useCallback((error: Error) => {
    setError(error);
  }, []);
  
  // Throw error in render phase to be caught by error boundary
  if (error) {
    throw error;
  }
  
  return { throwError, resetError };
};