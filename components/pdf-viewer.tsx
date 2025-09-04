"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Save } from "lucide-react"

interface BoundingBox {
  value: string
  bboxes: number[][]
}

interface PDFViewerProps {
  pdfUrl: string
  bboxData: Record<string, BoundingBox | BoundingBox[]>
  selectedKey?: string
  onBboxClick?: (key: string) => void
  zoom?: number
  onZoomChange?: (zoom: number) => void
  onTotalPagesChange?: (totalPages: number) => void
  showNavigation?: boolean
  showSaveOptions?: boolean
  documentName?: string
  currentPage?: number
  onCurrentPageChange?: (page: number) => void
}

export default function PDFViewer({
  pdfUrl,
  bboxData,
  selectedKey,
  onBboxClick,
  zoom = 100,
  onZoomChange,
  onTotalPagesChange,
  showNavigation = true,
  showSaveOptions = true,
  documentName = "document",
  currentPage: externalCurrentPage,
  onCurrentPageChange
}: PDFViewerProps) {
  const [pdfDimensions, setPdfDimensions] = useState({ width: 612, height: 792 })
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 }) // Used for bounding box positioning and scroll tracking
  const [numPages, setNumPages] = useState<number>(0)
  const [isClient, setIsClient] = useState<boolean>(false)
  const [pdfComponents, setPdfComponents] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageInput, setPageInput] = useState<string>('1')
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const [scrollVelocity, setScrollVelocity] = useState<number>(0)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollTime = useRef<number>(0)
  const lastScrollTop = useRef<number>(0)

  // Set up PDF.js and components on client side only
  useEffect(() => {
    const setupPDF = async () => {
      try {
        // Import react-pdf components and setup worker
        const { Document, Page, pdfjs } = await import('react-pdf')
        
        // Set up worker
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        
        // Store components
        setPdfComponents({ Document, Page })
        setIsClient(true)
      } catch (error) {
        console.error('Failed to load PDF components:', error)
      }
    }
    
    setupPDF()
  }, [])

  // Synchronize external current page with internal state
  useEffect(() => {
    if (externalCurrentPage && externalCurrentPage !== currentPage) {
      setCurrentPage(externalCurrentPage)
      setPageInput(externalCurrentPage.toString())
    }
  }, [externalCurrentPage, currentPage])

  // Notify parent component when current page changes internally (but not during programmatic scrolling)
  useEffect(() => {
    if (onCurrentPageChange && currentPage !== externalCurrentPage && !isScrolling) {
      onCurrentPageChange(currentPage)
    }
  }, [currentPage, onCurrentPageChange, externalCurrentPage, isScrolling])

  // Memoized bounding boxes processing for better performance
  const allBboxes = useMemo(() => {
    const bboxes: Array<{ key: string; pairId: string; bbox: number[]; value: string; page: number }> = []
    
    // Check if data has paginated structure (page_1, page_2, etc.)
    const isPagedData = Object.keys(bboxData).some(key => key.startsWith('page_'))
    
    if (isPagedData) {
      // Handle paginated data structure
      Object.entries(bboxData).forEach(([pageKey, pageData]) => {
        if (pageKey.startsWith('page_') && pageData && typeof pageData === 'object') {
          const pageNumber = parseInt(pageKey.replace('page_', '')) || 1
          
          Object.entries(pageData).forEach(([key, data]) => {
            if (Array.isArray(data)) {
              // Handle array of objects (like Analytical Testing Reports)
              data.forEach((item, index) => {
                Object.entries(item).forEach(([subKey, subData]) => {
                  if (subData && typeof subData === 'object' && 'bboxes' in subData) {
                    subData.bboxes.forEach((bbox: number[], bboxIndex: number) => {
                      bboxes.push({
                        key: `${key}[${index}].${subKey}`,
                        pairId: `${pageKey}.${key}[${index}].${subKey}-${bboxIndex}`,
                        bbox,
                        value: subData.value,
                        page: pageNumber
                      })
                    })
                  }
                })
              })
            } else if (data && typeof data === 'object' && 'bboxes' in data) {
              // Handle single objects
              data.bboxes.forEach((bbox: number[], bboxIndex: number) => {
                bboxes.push({
                  key,
                  pairId: `${pageKey}.${key}-${bboxIndex}`,
                  bbox,
                  value: data.value,
                  page: pageNumber
                })
              })
            }
          })
        }
      })
    } else {
      // Handle legacy non-paginated data structure
      Object.entries(bboxData).forEach(([key, data]) => {
        if (Array.isArray(data)) {
          // Handle array of objects (like Analytical Testing Reports)
          data.forEach((item, index) => {
            Object.entries(item).forEach(([subKey, subData]) => {
              if (subData && typeof subData === 'object' && 'bboxes' in subData) {
                subData.bboxes.forEach((bbox: number[], bboxIndex: number) => {
                  bboxes.push({
                    key: `${key}[${index}].${subKey}`,
                    pairId: `${key}[${index}].${subKey}-${bboxIndex}`,
                    bbox,
                    value: subData.value,
                    page: 1
                  })
                })
              }
            })
          })
        } else if (data && typeof data === 'object' && 'bboxes' in data) {
          // Handle single objects
          data.bboxes.forEach((bbox: number[], bboxIndex: number) => {
            bboxes.push({
              key,
              pairId: `${key}-${bboxIndex}`,
              bbox,
              value: data.value,
              page: 1
            })
          })
        }
      })
    }
    
    return bboxes
  }, [bboxData])

  // PDF loading handlers
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    onTotalPagesChange?.(numPages)
    setCurrentPage(1) // Reset to first page when document loads
    setPageInput('1') // Reset page input
  }

  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page
    setPdfDimensions({ width, height })
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error)
  }

  // Enhanced scroll tracking with smooth scrolling detection
  useEffect(() => {
    const container = pdfContainerRef.current
    if (!container) return

    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      const currentTime = Date.now()
      const currentScrollTop = container.scrollTop
      
      setScrollOffset({
        x: container.scrollLeft,
        y: currentScrollTop
      })
      // scrollOffset is used for bounding box positioning calculations

      // Calculate scroll velocity for smooth animations
      if (lastScrollTime.current > 0) {
        const timeDelta = currentTime - lastScrollTime.current
        const scrollDelta = currentScrollTop - lastScrollTop.current
        const velocity = Math.abs(scrollDelta / timeDelta) * 1000 // pixels per second
        setScrollVelocity(velocity)
      }

      lastScrollTime.current = currentTime
      lastScrollTop.current = currentScrollTop

      // Detect when scrolling starts
      setIsScrolling(true)
      
      // Clear previous timeout
      clearTimeout(scrollTimeout)
      
      // Detect when scrolling ends (after 150ms of no scrolling)
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false)
        setScrollVelocity(0)
      }, 150)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  const handleZoomIn = () => {
    const newZoom = Math.min(300, zoom + 25)
    onZoomChange?.(newZoom)
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(25, zoom - 25)
    onZoomChange?.(newZoom)
  }

  const handleReset = () => {
    onZoomChange?.(100)
  }

  // Navigation functions
  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber)
      scrollToPage(pageNumber)
    }
  }

  const goToNextPage = () => {
    if (currentPage < numPages) {
      goToPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1)
    }
  }

  const goToFirstPage = () => {
    goToPage(1)
  }

  const goToLastPage = () => {
    goToPage(numPages)
  }

  const handlePageInputChange = (value: string) => {
    setPageInput(value)
  }

  const handlePageInputSubmit = () => {
    const pageNumber = parseInt(pageInput)
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= numPages) {
      goToPage(pageNumber)
    } else {
      // Reset to current page if invalid input
      setPageInput(currentPage.toString())
    }
  }

  const handlePageInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handlePageInputSubmit()
    }
  }

  // Update page input when current page changes
  useEffect(() => {
    setPageInput(currentPage.toString())
  }, [currentPage])

  // Save functionality
  const saveCurrentPage = async () => {
    try {
      setIsSaving(true)
      if (!pdfComponents || !isClient) {
        console.error('PDF components not loaded')
        return
      }

      // Create a canvas to render the current page
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return

      // Set canvas size based on zoom
      const scale = zoom / 100
      canvas.width = pdfDimensions.width * scale
      canvas.height = pdfDimensions.height * scale

      // Render the current page to canvas
      const { pdfjs } = await import('react-pdf')
      const pdf = await pdfjs.getDocument(pdfUrl).promise
      const page = await pdf.getPage(currentPage)
      
      const viewport = page.getViewport({ scale })
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }

      await page.render(renderContext).promise

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${documentName}_page_${currentPage}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          alert(`Page ${currentPage} saved successfully!`)
        }
      }, 'image/png')
    } catch (error) {
      console.error('Error saving current page:', error)
      alert('Failed to save current page. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }



  const scrollToPage = (pageNumber: number) => {
    const container = pdfContainerRef.current
    if (!container) return

    // Set scrolling state to show visual feedback
    setIsScrolling(true)

    // Calculate the position of the target page
    const pageHeight = pdfDimensions.height * (zoom / 100) + 16 // 16px margin between pages
    const targetScrollTop = (pageNumber - 1) * pageHeight

    // Smooth scroll to the target page with enhanced options
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
      left: 0 // Ensure horizontal scroll is reset
    })

    // Reset scrolling state after animation completes
    setTimeout(() => {
      setIsScrolling(false)
    }, 500) // Slightly longer than typical smooth scroll duration
  }

  // Handle automatic scrolling when external current page changes
  useEffect(() => {
    if (externalCurrentPage && externalCurrentPage !== currentPage && pdfContainerRef.current && !isScrolling) {
      scrollToPage(externalCurrentPage)
    }
  }, [externalCurrentPage, isScrolling])

  // Optimized scroll handling with throttling
  const handleScroll = useCallback(() => {
    // Don't update page during programmatic scrolling to prevent feedback loops
    if (isScrolling) return
    
    const container = pdfContainerRef.current
    if (!container || numPages === 0) return
    
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    const pageHeight = pdfDimensions.height * (zoom / 100) + 16 // 16px margin between pages
    
    // Calculate which page is most visible in the viewport
    const viewportCenter = scrollTop + (containerHeight / 2)
    const newCurrentPage = Math.min(numPages, Math.max(1, Math.round(viewportCenter / pageHeight) + 1))
    
    if (newCurrentPage !== currentPage) {
      setCurrentPage(newCurrentPage)
    }
  }, [isScrolling, numPages, pdfDimensions.height, zoom, currentPage])

  // Enhanced page detection with throttling for better performance
  useEffect(() => {
    const container = pdfContainerRef.current
    if (!container || numPages === 0) return

    let throttleTimer: NodeJS.Timeout | null = null
    const throttledHandleScroll = () => {
      if (throttleTimer) return
      throttleTimer = setTimeout(() => {
        handleScroll()
        throttleTimer = null
      }, 16) // ~60fps throttling
    }

    container.addEventListener('scroll', throttledHandleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll)
      if (throttleTimer) clearTimeout(throttleTimer)
    }
  }, [handleScroll, numPages])

  // Keyboard navigation and shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Save shortcuts (Ctrl/Cmd + S)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        if (showSaveOptions && !isSaving && isClient) {
          saveCurrentPage()
        }
        return
      }



      // Navigation shortcuts
      if (!showNavigation || numPages <= 1) return

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          goToPreviousPage()
          break
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          goToNextPage()
          break
        case 'Home':
          event.preventDefault()
          goToFirstPage()
          break
        case 'End':
          event.preventDefault()
          goToLastPage()
          break
        case 'PageUp':
          event.preventDefault()
          goToPreviousPage()
          break
        case 'PageDown':
          event.preventDefault()
          goToNextPage()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showNavigation, numPages, currentPage, goToPreviousPage, goToNextPage, goToFirstPage, goToLastPage, showSaveOptions, isSaving, isClient, saveCurrentPage])

  return (
    <div className="flex flex-col h-full">
      {/* Header with Navigation and Zoom Controls */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Document Viewer</h3>
          
          <div className="flex items-center space-x-4">
            {/* Navigation Controls */}
            {showNavigation && numPages > 1 && (
              <div className={`flex items-center space-x-2 transition-opacity duration-200 ${isScrolling ? 'opacity-75' : 'opacity-100'}`}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToFirstPage}
                  disabled={currentPage === 1 || isScrolling}
                  title="First page (Home key)"
                  className="transition-all duration-200 hover:scale-105"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1 || isScrolling}
                  title="Previous page (← or ↑ key)"
                  className="transition-all duration-200 hover:scale-105"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center space-x-2 px-2">
                  <span className="text-sm text-gray-600">
                    Page
                  </span>
                  <Input
                    type="number"
                    value={pageInput}
                    onChange={(e) => handlePageInputChange(e.target.value)}
                    onKeyDown={handlePageInputKeyDown}
                    onBlur={handlePageInputSubmit}
                    className="w-16 h-8 text-center text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                    min={1}
                    max={numPages}
                    title="Enter page number and press Enter"
                    disabled={isScrolling}
                  />
                  <span className="text-sm text-gray-600">
                    of {numPages}
                  </span>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToNextPage}
                  disabled={currentPage === numPages || isScrolling}
                  title="Next page (→ or ↓ key)"
                  className="transition-all duration-200 hover:scale-105"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToLastPage}
                  disabled={currentPage === numPages || isScrolling}
                  title="Last page (End key)"
                  className="transition-all duration-200 hover:scale-105"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            {/* Save Controls */}
            {showSaveOptions && (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={saveCurrentPage}
                  disabled={isSaving || !isClient}
                  title="Save current page as PNG (Ctrl/Cmd + S)"
                  className="transition-all duration-200 hover:scale-105 disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 mr-1 ${isSaving ? 'animate-pulse' : ''}`} />
                  <span className="text-xs">{isSaving ? 'Saving...' : 'Save Page'}</span>
                </Button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-600 min-w-[50px] text-center">{zoom}%</span>
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="ml-2 text-xs"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Progress Indicator */}
      {showNavigation && numPages > 1 && (
        <div className="h-1 bg-gray-200 relative">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{
              width: `${(currentPage / numPages) * 100}%`
            }}
          />
        </div>
      )}

      {/* PDF Viewer Container */}
      <div 
        ref={pdfContainerRef}
        className="flex-1 overflow-auto p-4 scroll-smooth"
        style={{
          scrollBehavior: 'smooth'
        }}
      >
        <div 
          ref={containerRef}
          className="relative mx-auto"
          style={{
            width: pdfDimensions.width * (zoom / 100),
            minWidth: pdfDimensions.width * (zoom / 100),
          }}
        >
          {/* PDF Document */}
          {!isClient || !pdfComponents ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Initializing PDF viewer...
            </div>
          ) : (
            <pdfComponents.Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="flex items-center justify-center h-full text-gray-500">Loading PDF...</div>}
              error={<div className="flex items-center justify-center h-full text-red-500">Failed to load PDF</div>}
              className="w-full h-full"
            >
              {Array.from(new Array(numPages), (_, index) => (
                <div key={`page_${index + 1}`} className="mb-4 last:mb-0 border rounded-lg shadow-sm bg-white relative">
                  <pdfComponents.Page
                    pageNumber={index + 1}
                    onLoadSuccess={onPageLoadSuccess}
                    scale={zoom / 100}
                    className="mx-auto"
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  {/* Bounding Boxes Overlay for this page */}
                  <div className="absolute inset-0 pointer-events-none">
                    {selectedKey && allBboxes
                      .filter(item => item.pairId === selectedKey && item.page === (index + 1))
                      .map((item, bboxIndex) => {
                        const [x1, y1, x2, y2] = item.bbox
                        const left = x1 * (zoom / 100)
                        const top = y1 * (zoom / 100)
                        const width = (x2 - x1) * (zoom / 100)
                        const height = (y2 - y1) * (zoom / 100)

                        return (
                          <div
                            key={`${item.pairId}-${bboxIndex}`}
                            className="absolute cursor-pointer rounded-sm transition pointer-events-auto ring-2 ring-blue-600 bg-yellow-300/30"
                            style={{ left, top, width, height }}
                            onClick={() => onBboxClick?.(item.pairId)}
                            title={`${item.key}: ${item.value} (Page ${item.page})`}
                          />
                        )
                      })}
                  </div>
                </div>
              ))}
            </pdfComponents.Document>
          )}

        </div>
      </div>

      {/* Floating Page Indicator */}
      {showNavigation && numPages > 1 && isScrolling && (
        <div className="fixed top-1/2 right-4 transform -translate-y-1/2 z-50">
          <div className="bg-black/80 text-white px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200">
            <div className="text-sm font-medium">
              Page {currentPage} of {numPages}
            </div>
            <div className="text-xs text-gray-300 mt-1">
              {Math.round((currentPage / numPages) * 100)}% complete
            </div>
            {scrollVelocity > 100 && (
              <div className="text-xs text-blue-300 mt-1 animate-pulse">
                Scrolling at {Math.round(scrollVelocity)} px/s
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}