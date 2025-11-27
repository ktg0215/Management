// Service Worker registration and management
export const registerServiceWorker = async () => {
  // Service Workerは現在無効化されています（sw.jsファイルが存在しないため）
  // 将来的にPWA機能が必要になった場合は、sw.jsファイルを作成して有効化してください
  // 404エラーを防ぐため、何も実行しない
  return;
    
    // 以下のコードは将来の実装用にコメントアウト
    /*
    const hostname = window.location.hostname;
    const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';

    if (!isProduction) {
      console.log('Service Worker is disabled in development environment');
      return;
    }

    try {
      const basePath = '/bb/';
      const registration = await navigator.serviceWorker.register(`${basePath}sw.js`, {
        scope: basePath,
      });

      console.log('Service Worker registered successfully:', registration);

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is installed and ready
              console.log('New service worker installed, prompting for update');
              promptForUpdate(registration);
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
    */
  }
};

const promptForUpdate = (registration: ServiceWorkerRegistration) => {
  if (confirm('新しいバージョンが利用可能です。更新しますか？')) {
    // Skip waiting and activate new service worker
    const newWorker = registration.waiting;
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          window.location.reload();
        }
      });
    }
  }
};

export const unregisterServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      console.log('Service Worker unregistered successfully');
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
    }
  }
};

// Cache management utilities
export const clearAllCaches = async () => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared');
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }
};

export const getCacheSize = async (): Promise<number> => {
  if ('caches' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    } catch (error) {
      console.error('Failed to estimate cache size:', error);
      return 0;
    }
  }
  return 0;
};
