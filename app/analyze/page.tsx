"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Save, Check, Trash2, Edit3, Eye, EyeOff, Search, X, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import PDFViewer from "@/components/pdf-viewer"

interface KeyValuePair {
  id: string
  key: string
  value: string
  confidence: number
  bbox?: [number, number, number, number] | undefined
  page?: number | undefined
}

export default function AnalyzeFilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const docId =
    searchParams.get("docId") || (typeof window !== "undefined" ? localStorage.getItem("currentDocId") : null)
  const mode = searchParams.get("mode") // "view" for read-only mode, null for edit mode
  const isViewMode = mode === "view"


  const [zoom, setZoom] = useState(100)
  const [selectedPair, setSelectedPair] = useState<string | null>(null)
  const [keyValuePairs, setKeyValuePairs] = useState<KeyValuePair[]>([])
  const [, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPageFilter, setSelectedPageFilter] = useState<number | null>(null)
  const [currentPageFilter, setCurrentPageFilter] = useState<number>(1)
  const [comments, setComments] = useState("")
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1)
  const [isNavigating, setIsNavigating] = useState<boolean>(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [bboxData, setBboxData] = useState<Record<string, any>>({})
  const [pageMetadata, setPageMetadata] = useState<Record<string, any>>({})



  useEffect(() => {
    if (docId) {
      const controller = new AbortController()
      
      // Load the bounding box data with proper timeout and cleanup
      const loadBboxData = async () => {
        try {
          // Set timeout for the request
          const timeoutId = setTimeout(() => {
            controller.abort()
            console.warn(`Bbox data request timeout for docId: ${docId}`)
          }, 10000) // 10 second timeout
          
          const response = await fetch(`/bbox_${docId}.json`, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          })
          
          clearTimeout(timeoutId)
          
          if (!response.ok) {
            if (response.status === 404) {
              console.warn(`Bbox file not found for document: ${docId}. This document may not have extracted data available.`)
              setBboxData({})
              setKeyValuePairs([])
              return
            }
            const errorText = await response.text().catch(() => 'Unknown error')
            throw new Error(`Failed to fetch bbox data: ${response.status} - ${errorText}`)
          }
          
          const data = await response.json()
          
          if (!controller.signal.aborted) {
            setBboxData(data)
            
            // Convert the paginated data to KeyValuePair format
            const pairs: KeyValuePair[] = []
            const metadata: Record<string, any> = {}
            
            // Check if data has paginated structure (page_1, page_2, etc.)
            const isPagedData = Object.keys(data).some(key => key.startsWith('page_'))
            
            if (isPagedData) {
              // Handle paginated data structure
              Object.entries(data).forEach(([pageKey, pageData]: [string, any]) => {
                if (pageKey.startsWith('page_') && pageData && typeof pageData === 'object') {
                  const pageNumber = parseInt(pageKey.replace('page_', '')) || 1
                  
                  // Extract metadata for this page
                  metadata[pageNumber] = {
                    watermark_presence: pageData.watermark_presence || 'Unknown',
                    typed_vs_handwritten: pageData['typed vs handwritten'] || { typed: 0, handwritten: 0 }
                  }
                  
                  Object.entries(pageData).forEach(([key, value]: [string, any]) => {
                    if (Array.isArray(value)) {
                      // Handle arrays like "Analytical Testing Reports"
                      value.forEach((item: any, arrayIndex: number) => {
                        Object.entries(item).forEach(([subKey, subValue]: [string, any]) => {
                          if (subValue && typeof subValue === "object" && "value" in subValue && "bboxes" in subValue) {
                            subValue.bboxes.forEach((bbox: [number, number, number, number], bboxIndex: number) => {
                              pairs.push({
                                id: `${pageKey}.${key}[${arrayIndex}].${subKey}-${bboxIndex}`,
                                key: `${key}[${arrayIndex}].${subKey}`,
                                value: subValue.value,
                                confidence: 0.95,
                                bbox,
                                page: pageNumber
                              })
                            })
                          }
                        })
                      })
                    } else if (value && typeof value === "object" && "value" in value && "bboxes" in value) {
                      // Handle simple key-value pairs
                      value.bboxes.forEach((bbox: [number, number, number, number], index: number) => {
                        pairs.push({
                          id: `${pageKey}.${key}-${index}`,
                          key,
                          value: value.value,
                          confidence: 0.95,
                          bbox,
                          page: pageNumber
                        })
                      })
                    }
                  })
                }
              })
            } else {
              // Handle legacy non-paginated data structure
              // Extract metadata for single page
              metadata[1] = {
                watermark_presence: data.watermark_presence || 'Unknown',
                typed_vs_handwritten: data['typed vs handwritten'] || { typed: 0, handwritten: 0 }
              }
              
              Object.entries(data).forEach(([key, value]: [string, any]) => {
                if (Array.isArray(value)) {
                  // Handle arrays like "Analytical Testing Reports"
                  value.forEach((item: any, arrayIndex: number) => {
                    Object.entries(item).forEach(([subKey, subValue]: [string, any]) => {
                      if (subValue && typeof subValue === "object" && "value" in subValue && "bboxes" in subValue) {
                        subValue.bboxes.forEach((bbox: [number, number, number, number], bboxIndex: number) => {
                          pairs.push({
                            id: `${key}[${arrayIndex}].${subKey}-${bboxIndex}`,
                            key: `${key}[${arrayIndex}].${subKey}`,
                            value: subValue.value,
                            confidence: 0.95,
                            bbox,
                            page: 1
                          })
                        })
                      }
                    })
                  })
                } else if (value && typeof value === "object" && "value" in value && "bboxes" in value) {
                  // Handle simple key-value pairs
                  value.bboxes.forEach((bbox: [number, number, number, number], index: number) => {
                    pairs.push({
                      id: `${key}-${index}`,
                      key,
                      value: value.value,
                      confidence: 0.95,
                      bbox,
                      page: 1
                    })
                  })
                }
              })
            }
            
            setKeyValuePairs(pairs)
            setPageMetadata(metadata)
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            if (error instanceof Error) {
              if (error.name === 'AbortError') {
                console.log('Bbox data request was cancelled')
              } else {
                console.error('Error loading bbox data:', error.message)
              }
            } else {
              console.error('Error loading bbox data:', error)
            }
          }
        }
      }
      
      loadBboxData()
      
      // Cleanup function to abort the request if component unmounts or docId changes
      return () => {
        controller.abort()
      }
    }
    // Return empty cleanup function when docId is not available
    return () => {}
  }, [docId])

  useEffect(() => {
    if (selectedPair) {
      document
        .getElementById(`bbox-${selectedPair}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
    }
  }, [selectedPair, zoom])

  const updateKeyValue = (id: string, field: "key" | "value", newValue: string) => {
    setKeyValuePairs((prev) => prev.map((pair) => (pair.id === id ? { ...pair, [field]: newValue } : pair)))
  }

  const deleteKeyValue = (id: string) => {
    setKeyValuePairs((prev) => prev.filter((pair) => pair.id !== id))
    // Clear selection if the deleted pair was selected
    if (selectedPair === id) {
      setSelectedPair(null)
    }
  }

  // Get unique pages from the data
  const availablePages = Array.from(new Set(keyValuePairs.map(pair => pair.page).filter(page => page !== undefined))).sort((a, b) => a! - b!)

  // Scroll to top of key-value pairs section
  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }, [])

  // Optimized navigation functions with useCallback
  const goToPreviousPage = useCallback(() => {
    if (currentPageFilter > 1) {
      const newPage = currentPageFilter - 1
      setCurrentPageFilter(newPage)
      setSelectedPageFilter(availablePages[newPage - 1])
      scrollToTop()
    }
  }, [currentPageFilter, availablePages, scrollToTop])

  const goToNextPage = useCallback(() => {
    if (currentPageFilter < availablePages.length) {
      const newPage = currentPageFilter + 1
      setCurrentPageFilter(newPage)
      setSelectedPageFilter(availablePages[newPage - 1])
      scrollToTop()
    }
  }, [currentPageFilter, availablePages, scrollToTop])

  const showAllPages = useCallback(() => {
    setSelectedPageFilter(null)
    setCurrentPageFilter(1)
    scrollToTop()
  }, [scrollToTop])

  const startPageNavigation = useCallback(() => {
    if (availablePages.length > 0) {
      setSelectedPageFilter(availablePages[0])
      setCurrentPageFilter(1)
      scrollToTop()
    }
  }, [availablePages, scrollToTop])

  // Navigate PDF to specific page when clicking on key-value pair
  const navigateToPage = useCallback(async (pageNumber: number) => {
    if (pageNumber && pageNumber > 0 && pageNumber !== pdfCurrentPage) {
      setIsNavigating(true)
      
      // Immediate page change for faster response
      setPdfCurrentPage(pageNumber)
      
      // Shorter feedback duration for better responsiveness
      setTimeout(() => {
        setIsNavigating(false)
      }, 300)
    }
  }, [pdfCurrentPage])

  // Optimized useEffect hooks for better performance
  
  // Handle page filter synchronization
  useEffect(() => {
    if (selectedPageFilter !== null && availablePages.length > 0) {
      const pageIndex = availablePages.indexOf(selectedPageFilter)
      if (pageIndex !== -1) {
        setCurrentPageFilter(pageIndex + 1)
      }
    }
  }, [selectedPageFilter, availablePages])
  
  // Handle PDF page synchronization when page filter changes
  useEffect(() => {
    if (selectedPageFilter !== null && selectedPageFilter !== pdfCurrentPage) {
      setPdfCurrentPage(selectedPageFilter)
    }
  }, [selectedPageFilter, pdfCurrentPage])
  
  // Handle navigation state reset when switching between filtered and all pages view
  useEffect(() => {
    if (selectedPageFilter === null) {
      setCurrentPageFilter(1)
    }
  }, [selectedPageFilter])

  // Set initial page filter when data loads
  useEffect(() => {
    if (availablePages.length > 0 && selectedPageFilter === null) {
      setSelectedPageFilter(availablePages[0])
      setCurrentPageFilter(1)
    }
  }, [availablePages, selectedPageFilter])

  // Memoized filter for better performance
  const filteredKeyValuePairs = useMemo(() => {
    return keyValuePairs.filter((pair) => {
      // Search filter
      const matchesSearch = !searchQuery.trim() || (
        pair.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pair.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
      
      // Page filter
      const matchesPage = selectedPageFilter === null || pair.page === selectedPageFilter
      
      return matchesSearch && matchesPage
    })
  }, [keyValuePairs, searchQuery, selectedPageFilter])

  const clearSearch = useCallback(() => {
    setSearchQuery("")
  }, [])

  const addNewKeyValuePair = useCallback(() => {
    const newPair: KeyValuePair = {
      id: `new-${Date.now()}`, // Generate unique ID
      key: "",
      value: "",
      confidence: 1.0, // Default to high confidence for manually added pairs
      bbox: undefined,
      page: undefined
    }
    setKeyValuePairs((prev) => [...prev, newPair])
    setSelectedPair(newPair.id) // Auto-select the new pair for editing
    
    // Auto-scroll to the bottom after a short delay to ensure the new card is rendered
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
    }, 50) // Reduced delay for faster response
  }, [])

  const saveData = () => {
    const dataToSave = {
      keyValuePairs,
      comments,
      timestamp: new Date().toISOString(),
      docId
    }
    console.log("Saving extracted data:", dataToSave)
    alert("Data saved successfully!")
  }

  function markAnalyzedAndSave() {
    try {
      const id = docId || localStorage.getItem("currentDocId") || ""
      // Persist table visibility cache and analyzed status
      localStorage.setItem("brr:analysis:active", "true")
      const storedDocs = localStorage.getItem("analyzedDocs")
      const existing = storedDocs ? JSON.parse(storedDocs) as string[] : []
      const set = new Set(existing)
      if (id) set.add(id)
      localStorage.setItem("analyzedDocs", JSON.stringify(Array.from(set)))
      localStorage.setItem("brr:lastAnalyzedAt", String(Date.now()))
      
      // Mark analysis as permanently completed to prevent data clearing
      localStorage.setItem("brr:analysis:completed", "true")
      
      // Preserve existing analysis data - don't overwrite it
      const existingAnalysisData = localStorage.getItem("brr:analysis:data")
      if (!existingAnalysisData) {
        // Only set minimal data if no analysis data exists
        localStorage.setItem("brr:analysis:data", JSON.stringify({ 
          found: ["DOCX", "PDF", "XLSX"], 
          expected: ["DOCX", "PDF", "XLSX", "PNG", "JPG"], 
          missing: ["PNG", "JPG"] 
        }))
      }
      
      // Don't redirect - keep user on analyze page
      console.log("Analysis marked as completed for document:", id)
    } catch (error) {
      console.error("Error saving analysis data:", error)
    }
  }

  const handleDone = () => {
    saveData()
    markAnalyzedAndSave()
    // Navigate back to home page with analyzed document ID
    router.push(`/?analyzedId=${encodeURIComponent(docId || '')}`)
  }

  const goToChecklist = () => {
    router.push("/checklist")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-6 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">IT</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {isViewMode ? "Document Viewer" : "Document Analysis"} – <span className="text-blue-600">ITSoli</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={goToChecklist} variant="outline">
                Generate Checklist
              </Button>
            </div>
          </div>
          {docId && (
            <div className="mt-2 text-sm text-gray-600">
              Analyzing document ID: <span className="font-medium">{docId}</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Document Viewer */}
        <div className="w-3/5 bg-white border-r flex flex-col">
          <div className="h-180 min-h-80 max-h-screen overflow-hidden">
            <PDFViewer
              pdfUrl={`/api/pdf?filename=${docId}.pdf`}
              bboxData={bboxData}
              selectedKey={selectedPair || ""}
              onBboxClick={setSelectedPair}
              zoom={zoom}
              onZoomChange={setZoom}
              onTotalPagesChange={setTotalPages}
              currentPage={pdfCurrentPage}
              onCurrentPageChange={setPdfCurrentPage}
            />
          </div>
          
          {/* Comments Section */}
          <div className="py-4 px-4 border-t bg-gray-50">
            <div className="text-xs text-gray-600 mb-3 font-medium uppercase tracking-wide">Comments</div>
            <div className="relative">
              <Textarea
                value={comments}
                onChange={(e) => {
                  if (!isViewMode && e.target.value.length <= 500) {
                    setComments(e.target.value)
                  }
                }}
                placeholder={isViewMode ? "No comments available" : "Enter your comments here..."}
                className="min-h-16 resize-none pr-16 text-sm border-2 border-emerald-400 focus:border-emerald-500 focus-visible:ring-emerald-400 focus-visible:ring-2 rounded-md"
                rows={3}
                maxLength={500}
                readOnly={isViewMode}
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                {comments.length}/500
              </div>
            </div>
          </div>


        </div>

        {/* Right Panel - Extracted Data */}
        <div className="w-2/5 flex flex-col">

          
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-start justify-between gap-4">
              {/* Page Metadata Section */}
              {Object.keys(pageMetadata).length > 0 && (() => {
                const currentPage = selectedPageFilter || (availablePages.length > 0 ? availablePages[0] : 1)
                const metadata = pageMetadata[currentPage]
                if (!metadata) return null
                
                return (
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 uppercase tracking-wider mb-2">
                      Page {selectedPageFilter || currentPage}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-medium">Watermark:</span>
                        <Badge 
                          variant="outline" 
                          className={`text-sm px-3 py-1 h-7 ${
                            metadata.watermark_presence?.toLowerCase() === 'no' 
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : metadata.watermark_presence?.toLowerCase() === 'yes'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {metadata.watermark_presence || '?'}
                        </Badge>
                      </div>
                      
                      {metadata.typed_vs_handwritten && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-sm px-3 py-1 h-7 bg-blue-50 text-blue-700 border-blue-200">
                            Typed: {metadata.typed_vs_handwritten.typed || 0}%
                          </Badge>
                          <Badge variant="outline" className="text-sm px-3 py-1 h-7 bg-orange-50 text-orange-700 border-orange-200">
                            Handwritten: {metadata.typed_vs_handwritten.handwritten || 0}%
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
              
              {/* Add Additional Values Button */}
              {!isViewMode && (
                <div className="flex-shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addNewKeyValuePair}
                    className="text-xs"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    add additional values
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div className="p-4 border-b bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            {/* Page Navigation and Summary */}
            <div className="mt-3 flex items-start gap-6">
              {/* Page Navigation */}
              {availablePages.length > 1 && (
                <div className="flex-shrink-0">
                  <div className="text-xs font-medium text-gray-600 mb-2">Navigate Pages:</div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectedPageFilter === null ? startPageNavigation : goToPreviousPage}
                        disabled={selectedPageFilter !== null && currentPageFilter === 1}
                        className="text-xs h-7 w-7 p-0"
                        title={selectedPageFilter === null ? "Start browsing pages" : "Previous page"}
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </Button>
                      
                      <span className="text-xs text-gray-600 px-2 min-w-[80px] text-center">
                        {selectedPageFilter === null 
                          ? "Browse" 
                          : `Page ${selectedPageFilter} of ${availablePages.length}`
                        }
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectedPageFilter === null ? startPageNavigation : goToNextPage}
                        disabled={selectedPageFilter !== null && currentPageFilter === availablePages.length}
                        className="text-xs h-7 w-7 p-0"
                        title={selectedPageFilter === null ? "Start browsing pages" : "Next page"}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Summary */}
               <div className="flex-shrink-0">
                 <div className="text-xs font-medium text-gray-600 mb-2">Summary:</div>
                 <div className="text-xs">
                   <div>
                     <span className="text-gray-600">
                       {searchQuery ? "Filtered Pairs:" : "Total Pairs:"}
                     </span>
                     <span className="ml-2 font-medium text-gray-900">
                       {searchQuery ? `${filteredKeyValuePairs.length} of ${keyValuePairs.length}` : keyValuePairs.length}
                     </span>
                   </div>
                 </div>
               </div>
            </div>
            

          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-auto">
            {keyValuePairs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Edit3 className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No Key/Value Pairs Found</p>
                <p className="text-sm text-center mt-2">
                  This document doesn't have any extracted key/value pairs to display.
                </p>
              </div>
            ) : filteredKeyValuePairs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Search className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No Results Found</p>
                <p className="text-sm text-center mt-2">
                  No key/value pairs match your search query "{searchQuery}".
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSearch}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              </div>
            ) : (
              <div className="space-y-6 p-6">
                {filteredKeyValuePairs.map((pair, index) => (
                  <Card 
                    key={pair.id} 
                    className={`transition-all duration-200 cursor-pointer ${
                      selectedPair === pair.id 
                        ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200 shadow-md" 
                        : "hover:shadow-md hover:border-gray-300"
                    } ${
                      isNavigating && selectedPair === pair.id 
                        ? "animate-pulse bg-blue-100" 
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedPair(selectedPair === pair.id ? null : pair.id)
                      // Navigate to the page if the pair has a page number
                      if (pair.page) {
                        navigateToPage(pair.page)
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs font-mono">
                              #{index + 1}
                            </Badge>
                            {pair.page && (
                              <Badge variant="outline" className="text-xs font-medium bg-blue-100 text-blue-800 border-blue-200">
                                Page {pair.page}
                              </Badge>
                            )}
                            {selectedPair === pair.id && (
                              <Badge variant="default" className="text-xs bg-blue-600">
                                <Eye className="w-3 h-3 mr-1" />
                                Selected
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            {/* Label Field */}
                            <div>
                              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1 block">
                                Label
                              </label>
                              <Input
                                value={pair.key}
                                onChange={(e) => !isViewMode && updateKeyValue(pair.id, "key", e.target.value)}
                                className="border-0 bg-transparent p-2 text-sm font-medium focus:bg-white focus:border focus:border-gray-300 focus:shadow-sm"
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Enter label..."
                                readOnly={isViewMode}
                              />
                            </div>
                            
                            {/* Information Field */}
                            <div>
                              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1 block">
                                Information
                              </label>
                              <Textarea
                                value={pair.value}
                                onChange={(e) => !isViewMode && updateKeyValue(pair.id, "value", e.target.value)}
                                className="border-0 bg-transparent p-2 text-sm min-h-12 resize-none focus:bg-white focus:border focus:border-gray-300 focus:shadow-sm"
                                rows={2}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Enter information..."
                                readOnly={isViewMode}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 ml-4">
                          {!isViewMode && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Item</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this item? This action cannot be undone.
                                    <br/><br/>
                                    <strong>Label:</strong> {pair.key}<br/>
                                    <strong>Information:</strong> {pair.value}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteKeyValue(pair.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedPair(selectedPair === pair.id ? null : pair.id)
                            }}
                            title={selectedPair === pair.id ? "Hide bounding boxes" : "Show bounding boxes"}
                          >
                            {selectedPair === pair.id ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          
                          {selectedPair === pair.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedPair(null)
                              }}
                              title="Clear selection"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Summary section moved to be beside navigation pages */}



          {/* Action Buttons */}
          {!isViewMode && (
            <div className="p-4 border-t bg-white flex space-x-3">
              <Button onClick={saveData} variant="outline" className="flex-1 bg-transparent">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button onClick={handleDone} className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
