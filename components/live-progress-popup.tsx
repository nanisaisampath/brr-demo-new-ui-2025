"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Download, FileText, CheckCircle, X, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScanStatus } from "@/types/scan"

interface LiveProgressPopupProps {
  isVisible: boolean
  sessionId?: string
  onClose?: () => void
  onComplete?: (data: any) => void
}

export default function LiveProgressPopup({ 
  isVisible, 
  sessionId,
  onClose,
  onComplete
}: LiveProgressPopupProps) {
  const [progress, setProgress] = useState<ScanStatus | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const lastTimestampRef = useRef<number | null>(null)
  const stagnantPollsRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Start/stop polling based on visibility and sessionId
  useEffect(() => {
    if (isVisible && sessionId) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      stopPolling()
    }
  }, [isVisible, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animation effect
  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true)
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  const startPolling = () => {
    if (pollingIntervalRef.current) return // Already polling
    
    // Create new abort controller for this polling session
    abortControllerRef.current = new AbortController()
    
    const poll = async () => {
      if (!sessionId || !abortControllerRef.current) return
      
      try {
        const response = await fetch(`/api/verify/progress?sessionId=${sessionId}&_=${Date.now()}` , {
          signal: abortControllerRef.current.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.stage === 'idle') {
          // No active scan
          setProgress(null)
          return
        }
        
        // Detect stagnant/stalled progress responses
        if (typeof data.timestamp === 'number') {
          if (lastTimestampRef.current === data.timestamp) {
            stagnantPollsRef.current += 1
          } else {
            stagnantPollsRef.current = 0
            lastTimestampRef.current = data.timestamp
          }
        }

        // If we have received the same progress for a while, hint a transient issue
        if (stagnantPollsRef.current >= 8 && data.stage !== 'completed' && data.stage !== 'error') {
          setError('Progress appears stalled. Retrying...')
        } else {
          setError(null)
        }

        setProgress(data)
        setError(null)
        setRetryCount(0) // Reset retry count on successful response
        
        // Check if scan is completed
        if (data.stage === 'completed') {
          // Add a small delay to show completion message, then stop polling and close
          setTimeout(() => {
            stopPolling()
            if (onComplete) {
              onComplete({
                success: true,
                data: data.data,
                status: data
              })
            }
            if (onClose) {
              onClose()
            }
          }, 2000) // Keep success visible briefly before auto-dismiss
        } else if (data.stage === 'error') {
          stopPolling()
          setError(data.error || 'An error occurred during scanning')
        }
        
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, this is expected
          return
        }
        
        console.error('Error polling progress:', err)
        // Increment retry count and only show error after multiple failures using functional updater
        setRetryCount((prev) => {
          const next = prev + 1
          if (next >= 3) {
            setError('Connection lost. Please check your network connection.')
          } else if (next >= 1) {
            setError(`Connection lost. Retrying... (${next}/3)`)
          }
          return next
        })
      }
    }
    
    // Poll immediately, then every 1 second
    poll()
    const interval = setInterval(poll, 1000)
    pollingIntervalRef.current = interval
  }

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  if (!isAnimating && !isVisible) return null

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="w-5 h-5 text-red-600" />
    if (!progress) return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
    
    switch (progress.stage) {
      case 'initializing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
      case 'downloading':
        return <Download className="w-5 h-5 text-blue-600 animate-pulse" />
      case 'verifying':
        return <FileText className="w-5 h-5 text-purple-600 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <FileText className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusText = () => {
    if (error) return 'Scan failed'
    if (!progress) return 'Connecting to scan service...'
    
    return progress.message || 'Processing...'
  }

  const getProgressColor = () => {
    if (error) return 'bg-red-500'
    if (!progress) return 'bg-gray-400'
    
    const progressValue = progress.progress || 0
    if (progressValue < 30) return 'bg-blue-500'
    if (progressValue < 70) return 'bg-yellow-500'
    if (progressValue < 95) return 'bg-orange-500'
    return 'bg-green-500'
  }

  const getDetailedInfo = () => {
    if (!progress) return null
    
    const info = []
    
    if (
      progress.stage !== 'verifying' &&
      progress.filesProcessed !== undefined &&
      progress.totalFiles !== undefined
    ) {
      info.push(`${progress.filesProcessed}/${progress.totalFiles} files processed`)
    }
    
    if (progress.currentFile) {
      info.push(`Current: ${progress.currentFile}`)
    }
    
    return info.length > 0 ? info.join(' • ') : null
  }

  const handleClose = () => {
    stopPolling()
    if (onClose) {
      onClose()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      
      {/* Pop-up */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <Card 
          className={`w-full max-w-lg shadow-2xl border-0 transform transition-all duration-300 ${
            isVisible 
              ? 'scale-100 opacity-100 translate-y-0' 
              : 'scale-95 opacity-0 translate-y-4'
          }`}
        >
          <CardContent className="p-6">
            {/* Header with close button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <h3 className="font-semibold text-gray-900">
                  Live File Scanning
                </h3>
              </div>
              {onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Status text */}
            <div className="mb-4">
              <p className="text-sm text-gray-700 font-medium">
                {getStatusText()}
              </p>
              {getDetailedInfo() && (
                <p className="text-xs text-gray-500 mt-1">
                  {getDetailedInfo()}
                </p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700 mb-2">
                  {error}
                </p>
                {error.includes('Connection lost') && retryCount < 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError(null)
                      setRetryCount(0)
                      startPolling()
                    }}
                    className="text-red-600 border-red-300 hover:bg-red-100"
                  >
                    Retry Connection
                  </Button>
                )}
              </div>
            )}

            {/* Progress bar */}
            {!error && progress && progress.stage !== 'completed' && (
              <div className="space-y-3">
                <div className="relative">
                  <Progress 
                    value={progress.progress || 0} 
                    className="h-3 bg-gray-100"
                  />
                  <div 
                    className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-500 ${getProgressColor()}`}
                    style={{ width: `${progress.progress || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="font-medium">{Math.round(progress.progress || 0)}% complete</span>
                  <span className="capitalize font-medium">{progress.stage}</span>
                </div>
                {(progress.progress || 0) > 0 && (
                  <div className="text-xs text-gray-400 text-center">
                                    {progress.stage === 'initializing' && "Setting up scan environment..."}
                {progress.stage === 'downloading' && "Downloading files from S3..."}
                {progress.stage === 'verifying' && "Running classification analysis..."}
                {progress.stage === 'completed' && "Scan completed successfully!"}
                  </div>
                )}
              </div>
            )}

            {/* Completion message */}
            {progress && progress.stage === 'completed' && (
              <div className="text-center py-4">
                <div className="mb-2">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                </div>
                <p className="text-sm text-green-600 font-medium">
                  Scan completed successfully!
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {progress.filesProcessed} files processed
                </p>
              </div>
            )}

            {/* Session ID for debugging */}
            {sessionId && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">
                  Session: {sessionId}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
