"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Folder, ChevronRight, ChevronLeft, File, Eye, AlertTriangle } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import EnvErrorDisplay from "@/components/env-error-display"
import AsyncErrorBoundary from "@/components/async-error-boundary"

// Types for real S3 data
type S3FolderResponse = {
  folders: string[]
  files: string[]
  isTruncated: boolean
  nextContinuationToken: string | null
  keyCount: number
}

type S3ErrorResponse = {
  error: string
  missingVars?: string[]
  invalidVars?: string[]
  warnings?: string[]
  details?: string
  helpText?: string
}

type S3ApiResponse = S3FolderResponse | (S3ErrorResponse & { isError: true })

type S3Node = {
  name: string
  path: string // e.g. "/business-requirements" or "/business-requirements/v1"
  fileCount?: number
  size?: string
  lastModified?: string
  children?: S3Node[]
  isLoading?: boolean
}

// Cache for storing fetched data to avoid repeated API calls
// Cache management with size limits and LRU eviction
type CacheEntry = {
  data: S3FolderResponse
  timestamp: number
  accessCount: number
}

class LRUCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize = 50 // Maximum number of cached entries
  private maxAge = 5 * 60 * 1000 // 5 minutes in milliseconds

  get(key: string): S3FolderResponse | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key)
      return null
    }

    // Update access count and timestamp for LRU
    entry.accessCount++
    entry.timestamp = Date.now()
    
    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    
    return entry.data
  }

  set(key: string, data: S3FolderResponse): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      accessCount: 1
    }

    this.cache.set(key, entry)
  }

  private evictOldest(): void {
    // Remove expired entries first
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key)
      }
    }

    // If still over limit, remove least recently used entries
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      } else {
        break
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

const dataCache = new LRUCache()

/**
 * Fetch S3 folders and files from the API
 */
async function fetchS3Data(prefix: string = ""): Promise<S3ApiResponse> {
  const cacheKey = prefix || "root"
  
  // Check cache first
  const cachedData = dataCache.get(cacheKey)
  if (cachedData) {
    return cachedData
  }

  try {
    let effectivePrefix = prefix
    const maxUrlLength = 2000 // Conservative URL length limit
    const baseUrl = '/api/s3/folders'
    
    // Pre-validate and truncate prefix if necessary to prevent URL length issues
    const params = new URLSearchParams()
    params.append('maxKeys', '100') // Get more items for better UX
    
    if (effectivePrefix) {
      // Calculate approximate URL length with current prefix
      params.set('prefix', effectivePrefix)
      const testUrl = `${baseUrl}?${params.toString()}`
      
      if (testUrl.length > maxUrlLength) {
        console.warn('URL too long, truncating prefix. Original length:', testUrl.length)
        
        // Intelligently truncate prefix while preserving meaningful path structure
        const pathParts = effectivePrefix.split('/').filter(part => part.length > 0)
        let truncatedParts = pathParts
        
        // Keep reducing path depth until URL is acceptable
        while (truncatedParts.length > 1) {
          truncatedParts = truncatedParts.slice(0, -1)
          const testPrefix = truncatedParts.join('/') + (truncatedParts.length > 0 ? '/' : '')
          params.set('prefix', testPrefix)
          const newTestUrl = `${baseUrl}?${params.toString()}`
          
          if (newTestUrl.length <= maxUrlLength) {
            effectivePrefix = testPrefix
            console.log('Truncated prefix to:', effectivePrefix)
            break
          }
        }
        
        // If still too long, use root
        if (truncatedParts.length <= 1) {
          effectivePrefix = ''
          params.delete('prefix')
          console.warn('Prefix too long, falling back to root directory')
        }
      }
    }
    
    // Build final URL with validated parameters
    const finalUrl = `${baseUrl}?${params.toString()}`
    
    // Add timeout and abort controller for better error handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
      console.warn('Request timeout for prefix:', effectivePrefix)
    }, 10000) // 10 second timeout
    
    const response = await fetch(finalUrl, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Accept': 'application/json'
      }
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      try {
        const errorData = await response.json()
        // Check if this is an environment configuration error
        if (errorData.error && (errorData.missingVars || errorData.invalidVars)) {
          return {
            ...errorData,
            isError: true
          } as S3ErrorResponse & { isError: true }
        }
      } catch {
        // If JSON parsing fails, fall back to text error
      }
      
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`API request failed: ${response.status} - ${errorText}`)
    }
    
    const data: S3FolderResponse = await response.json()
    
    // Cache the result using the effective prefix that was actually used
    const effectiveCacheKey = effectivePrefix || "root"
    dataCache.set(effectiveCacheKey, data)
    
    // If we had to truncate, also cache under the original key to prevent repeated attempts
    if (effectivePrefix !== prefix && prefix) {
      dataCache.set(cacheKey, data)
    }
    
    return data
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Request timed out or was aborted:', prefix)
      } else {
        console.error('Error fetching S3 data:', error.message)
      }
    } else {
      console.error('Error fetching S3 data:', error)
    }
    
    // Return empty result on error
    return {
      folders: [],
      files: [],
      isTruncated: false,
      nextContinuationToken: null,
      keyCount: 0
    }
  }
}

/**
 * Convert S3 API response to S3Node structure
 */
function convertApiResponseToNodes(prefix: string, response: S3FolderResponse): S3Node[] {
  const nodes: S3Node[] = []
  
  // Convert folders
  response.folders.forEach(folderName => {
    const fullPath = prefix ? `${prefix}/${folderName}` : folderName
    const cleanPath = `/${fullPath}`.replace(/\/+/g, '/') // Ensure clean path
    nodes.push({
      name: folderName,
      path: cleanPath,
      fileCount: undefined, // We'll get this when expanding the folder
      size: undefined,
      lastModified: undefined,
      children: undefined
    })
  })
  
  // Convert files (show at all levels, not just root)
  response.files.forEach(fileName => {
    const fullPath = prefix ? `${prefix}${fileName}` : fileName
    const cleanPath = `/${fullPath}`.replace(/\/+/g, '/') // Ensure clean path
    nodes.push({
      name: fileName,
      path: cleanPath,
      fileCount: 1,
      size: undefined,
      lastModified: undefined,
      children: undefined
    })
  })
  
  return nodes.sort((a, b) => {
    // Folders first, then files
    const aIsFolder = a.fileCount !== 1
    const bIsFolder = b.fileCount !== 1
    
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1
    
    // Then alphabetically
    return a.name.localeCompare(b.name)
  })
}

function getBreadcrumbs(path: string): { name: string; path: string }[] {
  if (path === "/") return [{ name: "root", path: "/" }]
  const parts = path.split("/").filter(Boolean)
  const crumbs: { name: string; path: string }[] = [{ name: "root", path: "/" }]
  let acc = ""
  for (const p of parts) {
    acc += `/${p}`
    crumbs.push({ name: p, path: acc.replace(/\/+/g, '/') })
  }
  return crumbs
}

export type S3BrowserOnSelect = (folder: {
  id: string
  name: string
  path: string
  fileCount?: number
  size?: string
  lastModified?: string
}) => void

export default function S3Browser({
  initialPath = "/",
  onSelect,
  onStateChange,
  preservedState,
}: {
  initialPath?: string
  onSelect?: S3BrowserOnSelect
  onStateChange?: (state: {
    currentPath: string
    history: string[]
    historyIndex: number
  }) => void
  preservedState?: {
    currentPath: string
    history: string[]
    historyIndex: number
  }
}) {
  // Use preserved state if available, otherwise use initial values
  const [history, setHistory] = useState<string[]>(
    preservedState?.history || [initialPath]
  )
  const [historyIndex, setHistoryIndex] = useState(
    preservedState?.historyIndex || 0
  )
  
  // Update state when preservedState changes (e.g., when navigating back)
  useEffect(() => {
    if (preservedState && preservedState.history && preservedState.history.length > 0) {
      setHistory(preservedState.history)
      setHistoryIndex(preservedState.historyIndex)
    }
  }, [preservedState?.currentPath, preservedState?.historyIndex])
  const [currentNodes, setCurrentNodes] = useState<S3Node[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<S3Node | null>(null)
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false)
  const [envError, setEnvError] = useState<(S3ErrorResponse & { isError: true }) | null>(null)
  const [apiError, setApiError] = useState<Error | null>(null)

  const currentPath = history[historyIndex] || "/"

  // Cleanup cache on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear cache when component unmounts
      dataCache.clear()
    }
  }, [])

  // Notify parent component of state changes - only when path actually changes
  const lastReportedPath = useRef<string>(currentPath)
  
  useEffect(() => {
    if (onStateChange && lastReportedPath.current !== currentPath) {
      lastReportedPath.current = currentPath
      onStateChange({
        currentPath,
        history,
        historyIndex,
      })
    }
  }, [currentPath, history, historyIndex, onStateChange])

  // Retry function for AsyncErrorBoundary
  const retryLoadData = useCallback(() => {
    setApiError(null)
    loadData()
  }, [currentPath])

  // Fetch data when path changes
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Convert path to prefix format (remove leading slash, add trailing slash for folders)
      const prefix = currentPath === "/" ? "" : currentPath.slice(1).replace(/\/+/g, '/') + "/"
      
      const response = await fetchS3Data(prefix)
      
      // Check if response is an environment error
      if ('isError' in response && response.isError) {
        setEnvError(response)
        setCurrentNodes([])
        return
      }
      
      // Clear any previous errors
      setEnvError(null)
      setApiError(null)
      
      const nodes = convertApiResponseToNodes(prefix, response as S3FolderResponse)
      setCurrentNodes(nodes)
    } catch (error) {
      console.error('Error loading S3 data:', error)
      setCurrentNodes([])
      setEnvError(null)
      
      // Set API error for AsyncErrorBoundary
      if (error instanceof Error) {
        setApiError(error)
      } else {
        setApiError(new Error('Unknown error occurred while loading S3 data'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [currentPath])

  useEffect(() => {
    loadData()
  }, [loadData])


  function navigateTo(path: string) {
    if (path === currentPath) return
    // drop forward history, push new path
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1)
      next.push(path)
      return next
    })
    setHistoryIndex((i) => i + 1)
  }

  function goBack() {
    setHistoryIndex((i) => Math.max(0, i - 1))
  }
  
  function goForward() {
    setHistoryIndex((i) => Math.min(history.length - 1, i + 1))
  }

  const canBack = historyIndex > 0
  const canForward = historyIndex < history.length - 1

  const breadcrumbs = getBreadcrumbs(currentPath)

  function selectFolder(node: S3Node) {
    if (onSelect) {
      onSelect({
        id: node.path,
        name: node.name,
        path: node.path,
        fileCount: node.fileCount,
        size: node.size,
        lastModified: node.lastModified,
      })
    }
  }

  function openPdfViewer(file: S3Node) {
    setSelectedFile(file)
    setIsPdfViewerOpen(true)
  }

  // Handle folder navigation
  const handleFolderClick = useCallback(async (node: S3Node) => {
    // If it's a file, don't navigate
    if (node.fileCount === 1) {
      selectFolder(node)
      return
    }
    
    // Check folder depth to prevent very deep navigation
    const pathDepth = node.path.split('/').filter(Boolean).length
    if (pathDepth > 10) {
      console.warn('Maximum folder depth reached, navigation blocked')
      return
    }
    
    // Navigate to folder - ensure clean path construction
    const cleanPath = node.path.replace(/\/+/g, '/') // Remove multiple consecutive slashes
    navigateTo(cleanPath)
    selectFolder(node)
  }, [navigateTo, selectFolder])

  return (
    <AsyncErrorBoundary
      error={apiError}
      onRetry={retryLoadData}
      fallback={({ error, retry }) => (
        <div className="flex h-full flex-col">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Failed to load S3 data</h3>
                <p className="text-sm text-slate-600 mt-1">{error?.message || 'An unexpected error occurred'}</p>
              </div>
              <Button onClick={retry} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <div className="flex h-full flex-col">
        {/* Controls */}
        <div className="p-3 border-b border-slate-200/70 bg-white/80 flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goBack} disabled={!canBack} aria-label="Back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goForward} disabled={!canForward} aria-label="Forward">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

      {/* Breadcrumbs */}
      <div className="px-3 py-2 border-b border-slate-200/70 bg-gradient-to-b from-white to-slate-50">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((c, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <span key={c.path} className="flex items-center">
                  {!isLast ? (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            navigateTo(c.path)
                          }}
                          className="capitalize"
                        >
                          {c.name}
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </BreadcrumbSeparator>
                    </>
                  ) : (
                    <BreadcrumbItem>
                      <BreadcrumbPage className="capitalize">{c.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  )}
                </span>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Folder/File list */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {envError ? (
          <EnvErrorDisplay
            error={envError.error}
            missingVars={envError.missingVars}
            invalidVars={envError.invalidVars}
            warnings={envError.warnings}
            details={envError.details}
            helpText={envError.helpText}
          />
        ) : isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-300/70 bg-white/60 p-4 text-center text-sm text-slate-500">
            Loading...
          </div>
        ) : currentNodes.length > 0 ? (
          currentNodes.map((node) => {
            const isFile = node.fileCount === 1
            const isPdf = isFile && node.name.toLowerCase().endsWith('.pdf')
            
            return (
              <ContextMenu key={node.path}>
                <ContextMenuTrigger asChild>
                  <button
                    onClick={() => handleFolderClick(node)}
                    className={[
                      "w-full text-left group relative overflow-hidden rounded-xl px-3 py-3 transition",
                      "ring-1 ring-slate-200/70 hover:ring-slate-300 bg-white/80 hover:bg-slate-50 shadow-sm hover:shadow",
                    ].join(" ")}
                  >
                <div
                  aria-hidden
                  className="absolute left-0 top-0 h-full w-1 rounded-r-xl bg-transparent group-hover:bg-slate-200"
                />
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isFile ? (
                      <File className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Folder className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-10">
                      <p className="text-sm font-medium text-slate-900 truncate capitalize">{node.name}</p>
                      {!isFile && <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {isFile && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
                          File
                        </span>
                      )}
                      {!isFile && (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5">
                          Folder
                        </span>
                      )}
                      {isFile && (
                        <span className="text-slate-400">Click to select</span>
                      )}
                      {!isFile && (
                        <span className="text-slate-400">Click to open</span>
                      )}
                      {!isFile && (
                        <span className="text-slate-400">→</span>
                      )}
                    </div>
                    {node.lastModified && <div className="mt-1 text-[11px] text-slate-400">{node.lastModified}</div>}
                  </div>
                </div>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {isPdf && (
                    <ContextMenuItem onSelect={() => openPdfViewer(node)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View PDF
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300/70 bg-white/60 p-4 text-center text-sm text-slate-500">
            No items found in this location.
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      <Dialog open={isPdfViewerOpen} onOpenChange={setIsPdfViewerOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {selectedFile?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {selectedFile && (
              <iframe
                src={`/api/s3/view?key=${encodeURIComponent(selectedFile.path.slice(1))}`}
                className="w-full h-[85vh] border-0 rounded-lg"
                title={selectedFile.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </AsyncErrorBoundary>
  )
}
