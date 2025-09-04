// Shared types for scan operations

export interface ScanStatus {
  stage: 'initializing' | 'downloading' | 'verifying' | 'completed' | 'error';
  message: string;
  progress?: number;
  filesProcessed?: number;
  totalFiles?: number;
  currentFile?: string;
  error?: string;
}

export interface ScanResult {
  success: boolean;
  status: ScanStatus;
  data?: any;
  outputPath?: string;
}

// Additional scan-related types
export interface FileAnalysis {
  found: string[];
  expected: string[];
  missing: string[];
}

export interface S3Folder {
  id: string;
  name: string;
  path: string;
  fileCount?: number;
  lastModified?: string;
  size?: string;
}