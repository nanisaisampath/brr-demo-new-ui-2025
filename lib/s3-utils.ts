import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { validateEnvironment, getEnvVar } from './env-validation';
import { errorHandler, NetworkError, ValidationError } from './error-handler';

// Validate environment on module load
const envValidation = validateEnvironment();
if (!envValidation.config.aws.hasCredentials) {
  console.warn('⚠️  AWS credentials not found in environment variables');
}

// S3 client configuration with graceful degradation
let s3Client: S3Client;

try {
  s3Client = new S3Client({
    region: getEnvVar('AWS_REGION', 'us-east-1'),
    credentials: {
      accessKeyId: getEnvVar('AWS_ACCESS_KEY_ID', '', true),
      secretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY', '', true),
    },
    // Add timeout and retry configuration for better stability
    requestHandler: {
      requestTimeout: 30000,
      httpsAgent: {
        timeout: 30000,
      },
    },
  });
} catch (error) {
  errorHandler.handleError(
    new ValidationError('Failed to initialize S3 client', {
      component: 's3-utils',
      action: 'initialize',
      timestamp: new Date().toISOString(),
    }),
    'critical'
  );
  throw error;
}

export { s3Client };

// Types for S3 folder listing
export interface S3FolderResponse {
  folders: string[];
  files: string[];
  isTruncated: boolean;
  nextContinuationToken: string | null;
  keyCount: number;
}

export interface S3ListParams {
  prefix?: string;
  continuationToken?: string;
  maxKeys?: number;
}

/**
 * List S3 bucket folders and files with lazy loading support
 * @param bucketName - The S3 bucket name
 * @param params - Parameters for listing objects
 * @returns Promise<S3FolderResponse>
 */
export async function listS3Folders(
  bucketName: string,
  params: S3ListParams = {}
): Promise<S3FolderResponse> {
  const { prefix = '', continuationToken, maxKeys = 50 } = params;

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    const folders: string[] = [];
    const files: string[] = [];

    // Extract folders from CommonPrefixes
    if (response.CommonPrefixes) {
      response.CommonPrefixes.forEach((commonPrefix) => {
        if (commonPrefix.Prefix) {
          // Extract just the folder name from the full path
          // e.g., "folder1/subfolder2/" -> "subfolder2"
          const pathParts = commonPrefix.Prefix.split('/').filter(Boolean);
          const folderName = pathParts[pathParts.length - 1];
          if (folderName) {
            folders.push(folderName);
          }
        }
      });
    }

    // Extract files from Contents (show files at every level, not just root)
    if (response.Contents) {
      response.Contents.forEach((object) => {
        if (object.Key && !object.Key.endsWith('/')) {
          // For nested folders, we need to extract just the filename
          // e.g., "folder1/subfolder2/file.txt" -> "file.txt"
          const keyParts = object.Key.split('/');
          const fileName = keyParts[keyParts.length - 1];
          
          // Only add files that are direct children of the current prefix
          // This prevents showing files from deeper subfolders
          const relativePath = object.Key.slice(prefix.length);
          if (relativePath && !relativePath.includes('/')) {
            files.push(fileName);
          }
        }
      });
    }

    return {
      folders: folders.sort(),
      files: files.sort(),
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken || null,
      keyCount: response.KeyCount || 0,
    };
  } catch (error) {
    errorHandler.handleError(
      new NetworkError(`Failed to list S3 folders: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        component: 's3-utils',
        action: 'listS3Folders',
        bucketName,
        prefix,
        timestamp: new Date().toISOString(),
      }),
      'high'
    );
    throw error;
  }
}

/**
 * Validate S3 configuration from environment variables
 * @returns Object with validation results and enhanced error information
 */
export function validateS3Config() {
  const validation = validateEnvironment();
  
  // Filter for AWS-specific missing variables
  const awsMissingVars = validation.missingVars.filter(varName => 
    varName.startsWith('AWS_')
  );
  
  // Filter for AWS-specific invalid variables
  const awsInvalidVars = validation.invalidVars.filter(varName => 
    varName.startsWith('AWS_')
  );
  
  return {
    isValid: awsMissingVars.length === 0 && awsInvalidVars.length === 0,
    missingVars: awsMissingVars,
    invalidVars: awsInvalidVars,
    warnings: validation.warnings,
    config: validation.config.aws,
    // Legacy compatibility
    bucketName: validation.config.aws.bucketName,
    hasCredentials: validation.config.aws.hasCredentials,
  };
}
