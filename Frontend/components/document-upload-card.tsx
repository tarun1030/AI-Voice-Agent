'use client'

import { Upload, Trash2, FileText, Calendar, RefreshCw } from 'lucide-react'
import { useRef, useState, useEffect, useCallback } from 'react'

// Shape returned by GET /api/documents
interface ApiDocument {
  doc_id: string
  filename: string
  chunks: number
  created_at: string
}

interface DocumentUploadCardProps {
  onUpload: (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => void
  isUploading?: boolean
  /** Called after a document is successfully deleted, with its doc_id */
  onDeleteSuccess?: (docId: string) => void
}

export default function DocumentUploadCard({
  onUpload,
  isUploading = false,
  onDeleteSuccess,
}: DocumentUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [documents, setDocuments] = useState<ApiDocument[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  // ── Fetch document list from API ──────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setIsFetching(true)
    setFetchError(null)
    try {
      const res = await fetch('http://localhost:8000/api/documents')
      if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
      const data: { documents: ApiDocument[] } = await res.json()
      setDocuments(data.documents)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setIsFetching(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Re-fetch whenever an upload finishes
  useEffect(() => {
    if (!isUploading) {
      fetchDocuments()
    }
  }, [isUploading, fetchDocuments])

  // ── Delete a document by doc_id ───────────────────────────────────────────
  const handleDelete = async (docId: string) => {
    setDeletingIds((prev) => new Set(prev).add(docId))
    setDeleteErrors((prev) => {
      const next = { ...prev }
      delete next[docId]
      return next
    })

    try {
      const res = await fetch(`http://localhost:8000/api/documents/${docId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`Failed to delete document (${res.status})`)

      // Remove from local state immediately — no need to re-fetch
      setDocuments((prev) => prev.filter((d) => d.doc_id !== docId))
      onDeleteSuccess?.(docId)
    } catch (err) {
      setDeleteErrors((prev) => ({
        ...prev,
        [docId]: err instanceof Error ? err.message : 'Delete failed',
      }))
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(docId)
        return next
      })
    }
  }

  // ── Drag-and-drop helpers ─────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add('bg-white/10', 'border-white/50')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-white/10', 'border-white/50')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('bg-white/10', 'border-white/50')
    onUpload(e)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="glass-morphism-card rounded-2xl p-6 border border-white/10 backdrop-blur-xl bg-white/5 hover:bg-white/[0.08] transition-colors duration-300 animate-float-up shadow-2xl [animation-delay:0.1s]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Document Upload</h2>
        <button
          onClick={fetchDocuments}
          disabled={isFetching}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200 disabled:opacity-40"
          aria-label="Refresh documents"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed border-white/30 rounded-lg p-8 text-center transition-all duration-300 mb-6 ${
          isUploading
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-white/50 hover:bg-white/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onUpload}
          className="hidden"
          accept=".pdf,.docx,.txt"
          disabled={isUploading}
        />
        <Upload
          className={`w-10 h-10 mx-auto mb-3 ${
            isUploading ? 'animate-pulse text-gray-500' : 'text-gray-400'
          }`}
        />
        <p className="text-white font-medium mb-1">
          {isUploading ? 'Uploading...' : 'Drop files here or click to browse'}
        </p>
        <p className="text-sm text-gray-500">Supported: PDF, DOCX, TXT</p>
      </div>

      {/* Documents List */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {fetchError ? (
          <div className="text-center py-6">
            <p className="text-red-400 text-sm mb-2">{fetchError}</p>
            <button
              onClick={fetchDocuments}
              className="text-xs text-gray-400 hover:text-white underline transition-colors"
            >
              Try again
            </button>
          </div>
        ) : isFetching && documents.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 text-gray-500 mx-auto mb-2 animate-spin" />
            <p className="text-gray-500 text-sm">Loading documents…</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-50" />
            <p className="text-gray-500 text-sm">No documents uploaded yet</p>
          </div>
        ) : (
          documents.map((doc) => {
            const isDeleting = deletingIds.has(doc.doc_id)
            const deleteError = deleteErrors[doc.doc_id]

            return (
              <div
                key={doc.doc_id}
                className={`bg-white/5 border rounded-lg p-4 transition-all duration-200 group animate-slide-in-right ${
                  isDeleting ? 'opacity-50' : 'hover:bg-white/[0.08]'
                } ${deleteError ? 'border-red-500/40' : 'border-white/10'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium truncate">{doc.filename}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500">{doc.chunks} chunks</span>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {deleteError && (
                        <p className="text-xs text-red-400 mt-1">{deleteError}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => !isDeleting && handleDelete(doc.doc_id)}
                    disabled={isDeleting}
                    className={`ml-2 p-2 rounded-lg transition-all duration-200 flex-shrink-0 ${
                      isDeleting
                        ? 'text-gray-600 cursor-not-allowed opacity-100'
                        : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label={isDeleting ? 'Deleting…' : 'Delete document'}
                  >
                    {isDeleting ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12" cy="12" r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}