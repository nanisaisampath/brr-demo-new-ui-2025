// Comprehensive error handling utilities for improved application stability

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
}

export interface ErrorReport {
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'validation' | 'runtime' | 'async' | 'unknown';
}

export class AppError extends Error {
  public readonly context: ErrorContext;
  public readonly severity: ErrorReport['severity'];
  public readonly category: ErrorReport['category'];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    context: ErrorContext = {},
    severity: ErrorReport['severity'] = 'medium',
    category: ErrorReport['category'] = 'unknown',
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.context = context;
    this.severity = severity;
    this.category = category;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toReport(): ErrorReport {
    return {
      message: this.message,
      stack: this.stack,
      context: this.context,
      severity: this.severity,
      category: this.category,
    };
  }
}

export class NetworkError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, context, 'high', 'network');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, context, 'medium', 'validation');
  }
}

export class AsyncError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, context, 'high', 'async');
  }
}

// Error handler class for centralized error management
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 100;

  private constructor() {
    // Set up global error handlers
    this.setupGlobalHandlers();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(
          new AsyncError('Unhandled Promise Rejection', {
            component: 'global',
            action: 'unhandledrejection',
            timestamp: new Date().toISOString(),
          }),
          'critical'
        );
        event.preventDefault();
      });

      // Handle global errors
      window.addEventListener('error', (event) => {
        this.handleError(
          new AppError('Global Error', {
            component: 'global',
            action: 'error',
            timestamp: new Date().toISOString(),
            url: window.location.href,
          }),
          'critical'
        );
      });
    }
  }

  public handleError(
    error: Error | AppError,
    severity?: ErrorReport['severity'],
    context: ErrorContext = {}
  ): void {
    let errorReport: ErrorReport;

    if (error instanceof AppError) {
      errorReport = error.toReport();
    } else {
      errorReport = {
        message: error.message,
        stack: error.stack,
        context: {
          ...context,
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        },
        severity: severity || 'medium',
        category: this.categorizeError(error),
      };
    }

    // Add to queue
    this.addToQueue(errorReport);

    // Log based on severity
    this.logError(errorReport);

    // In production, you might want to send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.reportToService(errorReport);
    }
  }

  private categorizeError(error: Error): ErrorReport['category'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    if (message.includes('async') || message.includes('promise') || message.includes('await')) {
      return 'async';
    }
    
    return 'runtime';
  }

  private addToQueue(errorReport: ErrorReport): void {
    this.errorQueue.push(errorReport);
    
    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(-this.maxQueueSize);
    }
  }

  private logError(errorReport: ErrorReport): void {
    const logMessage = `[${errorReport.severity.toUpperCase()}] ${errorReport.message}`;
    
    switch (errorReport.severity) {
      case 'critical':
      case 'high':
        console.error(logMessage, errorReport);
        break;
      case 'medium':
        console.warn(logMessage, errorReport);
        break;
      case 'low':
        console.info(logMessage, errorReport);
        break;
    }
  }

  private reportToService(errorReport: ErrorReport): void {
    // In a real application, you would send this to your error reporting service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    console.log('Would report to error service:', errorReport);
  }

  public getErrorHistory(): ErrorReport[] {
    return [...this.errorQueue];
  }

  public clearErrorHistory(): void {
    this.errorQueue = [];
  }
}

// Utility functions for common error scenarios
export function handleAsyncError<T>(
  promise: Promise<T>,
  context: ErrorContext = {}
): Promise<T> {
  return promise.catch((error) => {
    const errorHandler = ErrorHandler.getInstance();
    errorHandler.handleError(
      new AsyncError(`Async operation failed: ${error.message}`, context),
      'high'
    );
    throw error;
  });
}

export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => R,
  context: ErrorContext = {}
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      const errorHandler = ErrorHandler.getInstance();
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        context
      );
      throw error;
    }
  };
}

export function withAsyncErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: ErrorContext = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorHandler = ErrorHandler.getInstance();
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'high',
        context
      );
      throw error;
    }
  };
}

// React hook for error handling
export function useErrorHandler() {
  const errorHandler = ErrorHandler.getInstance();
  
  return {
    handleError: (error: Error, context: ErrorContext = {}) => {
      errorHandler.handleError(error, 'medium', context);
    },
    handleAsyncError: <T>(promise: Promise<T>, context: ErrorContext = {}) => {
      return handleAsyncError(promise, context);
    },
    getErrorHistory: () => errorHandler.getErrorHistory(),
    clearErrorHistory: () => errorHandler.clearErrorHistory(),
  };
}

// Initialize error handler
export const errorHandler = ErrorHandler.getInstance();
