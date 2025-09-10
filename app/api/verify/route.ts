import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3Client, validateS3Config } from '@/lib/s3-utils';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { updateProgress, clearProgress } from '@/lib/progress-store';
import { ScanStatus, ScanResult } from '@/types/scan';

export async function POST(request: NextRequest) {
  // Generate session ID for progress tracking outside try block to avoid race conditions
  const sessionId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('Generated session ID:', sessionId);
  
  // Initialize progress immediately
  updateProgress(sessionId, {
    stage: 'initializing',
    message: 'Scan started, processing in background...',
    progress: 0
  });
  
  // Start the scanning process in the background
  processScanInBackground(request, sessionId).catch(error => {
    console.error('Background scan process failed:', error);
    updateProgress(sessionId, {
      stage: 'error',
      message: 'Background scan process failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  });
  
  // Return immediately with session ID for live progress tracking
  return NextResponse.json({
    success: true,
    sessionId,
    status: {
      stage: 'initializing',
      message: 'Scan started, processing in background...',
      progress: 0
    }
  });
}

async function processScanInBackground(request: NextRequest, sessionId: string) {
  try {
    // Validate S3 configuration
    const configValidation = validateS3Config();
    if (!configValidation.isValid) {
      const errorDetails = [];
      
      if (configValidation.missingVars.length > 0) {
        errorDetails.push(`Missing: ${configValidation.missingVars.join(', ')}`);
      }
      
      if (configValidation.invalidVars && configValidation.invalidVars.length > 0) {
        errorDetails.push(`Invalid: ${configValidation.invalidVars.join(', ')}`);
      }
      
      const errorStatus: ScanStatus = {
        stage: 'error',
        message: 'S3 configuration is incomplete',
        error: errorDetails.join('. ') || 'AWS credentials not properly configured'
      };
      updateProgress(sessionId, errorStatus);
      setTimeout(() => clearProgress(sessionId), 5000);
      return;
    }

    const body = await request.json();
    const { folderPath } = body;

    if (!folderPath) {
      const errorStatus: ScanStatus = {
        stage: 'error',
        message: 'Folder path is required',
        error: 'No folder path provided in request body'
      };
      updateProgress(sessionId, errorStatus);
      setTimeout(() => clearProgress(sessionId), 5000);
      return;
    }

    // Initialize status
    let currentStatus: ScanStatus = {
      stage: 'initializing',
      message: 'Starting batch folder scan...'
    };
    
    // Update progress store
    console.log('Updating progress for session:', sessionId, 'with status:', currentStatus);
    updateProgress(sessionId, currentStatus);

    console.log('Starting scan for folder:', folderPath);

    // Get bucket name from environment
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    
    // Prepare batch folder path
    const batchFolderPath = path.join(process.cwd(), 'classification', 'data', 'batch_brr-e2e');
    
    // Ensure batch folder exists and is clean
    if (fs.existsSync(batchFolderPath)) {
      fs.rmSync(batchFolderPath, { recursive: true, force: true });
    }
    fs.mkdirSync(batchFolderPath, { recursive: true });

    currentStatus = {
      stage: 'downloading',
      message: 'Downloading files from S3...',
      progress: 0
    };
    
    updateProgress(sessionId, currentStatus);

    // List all files in the specified S3 folder
    const prefix = folderPath.endsWith('/') ? folderPath : folderPath + '/';
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const files = listResponse.Contents?.filter(obj => !obj.Key?.endsWith('/')) || [];
    
    if (files.length === 0) {
      const errorStatus: ScanStatus = {
        stage: 'error',
        message: 'No files found in the specified folder',
        error: `No files found in S3 folder: ${folderPath}`
      };
      updateProgress(sessionId, errorStatus);
      setTimeout(() => clearProgress(sessionId), 5000);
      
      return NextResponse.json({
        success: false,
        status: errorStatus,
        sessionId
      } as ScanResult & { sessionId: string }, { status: 404 });
    }

    currentStatus.totalFiles = files.length;
    currentStatus.filesProcessed = 0;

    // Heartbeat to avoid perceived stalls while downloading
    let downloadHeartbeat: NodeJS.Timeout | null = setInterval(() => {
      updateProgress(sessionId, {
        ...currentStatus,
        message: currentStatus.message || 'Downloading files from S3...'
      })
    }, 2000)

    // Download each file with proper resource management
    const downloadPromises: Promise<void>[] = [];
    let processedCount = 0;
    const maxConcurrentDownloads = Number(process.env.MAX_CONCURRENT_DOWNLOADS || 3); // Limit concurrent downloads to prevent resource exhaustion
    
    for (let i = 0; i < files.length; i += maxConcurrentDownloads) {
      const batch = files.slice(i, i + maxConcurrentDownloads);
      
      const batchPromises = batch.map(async (file, batchIndex) => {
        if (!file.Key) return;
        
        const fileIndex = i + batchIndex;
        let writeStream: fs.WriteStream | null = null;
        let downloadTimeout: NodeJS.Timeout | null = null;
        
        try {
          // Update current file immediately for better UX
          const fileNamePre = path.basename(file.Key);
          updateProgress(sessionId, {
            ...currentStatus,
            currentFile: fileNamePre,
            message: `Downloading ${fileNamePre}...`
          });

          const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: file.Key,
          });

          // Set timeout for S3 request
          downloadTimeout = setTimeout(() => {
            throw new Error(`Download timeout for file: ${file.Key}`);
          }, 30000); // 30 second timeout

          const response = await s3Client.send(getCommand);
          
          if (downloadTimeout) {
            clearTimeout(downloadTimeout);
            downloadTimeout = null;
          }
          
          if (!response.Body) {
            console.warn(`Empty response body for file: ${file.Key}`);
            return;
          }

          // Get filename from S3 key
          const fileName = path.basename(file.Key);
          const localFilePath = path.join(batchFolderPath, fileName);

          // Use streaming with proper cleanup
          writeStream = fs.createWriteStream(localFilePath);
          
          // Handle stream errors
          writeStream.on('error', (error) => {
            console.error(`Write stream error for ${fileName}:`, error);
            throw error;
          });

          // Convert stream to buffer with size limits and stall watchdog
          const chunks: Uint8Array[] = [];
          let totalSize = 0;
          const maxFileSize = 100 * 1024 * 1024; // 100MB limit
          const bodyStream = response.Body as unknown as import('stream').Readable;
          let lastActivityAt = Date.now();
          const inactivityLimitMs = Number(process.env.DOWNLOAD_INACTIVITY_LIMIT_MS || 20000); // 20s without data
          const stallWatcher = setInterval(() => {
            if (Date.now() - lastActivityAt > inactivityLimitMs) {
              bodyStream.destroy(new Error(`Download stalled for file: ${fileName}`));
            }
          }, 2000);
          try {
            for await (const chunk of bodyStream as any) {
              lastActivityAt = Date.now();
              totalSize += chunk.length;
              if (totalSize > maxFileSize) {
                throw new Error(`File ${fileName} exceeds maximum size limit (100MB)`);
              }
              chunks.push(chunk);
            }
          } finally {
            clearInterval(stallWatcher);
          }
          
          const buffer = Buffer.concat(chunks);
          
          // Write to file with proper error handling
          await new Promise<void>((resolve, reject) => {
            writeStream!.write(buffer, (error) => {
              if (error) {
                reject(error);
              } else {
                writeStream!.end();
                resolve();
              }
            });
          });

          // Update progress using a shared, monotonic counter
          processedCount += 1;
          currentStatus.filesProcessed = processedCount;
          currentStatus.progress = Math.round((processedCount / files.length) * 50); // 50% for download phase
          currentStatus.message = `Downloaded ${processedCount}/${files.length} files`;
          currentStatus.currentFile = fileName;
          
          console.log(`Progress update: ${currentStatus.progress}% - ${currentStatus.message}`);
          updateProgress(sessionId, currentStatus);

          console.log(`Downloaded: ${fileName}`);
          
        } catch (error) {
          console.error(`Error downloading file ${file.Key}:`, error);
          
          // Update progress even on error, ensuring monotonic counter
          processedCount += 1;
          currentStatus.filesProcessed = processedCount;
          currentStatus.progress = Math.round((processedCount / files.length) * 50);
          currentStatus.message = `Error downloading ${file.Key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          updateProgress(sessionId, currentStatus);
          
          // Continue with other files even if one fails
        } finally {
          // Cleanup resources
          if (downloadTimeout) {
            clearTimeout(downloadTimeout);
          }
          if (writeStream && !writeStream.destroyed) {
            writeStream.destroy();
          }
        }
      });
      
      // Wait for current batch to complete before starting next batch
      await Promise.allSettled(batchPromises);
    }

    // Stop heartbeat after downloads
    if (downloadHeartbeat) {
      clearInterval(downloadHeartbeat);
      downloadHeartbeat = null;
    }

    // Update status for verification phase
    currentStatus = {
      stage: 'verifying',
      message: 'Running verification process...',
      progress: 75,
      // Do not show X/Y count during verification to avoid misleading 16/16
      filesProcessed: undefined,
      totalFiles: currentStatus.totalFiles,
      currentFile: 'Processing classification...',
    };
    
    console.log(`Progress update: ${currentStatus.progress}% - ${currentStatus.message}`); // Debug log
    updateProgress(sessionId, currentStatus);

    // Execute Python verification script
    const pythonScriptPath = path.join(process.cwd(), 'classification', 'verifyFiles.py');
    const classificationDir = path.join(process.cwd(), 'classification');
    const pythonExecutable = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');

    const verificationResult = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
        cwd: classificationDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      // Update progress during Python execution
      const progressInterval = setInterval(() => {
        const currentProgress = Math.min(75 + Math.random() * 20, 95); // Simulate progress from 75% to 95%
        const updatedStatus = {
          ...currentStatus,
          progress: Math.round(currentProgress),
          message: 'Processing files...',
          currentFile: 'Running classification analysis...'
        };
        console.log(`Progress update: ${updatedStatus.progress}% - ${updatedStatus.message}`); // Debug log
        updateProgress(sessionId, updatedStatus);
      }, 2000); // Update every 2 seconds

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python stdout:', data.toString());
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Python stderr:', data.toString());
      });

      pythonProcess.on('close', (code) => {
        clearInterval(progressInterval);
        
        if (code === 0) {
          // Python script completed successfully
          resolve({ success: true, data: null });
        } else {
          resolve({ success: false, error: `Python script failed with code ${code}: ${stderr}` });
        }
      });

      pythonProcess.on('error', (error) => {
        clearInterval(progressInterval);
        resolve({ success: false, error: `Failed to start Python process: ${error.message}` });
      });
    });

    if (verificationResult.success) {
      currentStatus = {
        stage: 'completed',
        message: 'Batch folder scan completed successfully',
        progress: 100,
        filesProcessed: currentStatus.filesProcessed,
        totalFiles: currentStatus.totalFiles,
        currentFile: 'Scan completed!'
      };
      
      updateProgress(sessionId, currentStatus);

      // Load the generated classification data from data_montage.json
      let classificationData = null;
      try {
        const dataMontagePath = path.join(process.cwd(), 'classification', 'data', 'ITSoli-BRR', 'data_montage.json');
        if (fs.existsSync(dataMontagePath)) {
          const rawData = fs.readFileSync(dataMontagePath, 'utf8');
          classificationData = JSON.parse(rawData);
          console.log('Successfully loaded classification data from:', dataMontagePath);
        } else {
          console.warn('Classification data file not found at:', dataMontagePath);
        }
      } catch (error) {
        console.error('Error loading classification data:', error);
      }

      console.log('Background scan completed successfully with sessionId:', sessionId);
      
      // Store the final results in progress data for the frontend to retrieve
      updateProgress(sessionId, {
        ...currentStatus,
        data: classificationData
      });
      
      // Keep progress data for 60 seconds to allow frontend to poll and get results
      setTimeout(() => clearProgress(sessionId), 60000);
    } else {
      currentStatus = {
        stage: 'error',
        message: 'Verification process failed',
        error: verificationResult.error,
        filesProcessed: currentStatus.filesProcessed,
        totalFiles: currentStatus.totalFiles,
        currentFile: 'Verification failed'
      };
      
      updateProgress(sessionId, currentStatus);
      setTimeout(() => clearProgress(sessionId), 30000);
    }

  } catch (error) {
    console.error('Error in batch folder scan:', error);
    
    const errorStatus: ScanStatus = {
      stage: 'error',
      message: 'An unexpected error occurred during scanning',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    // Use the existing sessionId to maintain consistency
    try {
      updateProgress(sessionId, errorStatus);
      setTimeout(() => clearProgress(sessionId), 5000);
    } catch (progressError) {
      console.error('Failed to update progress in error handler:', progressError);
    }
  }
}

// GET endpoint for checking scan status (if needed for real-time updates)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const outputPath = searchParams.get('outputPath');
    
    if (!outputPath) {
      return NextResponse.json({ error: 'Output path required' }, { status: 400 });
    }

    const fullPath = path.join(process.cwd(), outputPath);
    
    if (fs.existsSync(fullPath)) {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      return NextResponse.json({ success: true, data });
    } else {
      return NextResponse.json({ success: false, error: 'Output file not found' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}