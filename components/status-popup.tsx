"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Download, FileText, CheckCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StatusPopupProps {
  isVisible: boolean
  currentFile?: string
  status: 'downloading' | 'processing' | 'completed' | 'idle'
  progress?: number
  onClose?: () => void
}

export default function StatusPopup({ 
  isVisible, 
  currentFile, 
  status, 
  progress = 0,
  onClose 
}: StatusPopupProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true)
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  if (!isAnimating && !isVisible) return null

  const getStatusIcon = () => {
    switch (status) {
      case 'downloading':
        return <Download className="w-4 h-4 text-blue-600 animate-pulse" />
      case 'processing':
        return <FileText className="w-4 h-4 text-purple-600 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      default:
        return <FileText className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'downloading':
        return currentFile ? `Downloading: ${currentFile}` : 'Downloading files...'
      case 'processing':
        return currentFile ? `Processing: ${currentFile}` : 'Processing files...'
      case 'completed':
        return 'Processing completed'
      default:
        return 'Preparing...'
    }
  }

  const getProgressColor = () => {
    if (progress < 30) return 'bg-blue-500'
    if (progress < 70) return 'bg-yellow-500'
    if (progress < 95) return 'bg-orange-500'
    return 'bg-green-500'
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      
      {/* Pop-up */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <Card 
          className={`w-full max-w-md shadow-2xl border-0 transform transition-all duration-300 ${
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
                <h3 className="font-medium text-gray-900">
                  File Processing
                </h3>
              </div>
              {onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
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
            </div>

            {/* Progress bar */}
            {status !== 'completed' && (
              <div className="space-y-2">
                <div className="relative">
                  <Progress 
                    value={progress} 
                    className="h-3 bg-gray-100"
                  />
                  <div 
                    className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-300 ${getProgressColor()}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="font-medium">{Math.round(progress)}% complete</span>
                  <span className="capitalize font-medium">{status}</span>
                </div>
                {progress > 0 && (
                  <div className="text-xs text-gray-400 text-center">
                    {progress < 30 && "Initializing..."}
                    {progress >= 30 && progress < 70 && "Downloading files..."}
                    {progress >= 70 && progress < 95 && "Processing data..."}
                    {progress >= 95 && "Finalizing..."}
                  </div>
                )}
              </div>
            )}

            {/* Completion message */}
            {status === 'completed' && (
              <div className="text-center py-2">
                <p className="text-sm text-green-600 font-medium">
                  All files processed successfully
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}