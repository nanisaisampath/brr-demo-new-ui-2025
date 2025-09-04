// Utilities for handling async operations with proper cleanup and error handling

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorHandler, AsyncError, handleAsyncError } from './error-handler';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retryCount: number;
}

export interface AsyncOptions {
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

// Hook for managing async operations with automatic cleanup
export function useAsyncOperation<T>(
  asyncFn: () => Promise<T>,
  dependencies: any[] = [],
  options: AsyncOptions = {}
) {
  const {
    retryCount = 3,
    retryDelay = 1000,
    timeout = 30000,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const execute = useCallback(async () => {
    // Cancel any existing operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      // Set timeout
      timeoutRef.current = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, timeout);

      const result = await handleAsyncError(
        asyncFn(),
        {
          component: 'useAsyncOperation',
          action: 'execute',
          timestamp: new Date().toISOString(),
        }
      );

      if (!abortControllerRef.current.signal.aborted) {
        setState(prev => ({
          ...prev,
          data: result,
          loading: false,
          error: null,
          retryCount: 0,
        }));

        onSuccess?.(result);
      }
    } catch (error) {
      if (!abortControllerRef.current.signal.aborted) {
        const err = error instanceof Error ? error : new Error(String(error));
        
        setState(prev => ({
          ...prev,
          loading: false,
          error: err,
        }));

        onError?.(err);

        // Handle retry logic
        if (state.retryCount < retryCount) {
          retryTimeoutRef.current = setTimeout(() => {
            setState(prev => ({
              ...prev,
              retryCount: prev.retryCount + 1,
            }));
            execute();
          }, retryDelay);
        }
      }
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [asyncFn, retryCount, retryDelay, timeout, onSuccess, onError, state.retryCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Execute when dependencies change
  useEffect(() => {
    execute();
  }, dependencies);

  const retry = useCallback(() => {
    setState(prev => ({
      ...prev,
      retryCount: 0,
      error: null,
    }));
    execute();
  }, [execute]);

  return {
    ...state,
    execute,
    retry,
  };
}

// Utility for creating abortable fetch requests
export function createAbortableFetch(
  url: string,
  options: RequestInit = {},
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

// Utility for handling multiple async operations
export function useAsyncBatch<T>(
  operations: (() => Promise<T>)[],
  options: AsyncOptions = {}
) {
  const [state, setState] = useState<{
    results: (T | Error)[];
    loading: boolean;
    completed: number;
    total: number;
  }>({
    results: [],
    loading: false,
    completed: 0,
    total: operations.length,
  });

  const execute = useCallback(async () => {
    setState(prev => ({
      ...prev,
      loading: true,
      completed: 0,
      results: [],
    }));

    const results: (T | Error)[] = [];

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await handleAsyncError(
          operations[i](),
          {
            component: 'useAsyncBatch',
            action: 'execute',
            operationIndex: i,
            timestamp: new Date().toISOString(),
          }
        );
        results.push(result);
      } catch (error) {
        results.push(error instanceof Error ? error : new Error(String(error)));
      }

      setState(prev => ({
        ...prev,
        completed: i + 1,
        results: [...results],
      }));
    }

    setState(prev => ({
      ...prev,
      loading: false,
    }));

    return results;
  }, [operations]);

  return {
    ...state,
    execute,
  };
}

// Utility for debounced async operations
export function useDebouncedAsync<T>(
  asyncFn: (value: T) => Promise<any>,
  delay: number = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedExecute = useCallback((value: T) => {
    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    return new Promise((resolve, reject) => {
      timeoutRef.current = setTimeout(async () => {
        try {
          const result = await handleAsyncError(
            asyncFn(value),
            {
              component: 'useDebouncedAsync',
              action: 'debouncedExecute',
              timestamp: new Date().toISOString(),
            }
          );
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }, [asyncFn, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return debouncedExecute;
}

// Utility for handling race conditions
export function useRaceConditionSafe<T>(
  asyncFn: () => Promise<T>,
  dependencies: any[] = []
) {
  const requestIdRef = useRef<number>(0);
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
  });

  const execute = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const result = await handleAsyncError(
        asyncFn(),
        {
          component: 'useRaceConditionSafe',
          action: 'execute',
          requestId,
          timestamp: new Date().toISOString(),
        }
      );

      // Only update state if this is still the latest request
      if (requestId === requestIdRef.current) {
        setState(prev => ({
          ...prev,
          data: result,
          loading: false,
          error: null,
        }));
      }
    } catch (error) {
      // Only update state if this is still the latest request
      if (requestId === requestIdRef.current) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState(prev => ({
          ...prev,
          loading: false,
          error: err,
        }));
      }
    }
  }, [asyncFn]);

  useEffect(() => {
    execute();
  }, dependencies);

  return {
    ...state,
    execute,
  };
}
