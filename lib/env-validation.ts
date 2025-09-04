// Environment variable validation and configuration management

export interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
  invalidVars: string[];
  warnings: string[];
  config: {
    aws: {
      region: string;
      bucketName?: string;
      hasCredentials: boolean;
      credentialsSource: 'env' | 'none';
    };
    app: {
      nodeEnv: string;
      isDevelopment: boolean;
      isProduction: boolean;
    };
  };
}

export interface EnvVar {
  name: string;
  required: boolean;
  defaultValue?: string;
  validator?: (value: string) => boolean;
  description: string;
}

// Define all environment variables with their requirements
const ENV_VARS: EnvVar[] = [
  {
    name: 'AWS_ACCESS_KEY_ID',
    required: true,
    description: 'AWS Access Key ID for S3 operations',
    validator: (value) => value.length >= 16 && value.length <= 128
  },
  {
    name: 'AWS_SECRET_ACCESS_KEY',
    required: true,
    description: 'AWS Secret Access Key for S3 operations',
    validator: (value) => value.length >= 40
  },
  {
    name: 'AWS_S3_BUCKET_NAME',
    required: true,
    description: 'S3 bucket name for file operations',
    validator: (value) => /^[a-z0-9.-]{3,63}$/.test(value)
  },
  {
    name: 'AWS_REGION',
    required: false,
    defaultValue: 'us-east-1',
    description: 'AWS region for S3 operations',
    validator: (value) => /^[a-z0-9-]+$/.test(value)
  },
  {
    name: 'NODE_ENV',
    required: false,
    defaultValue: 'development',
    description: 'Node.js environment mode',
    validator: (value) => ['development', 'production', 'test'].includes(value)
  }
];

/**
 * Comprehensive environment variable validation
 * @returns Detailed validation results with configuration
 */
export function validateEnvironment(): EnvValidationResult {
  const missingVars: string[] = [];
  const invalidVars: string[] = [];
  const warnings: string[] = [];

  // Check each environment variable
  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    
    if (!value) {
      if (envVar.required) {
        missingVars.push(envVar.name);
      } else if (!envVar.defaultValue) {
        warnings.push(`Optional variable ${envVar.name} is not set`);
      }
    } else {
      // Validate the value if validator is provided
      if (envVar.validator && !envVar.validator(value)) {
        invalidVars.push(envVar.name);
      }
    }
  }

  // Check for common configuration issues
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      warnings.push('Production environment detected but AWS credentials may be missing');
    }
  }

  // Build configuration object
  const config = {
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      bucketName: process.env.AWS_S3_BUCKET_NAME,
      hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      credentialsSource: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? 'env' as const : 'none' as const
    },
    app: {
      nodeEnv,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production'
    }
  };

  return {
    isValid: missingVars.length === 0 && invalidVars.length === 0,
    missingVars,
    invalidVars,
    warnings,
    config
  };
}

/**
 * Get environment variable with fallback and validation
 * @param name Environment variable name
 * @param defaultValue Default value if not set
 * @param required Whether the variable is required
 * @returns The environment variable value or default
 */
export function getEnvVar(
  name: string,
  defaultValue?: string,
  required: boolean = false
): string {
  const value = process.env[name];
  
  if (!value) {
    if (required) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return defaultValue || '';
  }
  
  return value;
}

/**
 * Check if the application is running in a specific environment
 * @param env Environment to check for
 * @returns Boolean indicating if running in specified environment
 */
export function isEnvironment(env: 'development' | 'production' | 'test'): boolean {
  return (process.env.NODE_ENV || 'development') === env;
}

/**
 * Get a formatted error message for missing environment variables
 * @param missingVars Array of missing variable names
 * @returns Formatted error message with setup instructions
 */
export function getEnvErrorMessage(missingVars: string[]): string {
  if (missingVars.length === 0) return '';
  
  const varList = missingVars.map(v => `  - ${v}`).join('\n');
  
  return `Missing required environment variables:\n${varList}\n\nPlease create a .env file in your project root with these variables.\nSee env.example for reference.`;
}

/**
 * Log environment validation results
 * @param validation Validation results to log
 */
export function logEnvValidation(validation: EnvValidationResult): void {
  if (validation.isValid) {
    console.log('✅ Environment validation passed');
  } else {
    console.error('❌ Environment validation failed');
    
    if (validation.missingVars.length > 0) {
      console.error('Missing variables:', validation.missingVars.join(', '));
    }
    
    if (validation.invalidVars.length > 0) {
      console.error('Invalid variables:', validation.invalidVars.join(', '));
    }
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Warnings:', validation.warnings.join(', '));
  }
}