import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';

interface VirtualizedTableProps<T> {
  data: T[];
  height: number;
  itemHeight: number;
  renderRow: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  renderHeader?: () => React.ReactNode;
  overscan?: number;
  className?: string;
}

export function VirtualizedTable<T>({
  data,
  height,
  itemHeight,
  renderRow,
  renderHeader,
  overscan = 5,
  className = '',
}: VirtualizedTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const visibleItems = useMemo(() => {
    const containerHeight = height;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      data.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return {
      startIndex,
      endIndex,
      items: data.slice(startIndex, endIndex + 1),
    };
  }, [data, height, itemHeight, scrollTop, overscan]);

  const totalHeight = data.length * itemHeight;
  const offsetY = visibleItems.startIndex * itemHeight;

  return (
    <div className={`relative ${className}`}>
      {renderHeader && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          {renderHeader()}
        </div>
      )}
      <div
        ref={scrollElementRef}
        style={{ height, overflow: 'auto' }}
        onScroll={handleScroll}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleItems.items.map((item, index) => {
              const actualIndex = visibleItems.startIndex + index;
              const style: React.CSSProperties = {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: itemHeight,
                transform: `translateY(${index * itemHeight}px)`,
              };
              
              return renderRow(item, actualIndex, style);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing virtualized table state
export function useVirtualizedTable<T>(data: T[], itemHeight: number) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  const visibleRange = useMemo(() => {
    const overscan = 5;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      data.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [data.length, itemHeight, scrollTop, containerHeight]);

  const scrollToIndex = useCallback((index: number) => {
    const targetScrollTop = index * itemHeight;
    setScrollTop(targetScrollTop);
  }, [itemHeight]);

  return {
    visibleRange,
    scrollTop,
    containerHeight,
    setScrollTop,
    setContainerHeight,
    scrollToIndex,
    totalHeight: data.length * itemHeight,
  };
}