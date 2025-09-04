// Stability configuration for the application

export interface StabilityConfig {
  // Error handling
  errorHandling: {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    enableGlobalErrorHandling: boolean;
    enableErrorReporting: boolean;
  };
  
  // Memory management
  memory: {
    maxCacheSize: number;
    cleanupInterval: number;
    enableMemoryMonitoring: boolean;
    maxHistorySize: number;
  };
  
  // Network
  network: {
    requestTimeout: number;
    maxConcurrentRequests: number;
    enableRequestDeduplication: boolean;
    retryOnNetworkError: boolean;
  };
  
  // Performance
  performance: {
    enableVirtualization: boolean;
    enableLazyLoading: boolean;
    debounceDelay: number;
    throttleDelay: number;
  };
  
  // Development
  development: {
    enableDebugLogging: boolean;
    enablePerformanceMonitoring: boolean;
    enableMemoryLeakDetection: boolean;
  };
}

// Default stability configuration
export const defaultStabilityConfig: StabilityConfig = {
  errorHandling: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    enableGlobalErrorHandling: true,
    enableErrorReporting: process.env.NODE_ENV === 'production',
  },
  
  memory: {
    maxCacheSize: 100,
    cleanupInterval: 60000, // 1 minute
    enableMemoryMonitoring: true,
    maxHistorySize: 50,
  },
  
  network: {
    requestTimeout: 30000,
    maxConcurrentRequests: 10,
    enableRequestDeduplication: true,
    retryOnNetworkError: true,
  },
  
  performance: {
    enableVirtualization: true,
    enableLazyLoading: true,
    debounceDelay: 300,
    throttleDelay: 100,
  },
  
  development: {
    enableDebugLogging: process.env.NODE_ENV === 'development',
    enablePerformanceMonitoring: process.env.NODE_ENV === 'development',
    enableMemoryLeakDetection: process.env.NODE_ENV === 'development',
  },
};

// Environment-specific configurations
export const getStabilityConfig = (): StabilityConfig => {
  const baseConfig = { ...defaultStabilityConfig };
  
  // Override based on environment
  if (process.env.NODE_ENV === 'production') {
    baseConfig.errorHandling.maxRetries = 2;
    baseConfig.errorHandling.retryDelay = 2000;
    baseConfig.network.requestTimeout = 20000;
    baseConfig.performance.debounceDelay = 500;
    baseConfig.performance.throttleDelay = 200;
  } else if (process.env.NODE_ENV === 'test') {
    baseConfig.errorHandling.maxRetries = 1;
    baseConfig.errorHandling.retryDelay = 100;
    baseConfig.network.requestTimeout = 5000;
    baseConfig.performance.debounceDelay = 0;
    baseConfig.performance.throttleDelay = 0;
  }
  
  return baseConfig;
};

// Configuration validation
export function validateStabilityConfig(config: StabilityConfig): boolean {
  const errors: string[] = [];
  
  if (config.errorHandling.maxRetries < 0 || config.errorHandling.maxRetries > 10) {
    errors.push('maxRetries must be between 0 and 10');
  }
  
  if (config.errorHandling.retryDelay < 100 || config.errorHandling.retryDelay > 10000) {
    errors.push('retryDelay must be between 100ms and 10s');
  }
  
  if (config.errorHandling.timeout < 1000 || config.errorHandling.timeout > 120000) {
    errors.push('timeout must be between 1s and 2m');
  }
  
  if (config.memory.maxCacheSize < 10 || config.memory.maxCacheSize > 1000) {
    errors.push('maxCacheSize must be between 10 and 1000');
  }
  
  if (config.network.requestTimeout < 1000 || config.network.requestTimeout > 120000) {
    errors.push('requestTimeout must be between 1s and 2m');
  }
  
  if (config.network.maxConcurrentRequests < 1 || config.network.maxConcurrentRequests > 50) {
    errors.push('maxConcurrentRequests must be between 1 and 50');
  }
  
  if (errors.length > 0) {
    console.error('Stability configuration validation failed:', errors);
    return false;
  }
  
  return true;
}

// Get validated configuration
export function getValidatedStabilityConfig(): StabilityConfig {
  const config = getStabilityConfig();
  
  if (!validateStabilityConfig(config)) {
    console.warn('Using default configuration due to validation failure');
    return defaultStabilityConfig;
  }
  
  return config;
}

// Export the validated configuration as default
export const stabilityConfig = getValidatedStabilityConfig();
