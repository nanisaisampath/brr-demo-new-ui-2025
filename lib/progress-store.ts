// Shared progress store for tracking scan progress across API routes

export interface ProgressData {
  stage: 'initializing' | 'downloading' | 'verifying' | 'completed' | 'error';
  message: string;
  progress?: number;
  filesProcessed?: number;
  totalFiles?: number;
  currentFile?: string;
  error?: string;
  data?: any; // Store final results when completed
  timestamp: number;
}

// In-memory storage for progress tracking
// In production, you'd use Redis or a database
// Use a global variable to ensure singleton behavior
declare global {
  var __progressStore: Map<string, ProgressData> | undefined;
}

const progressStore = globalThis.__progressStore ?? new Map<string, ProgressData>();
if (!globalThis.__progressStore) {
  globalThis.__progressStore = progressStore;
}

// Track cleanup interval to prevent memory leaks
let cleanupInterval: NodeJS.Timeout | null = null;

// Cleanup stale sessions (older than 10 minutes)
function cleanupStaleProgress() {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes
  let cleanedCount = 0;
  
  for (const [sessionId, data] of progressStore.entries()) {
    if (now - data.timestamp > maxAge) {
      progressStore.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} stale progress sessions`);
  }
  
  // If no sessions remain, clear the cleanup interval to prevent memory leak
  if (progressStore.size === 0 && cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('Stopped cleanup interval - no active sessions');
  }
}

// Start cleanup interval only when needed
function ensureCleanupInterval() {
  if (!cleanupInterval && progressStore.size > 0) {
    cleanupInterval = setInterval(cleanupStaleProgress, 5 * 60 * 1000); // 5 minutes
    console.log('Started cleanup interval for progress tracking');
  }
}

export function updateProgress(sessionId: string, progress: Omit<ProgressData, 'timestamp'>) {
  // Validate sessionId to prevent injection attacks
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
    console.warn('Invalid session ID provided to updateProgress');
    return;
  }
  
  const progressData = {
    ...progress,
    timestamp: Date.now()
  };
  
  // Only log significant progress updates to reduce noise
  if (progress.stage === 'completed' || progress.stage === 'error' || progress.progress === 0) {
    console.log('Progress store: Setting progress for session:', sessionId, 'stage:', progress.stage, 'progress:', progress.progress + '%');
  }
  progressStore.set(sessionId, progressData);
  
  // Ensure cleanup interval is running when we have active sessions
  ensureCleanupInterval();
}

export function getProgress(sessionId: string): ProgressData | undefined {
  const result = progressStore.get(sessionId);
  // Only log when no result found to reduce noise
  if (!result) {
    console.log('Progress store: No progress found for session:', sessionId);
  }
  return result;
}

export function clearProgress(sessionId: string) {
  if (!sessionId || typeof sessionId !== 'string') {
    return;
  }
  
  const deleted = progressStore.delete(sessionId);
  
  if (deleted) {
    console.log(`Cleared progress for session: ${sessionId}`);
  }
  
  // If this was the last session, stop the cleanup interval
  if (progressStore.size === 0 && cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('Stopped cleanup interval - no remaining sessions');
  }
}
