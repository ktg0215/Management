// Frontend optimization utilities

// Debounce function for input handling
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
};

// Throttle function for scroll/resize events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Memoization utility
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  getKey?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map();
  
  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    return result;
  }) as T;
};

// Lazy loading utility for images
export const lazyLoadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver | null => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }
  
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  });
};

// Virtual scrolling utility
export class VirtualScrollManager {
  private itemHeight: number;
  private containerHeight: number;
  private itemCount: number;
  private scrollTop: number = 0;
  private buffer: number = 3;
  
  constructor(itemHeight: number, containerHeight: number, itemCount: number) {
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
    this.itemCount = itemCount;
  }
  
  updateScrollTop(scrollTop: number) {
    this.scrollTop = scrollTop;
  }
  
  getVisibleRange(): { start: number; end: number; totalHeight: number } {
    const visibleItemCount = Math.ceil(this.containerHeight / this.itemHeight);
    const start = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
    const end = Math.min(
      this.itemCount - 1,
      start + visibleItemCount + this.buffer * 2
    );
    
    return {
      start,
      end,
      totalHeight: this.itemCount * this.itemHeight,
    };
  }
}

// Performance measurement utilities
export const measurePerformance = (name: string) => {
  if (typeof performance === 'undefined') {
    return { end: () => 0 };
  }
  
  const startTime = performance.now();
  
  return {
    end: (): number => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    },
  };
};

// Bundle splitting utilities
export const loadChunk = async (chunkName: string) => {
  try {
    const chunk = await import(`@/chunks/${chunkName}`);
    return chunk.default || chunk;
  } catch (error) {
    console.error(`Failed to load chunk: ${chunkName}`, error);
    throw error;
  }
};

// Resource preloading
export const preloadResource = (href: string, as: string) => {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
};

// Critical resource preloading
export const preloadCriticalResources = () => {
  if (typeof document === 'undefined') return;
  
  // Preload critical fonts
  preloadResource('/fonts/inter-var.woff2', 'font');
  
  // Preload critical images
  preloadResource('/icons/icon-192x192.png', 'image');
};

// Image optimization utilities
export const getOptimizedImageUrl = (
  src: string,
  width: number,
  height?: number,
  quality = 80
): string => {
  // This would integrate with your image optimization service
  // For now, return the original URL
  return src;
  
  // Example with Next.js Image Optimization API:
  // const params = new URLSearchParams({
  //   url: src,
  //   w: width.toString(),
  //   q: quality.toString(),
  //   ...(height && { h: height.toString() }),
  // });
  // return `/_next/image?${params.toString()}`;
};

// Memory management utilities
export const cleanupEventListeners = (
  element: Element | Window,
  events: Array<{ type: string; listener: EventListener; options?: AddEventListenerOptions }>
) => {
  events.forEach(({ type, listener, options }) => {
    element.removeEventListener(type, listener, options);
  });
};

// Request batching utility
export class RequestBatcher {
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private batchTimeout: number = 10; // ms
  private maxBatchSize: number = 10;
  
  constructor(batchTimeout = 10, maxBatchSize = 10) {
    this.batchTimeout = batchTimeout;
    this.maxBatchSize = maxBatchSize;
  }
  
  async batchRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    batchKey?: string
  ): Promise<T> {
    const requestKey = batchKey || key;
    
    // Return existing promise if request is already pending
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }
    
    // Create and store the promise
    const promise = new Promise<T>((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.pendingRequests.delete(requestKey);
        }
      }, this.batchTimeout);
    });
    
    this.pendingRequests.set(requestKey, promise);
    
    return promise;
  }
}

// Create global request batcher instance
export const globalRequestBatcher = new RequestBatcher();

// Error retry utility with exponential backoff
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Local storage with error handling
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  
  clear: (): boolean => {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};

// Session storage with error handling
export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  
  clear: (): boolean => {
    try {
      sessionStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};