"use client"

import React, { useState, useEffect, ReactNode } from 'react'
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { errorHandler, AsyncError } from '@/lib/error-handler'

interface AsyncErrorBoundaryProps {
  children: ReactNode
  onRetry?: () => void
  error?: Error | null
  isLoading?: boolean
  fallback?: ReactNode
}

export function AsyncErrorBoundary({
  children,
  onRetry,
  error,
  isLoading,
  fallback
}: AsyncErrorBoundaryProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Check initial state
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1)
      
      // Log retry attempt
      if (error) {
        errorHandler.handleError(
          new AsyncError(`Retry attempt ${retryCount + 1} for failed operation`, {
            component: 'AsyncErrorBoundary',
            action: 'retry',
            timestamp: new Date().toISOString(),
          }),
          'low'
        )
      }
      
      onRetry?.()
    }
  }

  const getErrorType = (error: Error) => {
    const message = error.message.toLowerCase()
    
    if (message.includes('fetch') || message.includes('network')) {
      return 'network'
    }
    if (message.includes('timeout') || message.includes('aborted')) {
      return 'timeout'
    }
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'auth'
    }
    if (message.includes('403') || message.includes('forbidden')) {
      return 'permission'
    }
    if (message.includes('404') || message.includes('not found')) {
      return 'notfound'
    }
    if (message.includes('500') || message.includes('server')) {
      return 'server'
    }
    
    return 'unknown'
  }

  const getErrorMessage = (error: Error) => {
    const errorType = getErrorType(error)
    
    switch (errorType) {
      case 'network':
        return isOnline 
          ? 'Network connection failed. Please check your internet connection.'
          : 'You appear to be offline. Please check your internet connection.'
      case 'timeout':
        return 'The request timed out. The server might be busy or your connection is slow.'
      case 'auth':
        return 'Authentication failed. Please check your credentials.'
      case 'permission':
        return 'You do not have permission to access this resource.'
      case 'notfound':
        return 'The requested resource was not found.'
      case 'server':
        return 'Server error occurred. Please try again later.'
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }

  const getErrorIcon = (error: Error) => {
    const errorType = getErrorType(error)
    
    switch (errorType) {
      case 'network':
        return isOnline ? <Wifi className="h-6 w-6 text-red-600" /> : <WifiOff className="h-6 w-6 text-red-600" />
      default:
        return <AlertCircle className="h-6 w-6 text-red-600" />
    }
  }

  if (error) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="p-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              {getErrorIcon(error)}
            </div>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Request Failed
            </CardTitle>
            <CardDescription className="text-gray-600">
              {getErrorMessage(error)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isOnline && (
              <Alert>
                <WifiOff className="h-4 w-4" />
                <AlertDescription>
                  You are currently offline. Please check your internet connection and try again.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex flex-col gap-2">
              {onRetry && retryCount < maxRetries && (
                <Button
                  onClick={handleRetry}
                  disabled={isLoading || !isOnline}
                  className="w-full"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Retrying...' : `Retry ${retryCount > 0 ? `(${retryCount}/${maxRetries})` : ''}`}
                </Button>
              )}
              
              {retryCount >= maxRetries && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Maximum retry attempts reached. Please refresh the page or try again later.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Error Details (Development)
                </summary>
                <div className="mt-2 rounded-md bg-gray-50 p-3">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                    {error.toString()}
                    {error.stack && `\n\nStack trace:\n${error.stack}`}
                  </pre>
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

export default AsyncErrorBoundary