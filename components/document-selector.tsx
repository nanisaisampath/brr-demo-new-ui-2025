'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { FileText, CheckCircle, Circle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentItem {
  filename: string
  filepath: string
  document_type: string
  size?: number
  last_modified?: string
  selected: boolean
}

interface DocumentListResponse {
  documents: DocumentItem[]
  total_count: number
}

interface DocumentSelectorProps {
  onProcessSelected: (selectedFiles: string[]) => void
  onCancel: () => void
  isProcessing?: boolean
}

export function DocumentSelector({ onProcessSelected, onCancel, isProcessing = false }: DocumentSelectorProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const API_BASE_URL = 'http://localhost:8000'

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/documents/list`)
      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }
      
      const data: DocumentListResponse = await response.json()
      setDocuments(data.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileToggle = (filename: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(filename)) {
      newSelected.delete(filename)
    } else {
      newSelected.add(filename)
    }
    setSelectedFiles(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === documents.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(documents.map(doc => doc.filename)))
    }
  }

  const handleProcessConfirm = () => {
    onProcessSelected(Array.from(selectedFiles))
    setShowConfirmDialog(false)
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    return `${mb.toFixed(1)} MB`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return 'Invalid date'
    }
  }

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'ATR': 'bg-blue-100 text-blue-800',
      'BRS': 'bg-green-100 text-green-800',
      'CCI': 'bg-purple-100 text-purple-800',
      'CC': 'bg-orange-100 text-orange-800',
      'CLR': 'bg-red-100 text-red-800',
      'COA': 'bg-yellow-100 text-yellow-800',
      'CS': 'bg-indigo-100 text-indigo-800',
      'CVR': 'bg-pink-100 text-pink-800',
      'DR': 'bg-gray-100 text-gray-800',
      'ECR': 'bg-teal-100 text-teal-800',
      'EMR': 'bg-cyan-100 text-cyan-800',
      'IR': 'bg-lime-100 text-lime-800',
      'MRS': 'bg-emerald-100 text-emerald-800',
      'MRSL': 'bg-violet-100 text-violet-800',
      'PCTD': 'bg-rose-100 text-rose-800',
      'PR': 'bg-amber-100 text-amber-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <Button onClick={fetchDocuments} className="mt-4" variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Select Documents to Process
        </CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {documents.length} documents available • {selectedFiles.size} selected
          </p>
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size="sm"
            disabled={documents.length === 0}
          >
            {selectedFiles.size === documents.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No documents found</p>
            <p className="text-sm">Please ensure documents are available in the system</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-64 mb-4">
              <div className="space-y-2">
                {documents.map((doc) => {
                  const isSelected = selectedFiles.has(doc.filename)
                  return (
                    <div
                      key={doc.filename}
                      className={cn(
                        'flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-gray-50',
                        isSelected ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                      )}
                      onClick={() => handleFileToggle(doc.filename)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleFileToggle(doc.filename)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{doc.filename}</span>
                          <Badge className={cn('text-xs', getDocumentTypeColor(doc.document_type))}>
                            {doc.document_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>{formatDate(doc.last_modified)}</span>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
            
            <div className="flex justify-between gap-3">
              <Button onClick={onCancel} variant="outline" disabled={isProcessing}>
                Cancel
              </Button>
              
              <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={selectedFiles.size === 0 || isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : selectedFiles.size === 0 ? (
                      'Process'
                    ) : (
                      `Process ${selectedFiles.size} Selected Document${selectedFiles.size !== 1 ? 's' : ''}`
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Document Processing</AlertDialogTitle>
                    <AlertDialogDescription>
                      You are about to process {selectedFiles.size} selected document{selectedFiles.size !== 1 ? 's' : ''}:
                    </AlertDialogDescription>
                    <div className="mt-2 space-y-1">
                      {Array.from(selectedFiles).map(filename => (
                        <div key={filename} className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {filename}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      This will clear any previously loaded documents and load only the selected ones.
                    </p>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleProcessConfirm}>
                      Process Documents
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default DocumentSelector