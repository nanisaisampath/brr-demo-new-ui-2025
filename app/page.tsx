"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, PanelLeft, PanelLeftClose, FileText, Download, AlertCircle, Trash2, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import S3Browser, { S3BrowserOnSelect } from "@/components/s3-browser"
import ClassificationResults from "@/components/classification-results"
import LiveProgressPopup from "@/components/live-progress-popup"
// import { GenerateDataMontageFixed } from "@/components/generate-data-montage-fixed"
import { ScanStatus, ScanResult, FileAnalysis, S3Folder } from "@/types/scan"
import { useResourceManager, useTimer } from "@/lib/memory-utils"
import { useErrorHandler } from "@/lib/error-handler"

function getDefaultAnalysis(): FileAnalysis {
  // Generate different file types for each scan to ensure fresh data
  const allFileTypes = ["DOCX", "PDF", "XLSX", "PNG", "JPG", "TXT", "CSV", "PPTX", "ZIP", "XML"]
  const shuffledTypes = [...allFileTypes].sort(() => Math.random() - 0.5)
  const simulatedFileTypes = shuffledTypes.slice(0, Math.floor(Math.random() * 4) + 3) // 3-6 random types
  
  const expectedTypes = ["DOCX", "PDF", "XLSX", "PNG", "JPG"]
  const missingTypes = expectedTypes.filter((t) => !simulatedFileTypes.includes(t))
  return { found: simulatedFileTypes, expected: expectedTypes, missing: missingTypes }
}

export default function LandingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resourceManager = useResourceManager()
  const { setTimeout, clearTimer } = useTimer()
  const { handleError, handleAsyncError } = useErrorHandler()
  
  const [selectedFolder, setSelectedFolder] = useState<S3Folder | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [hasScannedInSession, setHasScannedInSession] = useState(false)
  const [hasAnalysisData, setHasAnalysisData] = useState(false)
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showLiveProgress, setShowLiveProgress] = useState(false)
  

  
  // Preserve S3 browser state when sidebar is hidden/shown
  const [s3BrowserState, setS3BrowserState] = useState<{
    currentPath: string
    history: string[]
    historyIndex: number
  }>({
    currentPath: "/",
    history: ["/"],
    historyIndex: 0
  })

  // Handle smooth scrolling to table when navigating from analyze page
  useEffect(() => {
    const analyzedId = searchParams.get('analyzedId')
    if (analyzedId) {
      // Mark that user has scanned in this session when returning from analysis
      setHasScannedInSession(true)
      // Small delay to ensure the page and components are fully rendered
      const timer = setTimeout(() => {
        try {
          const tableElement = document.getElementById('classification-results-table')
          if (tableElement) {
            tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        } catch (error) {
          handleError(error instanceof Error ? error : new Error('Scroll error'), {
            component: 'LandingPage',
            action: 'scrollToTable',
            timestamp: new Date().toISOString(),
          })
        }
      }, 300)
      
      resourceManager.addTimer(timer)
      return () => clearTimer(timer)
    }
  }, [searchParams, resourceManager, clearTimer, handleError])

  // Restore analysis data and S3 browser state on page load
  useEffect(() => {
    try {
      // Check if we're returning from analysis page (has analyzedId param)
      const analyzedId = searchParams.get('analyzedId')
      const isReturningFromAnalysis = !!analyzedId
      
      // Check if we have active analysis data in localStorage
      const hasActiveAnalysis = localStorage.getItem("brr:analysis:active") === "true"
      
      // Check if analysis has been permanently completed
      const isAnalysisCompleted = localStorage.getItem("brr:analysis:completed") === "true"
      
      // Check if we have any analysis data at all
      const hasAnalysisData = !!localStorage.getItem("brr:analysis:data")
      
      // Only restore data if we're explicitly returning from analysis OR have an active analysis session
      // This prevents the table from showing on fresh page loads
      if (isReturningFromAnalysis || (hasActiveAnalysis && hasAnalysisData)) {
        // Restore analysis data when we have clear indication that analysis was performed
        const storedAnalysisData = localStorage.getItem("brr:analysis:data")
        if (storedAnalysisData) {
          try {
            const parsedAnalysis = JSON.parse(storedAnalysisData) as FileAnalysis
            setAnalysis(parsedAnalysis)
            setHasAnalysisData(true)
            setHasScannedInSession(true)
            // Ensure the active flag is set when we restore data
            localStorage.setItem("brr:analysis:active", "true")
          } catch (error) {
            console.warn('Failed to parse analysis data from localStorage:', error)
            localStorage.removeItem("brr:analysis:data")
          }
        }
      } else {
        // On fresh runs, clear any stale data and reset state
        setAnalysis(null)
        setHasAnalysisData(false)
        setHasScannedInSession(false)
        setScanError(null)
        setScanStatus(null)
        // Clear stale localStorage data on fresh runs
        localStorage.removeItem("brr:analysis:active")
        localStorage.removeItem("brr:analysis:data")
        localStorage.removeItem("brr:analysis:completed")
        localStorage.removeItem("analyzedDocs")
      }
      
      // Restore S3 browser state
      const savedS3State = localStorage.getItem("brr:s3:browserState")
      if (savedS3State) {
        try {
          const parsedS3State = JSON.parse(savedS3State)
          setS3BrowserState(parsedS3State)
        } catch (error) {
          console.warn('Failed to parse S3 browser state from localStorage:', error)
          // Clear corrupted data
          localStorage.removeItem("brr:s3:browserState")
        }
      }
    } catch {
      // ignore parsing errors
    }
  }, [searchParams])
  

  
  const goToChecklist = () => {
    router.push("/checklist")
  }

  const goToSummary = () => {
    // TODO: Implement summary functionality
    alert("Generate Summary functionality will be implemented soon!")
  }



  const onSelectFromBrowser: S3BrowserOnSelect = (folder) => {
    setSelectedFolder({
      id: folder.id,
      name: folder.name,
      path: folder.path,
      fileCount: folder.fileCount,
      lastModified: folder.lastModified,
      size: folder.size,
    })
  }

  // Handle S3 browser state changes and persist to localStorage
  const onS3BrowserStateChange = useCallback((newState: {
    currentPath: string
    history: string[]
    historyIndex: number
  }) => {
    setS3BrowserState(newState)
    try {
      localStorage.setItem("brr:s3:browserState", JSON.stringify(newState))
    } catch {
      // ignore localStorage errors
    }
  }, [])

  // Clear all cache and localStorage data
  const clearAllCache = useCallback(() => {
    try {
      // Clear all localStorage data
      localStorage.clear()
      
      // Reset all state
      setAnalysis(null)
      setHasScannedInSession(false)
      setHasAnalysisData(false)
      setSelectedFolder(null)
      setScanError(null)
      setScanStatus(null)
      setS3BrowserState({
        currentPath: "/",
        history: ["/"],
        historyIndex: 0
      })
      
      // Force page reload to ensure clean state
      window.location.reload()
    } catch (error) {
      console.warn('Failed to clear cache:', error)
    }
  }, [])

  const analyzeFolder = async () => {
    if (!selectedFolder) return
    
    // Clear previous analysis data before starting new scan
    setAnalysis(null)
    setHasScannedInSession(false)
    setHasAnalysisData(false)
    setScanStatus(null)
    setScanError(null)
    setCurrentSessionId(null)
    
    // Clear localStorage data
    try {
      localStorage.removeItem("brr:analysis:active")
      localStorage.removeItem("brr:analysis:data")
      localStorage.removeItem("analyzedDocs")
      // Clear analysis button data for each new scan
      localStorage.removeItem("brr:analysis:buttonData")
    } catch {
      // ignore
    }
    
    setIsAnalyzing(true)
    setShowLiveProgress(true)
    
    try {
      // Call the new batch scanning API
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderPath: selectedFolder.path.startsWith('/') ? selectedFolder.path.slice(1) : selectedFolder.path
        })
      })
      
      const result: ScanResult & { sessionId?: string } = await response.json()
      
      if (result.sessionId) {
        setCurrentSessionId(result.sessionId)
      }
      
      // The API now returns immediately, so we just wait for the live progress popup
      // to handle the completion via the onComplete callback
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred'
      setScanError(errorMessage)
      setScanStatus({
        stage: 'error',
        message: 'Failed to connect to scanning service',
        error: errorMessage
      })
      setShowLiveProgress(false)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Reset session state when needed (e.g., when user wants to start fresh)
  const resetSession = useCallback(() => {
    setAnalysis(null)
    setHasScannedInSession(false)
    setHasAnalysisData(false)
    setSelectedFolder(null)
    setScanError(null)
    setScanStatus(null)
    setCurrentSessionId(null)
    setShowLiveProgress(false)
    // Reset S3 browser state to initial state
    setS3BrowserState({
      currentPath: "/",
      history: ["/"],
      historyIndex: 0
    })
    
    try {
      localStorage.removeItem("brr:analysis:active")
      localStorage.removeItem("brr:analysis:data")
      localStorage.removeItem("brr:analysis:completed")
      localStorage.removeItem("brr:scan:rawData")
      localStorage.removeItem("analyzedDocs")
      localStorage.removeItem("brr:s3:browserState")
      localStorage.removeItem("brr:analysis:buttonData")
      localStorage.removeItem("currentDocId")
      localStorage.removeItem("brr:lastAnalyzedAt")
    } catch {
      // ignore
    }
  }, [])

  // Handle live progress popup completion
  const handleProgressComplete = (result: any) => {
    if (result.success && result.data) {
      // Convert the Python output to our expected format
      const batchDocs = result.data[0]?.batchDocs || []
      const foundFileTypes = [...new Set(batchDocs.map((doc: any) => {
        const ext = doc.fileName?.split('.').pop()?.toUpperCase()
        return ext || 'UNKNOWN'
      }))] as string[]
      
      const expectedTypes = ["DOCX", "PDF", "XLSX", "PNG", "JPG"]
      const missingTypes = expectedTypes.filter((t) => !foundFileTypes.includes(t))
      
      const analysisPayload: FileAnalysis = {
        found: foundFileTypes,
        expected: expectedTypes,
        missing: missingTypes
      }
      
      setAnalysis(analysisPayload)
      setHasScannedInSession(true)
      setHasAnalysisData(true)
      setScanStatus(result.status)
      
      // Store the raw scan data for detailed analysis
      try {
        localStorage.setItem("brr:analysis:active", "true")
        localStorage.setItem("brr:analysis:data", JSON.stringify(analysisPayload))
        localStorage.setItem("brr:scan:rawData", JSON.stringify(result.data))
        
        // Clear any previous analyzed docs to ensure fresh scan shows "Analyze" buttons
        localStorage.removeItem("analyzedDocs")
        console.log('Cleared previous analyzed docs for fresh scan')
      } catch {
        // ignore
      }
    } else {
      setScanError(result.status?.error || 'Scan failed with unknown error')
      setScanStatus(result.status)
    }
    
    setShowLiveProgress(false)
  }

  // Handle live progress popup close
  const handleProgressClose = () => {
    setShowLiveProgress(false)
    setCurrentSessionId(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="w-full px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm tracking-wide">IT</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-slate-900">
                  BRR Demo – <span className="text-blue-600">ITSoli</span>
                </h1>
                <p className="text-[11px] text-slate-500 hidden sm:block">Business Requirements Review workflow</p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <Button onClick={clearAllCache} variant="outline" size="sm" className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear Cache</span>
              </Button>
              <Button onClick={goToChecklist} variant="outline" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Generate Checklist</span>
                <span className="sm:hidden">Checklist</span>
              </Button>
              <Button onClick={goToSummary} variant="outline" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Generate Summary</span>
                <span className="sm:hidden">Summary</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        {isSidebarOpen ? (
          <aside
            id="s3-sidebar"
            className="w-80 hidden md:flex flex-col border-r border-slate-200/70 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/60"
          >
            <div className="p-4 border-b border-slate-200/70 bg-gradient-to-b from-white to-slate-50">
              <div className="flex items-center justify-start gap-1">
                <div>
                  <h3 className="font-medium text-slate-900 flex items-center">
                    <span className="inline-flex items-center justify-center rounded-md bg-blue-50 text-blue-600 mr-2 h-6 w-6">
                      IT
                    </span>
                    S3 Browser
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Navigate with Back/Forward or breadcrumbs</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-controls="s3-sidebar"
                  aria-expanded={true}
                  className="rounded-full hover:bg-slate-100"
                >
                  <PanelLeftClose className="w-4 h-4 mr-2 text-slate-700" />
                  <span className="hidden sm:inline">Hide</span>
                  <span className="sm:hidden">Hide</span>
                </Button>
              </div>
            </div>

            {/* S3 tree with back/forward and breadcrumbs */}
            <div className="flex-1 min-h-0">
              <S3Browser 
                onSelect={onSelectFromBrowser}
                initialPath={s3BrowserState.currentPath}
                onStateChange={onS3BrowserStateChange}
                preservedState={s3BrowserState}
              />
            </div>

            <div className="p-4 border-t border-slate-200/70 bg-gradient-to-t from-white to-slate-50">
              <Button
                onClick={analyzeFolder}
                disabled={!selectedFolder || isAnalyzing}
                className="w-full rounded-full shadow-sm"
              >
                {isAnalyzing ? (
                  <>
                    <Download className="w-4 h-4 mr-2 animate-spin" />
                    {scanStatus?.stage === 'downloading' ? 'Downloading...' : 
                     scanStatus?.stage === 'verifying' ? 'Verifying...' : 'Scanning...'}
                  </>
                ) : (
                  selectedFolder ? `Scan BRR3` : "Select a folder"
                )}
              </Button>
              

              
              {selectedFolder && !isAnalyzing && (
                <div className="mt-2 text-[11px] text-slate-500 truncate">
                  Selected: <span className="font-medium">{selectedFolder.path}</span>
                </div>
              )}
            </div>
          </aside>
        ) : (
          <div className="w-10 hidden md:flex items-start justify-center border-r border-slate-200/70 bg-white/70 p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              aria-controls="s3-sidebar"
              aria-expanded={false}
              className="rounded-full hover:bg-slate-100"
            >
              <PanelLeft className="w-4 h-4 text-slate-700" />
              <span className="sr-only">Show folders</span>
            </Button>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
            {/* Error Alert */}
            {scanError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Scan Failed:</strong> {scanError}
                  <Button 
                    onClick={() => {
                      setScanError(null)
                      setScanStatus(null)
                    }} 
                    variant="outline" 
                    size="sm" 
                    className="ml-3"
                  >
                    Dismiss
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Success Status */}
            {scanStatus?.stage === 'completed' && !scanError && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Scan Completed:</strong> {scanStatus.message}
                  {scanStatus.filesProcessed && (
                    <span className="ml-2">({scanStatus.filesProcessed} files processed)</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Classification Results - show when we have analysis data or scan is completed */}
            {((scanStatus?.stage === 'completed' && !scanError) || (analysis && hasAnalysisData)) && hasScannedInSession && (
              <div className="space-y-6">
                <ClassificationResults 
                  analysisData={analysis} 
                  sessionId={sessionId}
                />
                
                {/* Generate Data Montage Component removed as requested */}
              </div>
            )}

            {/* Empty state - only show during analysis */}
            {isAnalyzing && !scanError && (
              <div className="rounded-2xl border border-dashed border-slate-300/70 bg-white/60 p-8 text-center shadow-sm">
                <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  {isAnalyzing ? (
                    <Download className="w-5 h-5 text-slate-500 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <h3 className="text-sm font-medium text-slate-900">
                  {isAnalyzing ? (
                    scanStatus?.stage === 'downloading' ? "Downloading files..." :
                    scanStatus?.stage === 'verifying' ? "Running verification..." :
                    "Scanning folder..."
                  ) : "Scan a folder to see results"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {isAnalyzing ? (
                    scanStatus?.message || "Please wait while we process the selected folder."
                  ) : "Use the S3 Browser to pick a folder, then click Scan BRR3."}
                </p>

              </div>
            )}

            {/* Show reset option when user has scanned but no analysis data */}
            {hasScannedInSession && !analysis && !hasAnalysisData && !isAnalyzing && !scanError && (
              <div className="rounded-2xl border border-dashed border-slate-300/70 bg-white/60 p-8 text-center shadow-sm">
                <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-slate-500" />
                </div>
                <h3 className="text-sm font-medium text-slate-900">No analysis data available</h3>
                <p className="mt-1 text-xs text-slate-500 mb-4">The scan completed but no results were found.</p>
                <Button onClick={resetSession} variant="outline" size="sm">
                  Start Over
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Live Progress Popup */}
      <LiveProgressPopup
        isVisible={showLiveProgress}
        sessionId={currentSessionId}
        onClose={handleProgressClose}
        onComplete={handleProgressComplete}
      />

    </div>
  )
}
