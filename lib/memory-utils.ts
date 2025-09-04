// Memory management utilities to prevent memory leaks and improve stability

import { useEffect, useRef, useCallback } from 'react';

// Utility for cleaning up resources
export class ResourceManager {
  private resources: Set<() => void> = new Set();
  private timers: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();
  private abortControllers: Set<AbortController> = new Set();

  public addCleanup(cleanup: () => void): void {
    this.resources.add(cleanup);
  }

  public addTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer);
  }

  public addInterval(interval: NodeJS.Timeout): void {
    this.intervals.add(interval);
  }

  public addAbortController(controller: AbortController): void {
    this.abortControllers.add(controller);
  }

  public cleanup(): void {
    // Clean up all resources
    this.resources.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error during resource cleanup:', error);
      }
    });
    this.resources.clear();

    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    // Abort all controllers
    this.abortControllers.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        console.warn('Error aborting controller:', error);
      }
    });
    this.abortControllers.clear();
  }
}

// Hook for managing cleanup in React components
export function useResourceManager(): ResourceManager {
  const managerRef = useRef<ResourceManager>();

  if (!managerRef.current) {
    managerRef.current = new ResourceManager();
  }

  useEffect(() => {
    return () => {
      managerRef.current?.cleanup();
    };
  }, []);

  return managerRef.current;
}

// Hook for managing timers with automatic cleanup
export function useTimer() {
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  const setTimeout = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
    const timer = global.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  const setInterval = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
    const interval = global.setInterval(callback, delay);
    timersRef.current.add(interval);
    return interval;
  }, []);

  const clearTimer = useCallback((timer: NodeJS.Timeout): void => {
    clearTimeout(timer);
    timersRef.current.delete(timer);
  }, []);

  const clearInterval = useCallback((interval: NodeJS.Timeout): void => {
    global.clearInterval(interval);
    timersRef.current.delete(interval);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => {
        clearTimeout(timer);
        global.clearInterval(timer);
      });
      timersRef.current.clear();
    };
  }, []);

  return {
    setTimeout,
    setInterval,
    clearTimer,
    clearInterval,
  };
}

// Hook for managing AbortController with automatic cleanup
export function useAbortController() {
  const controllersRef = useRef<Set<AbortController>>(new Set());

  const createController = useCallback((): AbortController => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    return controller;
  }, []);

  const abortController = useCallback((controller: AbortController): void => {
    try {
      controller.abort();
    } catch (error) {
      console.warn('Error aborting controller:', error);
    }
    controllersRef.current.delete(controller);
  }, []);

  const abortAll = useCallback((): void => {
    controllersRef.current.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        console.warn('Error aborting controller:', error);
      }
    });
    controllersRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      abortAll();
    };
  }, [abortAll]);

  return {
    createController,
    abortController,
    abortAll,
  };
}

// Hook for managing event listeners with automatic cleanup
export function useEventListener<T extends keyof WindowEventMap>(
  event: T,
  handler: (event: WindowEventMap[T]) => void,
  element: Window | Document | Element = window,
  options?: boolean | AddEventListenerOptions
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const eventHandler = (event: WindowEventMap[T]) => {
      handlerRef.current(event);
    };

    element.addEventListener(event, eventHandler, options);

    return () => {
      element.removeEventListener(event, eventHandler, options);
    };
  }, [event, element, options]);
}

// Hook for managing intersection observers with automatic cleanup
export function useIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(callback, options);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [callback, options]);

  return observerRef.current;
}

// Hook for managing resize observers with automatic cleanup
export function useResizeObserver(
  callback: ResizeObserverCallback,
  options?: ResizeObserverOptions
) {
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    observerRef.current = new ResizeObserver(callback);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [callback]);

  return observerRef.current;
}

// Utility for debouncing with cleanup
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const { setTimeout, clearTimer } = useTimer();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimer(timer);
  }, [value, delay, setTimeout, clearTimer]);

  return debouncedValue;
}

// Utility for throttling with cleanup
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecuted = useRef<number>(Date.now());
  const { setTimeout, clearTimer } = useTimer();

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted.current;

    if (timeSinceLastExecution >= delay) {
      setThrottledValue(value);
      lastExecuted.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastExecuted.current = Date.now();
      }, delay - timeSinceLastExecution);

      return () => clearTimer(timer);
    }
  }, [value, delay, setTimeout, clearTimer]);

  return throttledValue;
}

// Utility for preventing memory leaks in large lists
export function useVirtualization<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop,
  };
}

// Utility for managing large data sets with pagination
export function usePagination<T>(
  items: T[],
  itemsPerPage: number = 10
) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items.slice(startIndex, endIndex);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  return {
    currentItems,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
}

// Import useState for the hooks above
import { useState } from 'react';
