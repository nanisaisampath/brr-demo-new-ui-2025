"use client"

import { useEffect, useMemo, useState, useRef, memo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import {
  ArrowUpDown,
  Eye,
  Trash2,
  CheckCircle,
} from "lucide-react"

type Status = "success" | "pending" | "error"

interface ClassificationRow {
  id: string
  fileName: string
  docType: string
  confidence: number
  status: Status
}




type SortKey = "fileName" | "confidence"
type SortDir = "asc" | "desc"

interface ClassificationResultsProps {
  analysisData: any
  sessionId?: string
}

const ClassificationResults = memo(function ClassificationResults({ analysisData, sessionId }: ClassificationResultsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const analyzedId = searchParams?.get("analyzedId") || null

  // Classification data state
  const [classificationRows, setClassificationRows] = useState<ClassificationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set<string>())
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set<string>())
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const [columnWidths, setColumnWidths] = useState<number[]>([])

  // Required document types list
  const requiredDocTypes = useMemo(
    () => [
      "Analytical Testing Reports / Lab Data Sheets",
      "Batch Record Summary",
      "Calibration Certificates",
      "Change Control",
      "Cleaning Logs for Rooms and Tools",
      "Certificates of Analysis (COAs)",
      "CAPA (Corrective and Preventive Action) Documentation",
      "Cleaning verification Report",
      "Deviation Reports / Non-Conformance Reports (NCRs)",
      "Equipment Cleaning Records",
      "Environmental Monitoring Reports",
      "Investigation Reports",
      "Material Reconciliation Sheets",
      "Material Receipt & Sampling Logs",
      "Process Change Tracking Document",
      "Packaging Records",
    ],
    []
  )

  // Filters/sort
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all")
  const [sortKey, setSortKey] = useState<SortKey>("fileName")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  // Analyzed docs persisted
  const [analyzedDocs, setAnalyzedDocs] = useState<Set<string>>(new Set())

  // Load classification data from analysisData when available
  useEffect(() => {
    if (analysisData) {
      setIsLoading(true)
      
      // Convert analysisData to classification rows format
      try {
        // Check if we have actual classification data from the scan
        const rawScanData = localStorage.getItem("brr:scan:rawData")
        if (rawScanData) {
          const scanData = JSON.parse(rawScanData)
          // Handle the correct data structure: scanData is an array with batchDocs inside the first element
          const batchDocs = Array.isArray(scanData) && scanData.length > 0 ? scanData[0]?.batchDocs || [] : scanData?.batchDocs || []
          
          if (batchDocs.length > 0) {
            // Convert the actual scan results to ClassificationRow format
            const classificationRows = batchDocs.map((doc: any, index: number) => {
              // Extract filename without extension to use as ID
              const baseFileName = doc.fileName ? doc.fileName.replace(/\.[^/.]+$/, "") : `document_${index + 1}`
              
              return {
                id: baseFileName, // Use actual filename without extension as ID
                fileName: doc.fileName || 'Unknown File',
                docType: doc.documentClass || 'Unknown',
                confidence: doc.matchedConfidenceScore || 0,
                status: doc.classficationStatus ? "success" as Status : "error" as Status
              }
            })
            
            setClassificationRows(classificationRows)
            console.log('Loaded classification data:', classificationRows)
          } else {
            setClassificationRows([])
          }
        } else {
          setClassificationRows([])
        }
      } catch (error) {
        console.error('Error processing analysis data:', error)
        setClassificationRows([])
      } finally {
        setIsLoading(false)
      }
    } else {
      setClassificationRows([])
      setIsLoading(false)
    }
  }, [analysisData, sessionId])

  // Append missing required document placeholders based on current rows
  useEffect(() => {
    if (isLoading) return
    // Derive found doc types from current rows (exclude placeholders already added)
    const existingIds = new Set(classificationRows.map((r) => r.id))
    const foundTypes = new Set(
      classificationRows
        .filter((r) => !r.id.startsWith("missing-") && r.status !== "error")
        .map((r) => r.docType.trim())
    )

    const placeholders: ClassificationRow[] = []
    const newMissingIds: string[] = []

    requiredDocTypes.forEach((docType) => {
      if (!foundTypes.has(docType)) {
        const placeholderId = `missing-${docType.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`
        if (!existingIds.has(placeholderId)) {
          placeholders.push({
            id: placeholderId,
            fileName: `${docType} (missing)`,
            docType,
            confidence: 0,
            status: "pending",
          })
        }
        newMissingIds.push(placeholderId)
      }
    })

    if (placeholders.length > 0) {
      setClassificationRows((prev) => [...prev, ...placeholders])
    }
    if (newMissingIds.length > 0) {
      setMissingIds((prev) => new Set<string>([...prev, ...newMissingIds]))
    }
  }, [classificationRows, isLoading, requiredDocTypes])

  // Measure first data row cell widths to align static header columns
  useEffect(() => {
    const computeColumnWidths = () => {
      try {
        const container = tableContainerRef.current
        if (!container) return
        const firstRow = container.querySelector('tbody tr') as HTMLTableRowElement | null
        if (!firstRow) return
        const cells = Array.from(firstRow.children) as HTMLElement[]
        if (cells.length < 4) return
        const widths = cells.slice(0, 4).map((el) => Math.round(el.getBoundingClientRect().width))
        setColumnWidths(widths)
      } catch {
        // ignore measurement failures
      }
    }

    // Compute on mount and when data changes
    const timeout = setTimeout(computeColumnWidths, 0)
    window.addEventListener('resize', computeColumnWidths)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', computeColumnWidths)
    }
  }, [classificationRows.length, isLoading])



  // Use loaded classification data, fallback to analysis data if no real data
  const classificationData = useMemo(() => {
    // Use classification data from actual analysis
    if (classificationRows.length > 0) {
      return classificationRows
    }
    
    // Fallback to analysis data if no real data is loaded
    if (analysisData && analysisData.found && Array.isArray(analysisData.found)) {
      // Convert the analysis data to the expected ClassificationRow format
      return analysisData.found.map((fileType: string, index: number) => {
        // Create more realistic file names based on file type
        const fileNameMap: { [key: string]: string } = {
          'DOCX': 'requirements_document.docx',
          'PDF': 'system_specification.pdf', 
          'XLSX': 'data_mapping.xlsx',
          'PNG': 'wireframe_design.png',
          'JPG': 'screenshot.jpg'
        }
        
        const docTypeMap: { [key: string]: string } = {
          'DOCX': 'BRD',
          'PDF': 'Architecture',
          'XLSX': 'Mapping',
          'PNG': 'UI Design',
          'JPG': 'Screenshot'
        }
        
        return {
          id: `analysis-${fileType}-${index}`,
          fileName: fileNameMap[fileType] || `${fileType.toLowerCase()}_file.${fileType.toLowerCase()}`,
          docType: docTypeMap[fileType] || fileType,
          confidence: 0.85 + (Math.random() * 0.15), // Simulate confidence between 85-100%
          status: "success" as Status
        }
      })
    }
    
    return []
  }, [classificationRows, analysisData?.found])

  // Load analyzed docs on mount
  useEffect(() => {
    try {
      const storedData = localStorage.getItem("analyzedDocs")
      if (storedData) {
        const stored = JSON.parse(storedData) as string[]
        setAnalyzedDocs(new Set(stored))
      }
    } catch (error) {
      console.warn('Failed to parse analyzedDocs from localStorage:', error)
      // Clear corrupted data
      localStorage.removeItem("analyzedDocs")
    }
  }, [])

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "analyzedDocs" && e.newValue) {
        try {
          const arr = JSON.parse(e.newValue) as string[]
          setAnalyzedDocs(new Set(arr))
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // Apply analyzedId from URL exactly once when it changes
  useEffect(() => {
    if (!analyzedId) return
    setAnalyzedDocs((prev) => {
      if (prev.has(analyzedId)) return prev
      const next = new Set(prev)
      next.add(analyzedId)
      try {
        localStorage.setItem("analyzedDocs", JSON.stringify(Array.from(next)))
        localStorage.setItem("brr:analysis:active", "true")
      } catch {
        // ignore
      }
      return next
    })
  }, [analyzedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return classificationData.filter((row: ClassificationRow) => {
      const matchesQ = !q || row.fileName.toLowerCase().includes(q) || row.docType.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || row.status === statusFilter
      return matchesQ && matchesStatus
    })
  }, [classificationData, query, statusFilter])

  const sorted = useMemo(() => {
    const sortedCopy = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      if (sortKey === "confidence") {
        return (a.confidence - b.confidence) * dir
      }
      return String(a[sortKey]).localeCompare(String(b[sortKey])) * dir
    })
    return sortedCopy
  }, [filtered, sortKey, sortDir])

  // Ensure deleted/missing rows appear at the bottom without affecting other sorting
  const paged = useMemo(() => {
    if (deletedIds.size === 0 && missingIds.size === 0) return sorted
    const isActive = (r: ClassificationRow) => !deletedIds.has(r.id) && !missingIds.has(r.id)
    const isDeleted = (r: ClassificationRow) => deletedIds.has(r.id)
    const isMissing = (r: ClassificationRow) => missingIds.has(r.id)
    const activeRows = sorted.filter(isActive)
    const deletedRows = sorted.filter(isDeleted)
    const missingRows = sorted.filter(isMissing)
    return [...activeRows, ...deletedRows, ...missingRows]
  }, [sorted, deletedIds, missingIds])

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  

  function handleAnalyze(row: ClassificationRow) {
    try {
      localStorage.setItem("currentDocId", row.id)
      localStorage.setItem("brr:analysis:active", "true")
    } catch {
      // ignore
    }
    router.push(`/analyze?docId=${encodeURIComponent(row.id)}`)
  }

  function handleView(row: ClassificationRow) {
    // Open the raw PDF in a new tab, similar to right-click → View PDF
    // This avoids toggling analysis state and provides a quick preview
    const pdfUrl = `/api/pdf?filename=${encodeURIComponent(row.id)}.pdf`
    try {
      localStorage.setItem("currentDocId", row.id)
    } catch {
      // ignore localStorage failures
    }
    window.open(pdfUrl, "_blank", "noopener,noreferrer")
  }

  function handleMarkAllForAnalysis() {
    if (classificationData.length === 0) return
    
    const allDocIds = classificationData.map((row: ClassificationRow) => row.id)
    const allMarked = analyzedDocs.size === classificationData.length
    
    if (allMarked) {
      // Clear all markings
      setAnalyzedDocs(new Set<string>())
      try {
        localStorage.setItem("analyzedDocs", JSON.stringify([]))
        console.log('Cleared all document markings')
      } catch {
        // ignore
      }
    } else {
      // Mark all for analysis
      const newAnalyzedDocs = new Set<string>(allDocIds)
      setAnalyzedDocs(newAnalyzedDocs)
      try {
        localStorage.setItem("analyzedDocs", JSON.stringify(allDocIds))
        localStorage.setItem("brr:analysis:active", "true")
        console.log('Marked all documents for analysis:', allDocIds)
      } catch {
        // ignore
      }
    }
  }

  const isAnalyzed = (id: string) => analyzedDocs.has(id)

  return (
    <Card className="shadow-md border-slate-200/70 overflow-hidden mr-2">
      {/* Gradient top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-600 to-blue-600" aria-hidden />
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Classification Results
              </span>
            </CardTitle>
            {classificationData.length > 0 && (
              <p className="text-sm text-slate-600 mt-1">
                {analyzedDocs.size} of {classificationData.length} documents marked for analysis
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-72">
              <Input
                placeholder="Search by name or type..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                }}
                className="h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-9 whitespace-nowrap">
                Upload File
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 whitespace-nowrap"
                onClick={handleMarkAllForAnalysis}
                disabled={classificationData.length === 0}
              >
                {analyzedDocs.size === classificationData.length ? 'Clear All Markings' : 'Analyze All'}
              </Button>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as Status | "all")
                }}
              >
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="relative -mx-4 sm:mx-0">
          {/* Static header bar */}
          <div className="bg-white z-20">
            <div
              className="min-w-[900px] grid items-center px-2 py-2 border-b"
              style={{
                gridTemplateColumns: columnWidths.length === 4
                  ? `${columnWidths[0]}px ${columnWidths[1]}px ${columnWidths[2]}px ${columnWidths[3]}px`
                  : undefined
              }}
            >
              <div className="whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-1 -ml-1 text-slate-700 hover:text-slate-900"
                  onClick={() => onSort("fileName")}
                >
                  File Name
                  <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="whitespace-nowrap text-slate-700 text-sm font-medium">Document Class</div>
              <div className="whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-1 -ml-1 text-slate-700 hover:text-slate-900"
                  onClick={() => onSort("confidence")}
                >
                  Confidence Score
                  <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="text-right whitespace-nowrap text-slate-700 text-sm font-medium">Actions</div>
            </div>
          </div>

          <div className="max-h-[600px] overflow-auto" ref={tableContainerRef}>
            <div className="overflow-x-auto">
              <Table id="classification-results-table" className="min-w-[900px]">
              <TableHeader className="hidden">
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Document Class</TableHead>
                  <TableHead>Confidence Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                      Loading classification data...
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {paged.map((row: ClassificationRow, idx) => {
                      const analyzed = isAnalyzed(row.id)
                      const isDeleted = deletedIds.has(row.id)
                      const isMissing = missingIds.has(row.id)
                      return (
                        <TableRow
                          key={row.id}
                                          className={`transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-slate-100/70`}
                        >
                          <TableCell className="font-medium">
                             <div className="flex items-center gap-2">
                               <span>{row.fileName}</span>
                               {analyzed && !isDeleted && !isMissing && (
                                 <span
                                   className="inline-flex items-center rounded-full bg-emerald-50 p-0.5"
                                   title="Analyzed"
                                   aria-label="Analyzed"
                                 >
                                   <CheckCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                                   <span className="sr-only">Analyzed</span>
                                 </span>
                               )}
                               {isDeleted && (
                                 <Badge className="bg-rose-100 text-rose-700 border border-rose-200">Deleted</Badge>
                               )}
                               {isMissing && (
                                 <Badge className="bg-red-100 text-red-700 border border-red-200">Missing</Badge>
                               )}
                             </div>
                           </TableCell>
                           <TableCell>
                             <span className="text-sm text-slate-600">{row.docType}</span>
                           </TableCell>
                           <TableCell>
                             <Badge 
                               variant="outline"
                               className={`tabular-nums font-medium ${
                                 row.confidence >= 0.8 
                                   ? "bg-green-100 text-green-800 border-green-200" 
                                   : row.confidence >= 0.6 
                                     ? "bg-yellow-100 text-yellow-800 border-yellow-200" 
                                     : "bg-red-100 text-red-800 border-red-200"
                               }`}
                             >
                               {(row.confidence * 100).toFixed(0)}%
                             </Badge>
                           </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {!isMissing && (
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => handleAnalyze(row)}
                                variant={analyzed ? "outline" : "default"}
                                aria-label={analyzed ? `Re-analyze ${row.fileName}` : `Analyze ${row.fileName}`}
                                disabled={isDeleted}
                              >
                                {analyzed ? "Re-analyze" : "Analyze"}
                              </Button>
                              )}
                              {!isMissing && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8" 
                                aria-label="View"
                                onClick={() => handleView(row)}
                                disabled={isDeleted}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              )}
                              {/* Delete / Reload */}
                              {!isDeleted && !isMissing ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                      aria-label="Delete"
                                      title={`Delete ${row.fileName}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete file?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will mark "{row.fileName}" as deleted in the list. You can reload it later.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          setDeletedIds(prev => new Set<string>([...prev, row.id]))
                                        }}
                                        className="bg-rose-600 hover:bg-rose-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : isDeleted ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => setDeletedIds(prev => {
                                    const copy = new Set<string>(prev)
                                    copy.delete(row.id)
                                    return copy
                                  })}
                                >
                                  Reload
                                </Button>
                              ) : (
                                <Button size="sm" className="h-8" variant="outline">
                                  Upload File
                                </Button>
                              )}
                              {isDeleted && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-8"
                                      title="Delete permanently"
                                    >
                                      Delete Permanently
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. The file will move to the Missing list and require an upload.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          setDeletedIds(prev => {
                                            const copy = new Set<string>(prev)
                                            copy.delete(row.id)
                                            return copy
                                          })
                                          setMissingIds(prev => new Set<string>([...prev, row.id]))
                                        }}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Yes, delete permanently
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {paged.length === 0 && !isLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                          No results found. Try adjusting your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>


      </CardContent>
    </Card>
  )
})

export default ClassificationResults
