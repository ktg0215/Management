'use client';

import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  loadTime: number;
  interactionTime?: number;
  memoryUsage?: number;
}

interface UsePerformanceMonitoringOptions {
  componentName?: string;
  logToConsole?: boolean;
  sendToAnalytics?: boolean;
}

export const usePerformanceMonitoring = (
  options: UsePerformanceMonitoringOptions = {}
) => {
  const {
    componentName = 'Unknown Component',
    logToConsole = process.env.NODE_ENV === 'development',
    sendToAnalytics = process.env.NODE_ENV === 'production',
  } = options;

  const renderStartTime = useRef<number>(performance.now());
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    loadTime: 0,
  });

  // Measure component render time
  useEffect(() => {
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;
    
    metricsRef.current.renderTime = renderTime;

    if (logToConsole) {
      console.log(`[Performance] ${componentName} render time: ${renderTime.toFixed(2)}ms`);
    }
  }, [componentName, logToConsole]);

  // Measure page load performance
  useEffect(() => {
    const measurePageLoad = () => {
      if (typeof window !== 'undefined' && window.performance) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
          const domContentLoadedTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
          
          metricsRef.current.loadTime = loadTime;
          
          if (logToConsole) {
            console.log(`[Performance] ${componentName} page load metrics:`, {
              loadTime: loadTime.toFixed(2) + 'ms',
              domContentLoadedTime: domContentLoadedTime.toFixed(2) + 'ms',
              firstContentfulPaint: getFirstContentfulPaint(),
              largestContentfulPaint: getLargestContentfulPaint(),
            });
          }

          // Send to analytics if enabled
          if (sendToAnalytics) {
            sendMetricsToAnalytics({
              componentName,
              renderTime: metricsRef.current.renderTime,
              loadTime,
              domContentLoadedTime,
            });
          }
        }
      }
    };

    // Wait for page load to complete
    if (document.readyState === 'complete') {
      measurePageLoad();
    } else {
      window.addEventListener('load', measurePageLoad);
      return () => window.removeEventListener('load', measurePageLoad);
    }
  }, [componentName, logToConsole, sendToAnalytics]);

  // Monitor memory usage
  useEffect(() => {
    const monitorMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize / 1048576; // Convert to MB
        
        metricsRef.current.memoryUsage = memoryUsage;
        
        if (logToConsole && memoryUsage > 50) { // Log if memory usage is high
          console.warn(`[Performance] ${componentName} high memory usage: ${memoryUsage.toFixed(2)}MB`);
        }
      }
    };

    monitorMemory();
    const interval = setInterval(monitorMemory, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [componentName, logToConsole]);

  // Measure user interactions
  const measureInteraction = (interactionName: string) => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const interactionTime = endTime - startTime;
      
      metricsRef.current.interactionTime = interactionTime;
      
      if (logToConsole) {
        console.log(`[Performance] ${componentName} ${interactionName} interaction: ${interactionTime.toFixed(2)}ms`);
      }

      if (sendToAnalytics) {
        sendInteractionToAnalytics({
          componentName,
          interactionName,
          interactionTime,
        });
      }
    };
  };

  return {
    metrics: metricsRef.current,
    measureInteraction,
  };
};

// Helper functions for Web Vitals
const getFirstContentfulPaint = (): number | null => {
  const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry;
  return fcpEntry ? fcpEntry.startTime : null;
};

const getLargestContentfulPaint = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lcpEntry = entries[entries.length - 1]; // Get the latest LCP entry
        resolve(lcpEntry ? lcpEntry.startTime : null);
        observer.disconnect();
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });

      // Timeout after 10 seconds
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 10000);
    } else {
      resolve(null);
    }
  });
};

// Analytics functions
const sendMetricsToAnalytics = (metrics: any) => {
  // This would typically send to your analytics service
  // For now, we'll just log it
  console.log('[Analytics] Performance metrics:', metrics);
  
  // Example: Send to Google Analytics 4
  // if (typeof gtag !== 'undefined') {
  //   gtag('event', 'performance_metrics', {
  //     component_name: metrics.componentName,
  //     render_time: metrics.renderTime,
  //     load_time: metrics.loadTime,
  //   });
  // }
};

const sendInteractionToAnalytics = (interaction: any) => {
  console.log('[Analytics] Interaction metrics:', interaction);
  
  // Example: Send to analytics service
  // if (typeof gtag !== 'undefined') {
  //   gtag('event', 'user_interaction', {
  //     component_name: interaction.componentName,
  //     interaction_name: interaction.interactionName,
  //     interaction_time: interaction.interactionTime,
  //   });
  // }
};

// Hook for measuring specific operations
export const useOperationTiming = () => {
  const startTiming = (operationName: string) => {
    const startTime = performance.now();
    
    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Timing] ${operationName}: ${duration.toFixed(2)}ms`);
        }
        
        return duration;
      },
    };
  };

  return { startTiming };
};