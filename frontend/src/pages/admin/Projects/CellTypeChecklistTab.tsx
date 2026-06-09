import { useCallback, useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/store/authStore'
import type { CellTypeChecklistDetail, CellTypeChecklistItem, TypeChecklistAnswer } from '@/types/projectWorkspace'
import {
  addCellCustomChecklistItem,
  deleteCellChecklistItem,
  downloadCellChecklistExport,
  fetchCellTypeChecklistResponses,
  updateCellCustomChecklistResponse,
  updateCellTypeChecklistResponse,
} from '@/services/projectTypeChecklistService'

const RESPONSE_OPTIONS: { value: TypeChecklistAnswer; label: string; className: string }[] = [
  { value: 'yes', label: 'Yes', className: 'is-yes' },
  { value: 'no', label: 'No', className: 'is-no' },
  { value: 'not_applicable', label: 'Not applicable', className: 'is-na' },
]

type CellTypeChecklistTabProps = {
  projectId: string
  cellId: string
}

export function CellTypeChecklistTab({ projectId, cellId }: CellTypeChecklistTabProps) {
  const authRole = useAuthStore((state) => state.role)
  const authUser = useAuthStore((state) => state.user)
  const isAdmin = authRole === 'admin' || authUser?.role === 'Admin'

  const [detail, setDetail] = useState<CellTypeChecklistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [commentOpen, setCommentOpen] = useState<Record<string, boolean>>({})
  const [pendingResponse, setPendingResponse] = useState<Record<string, TypeChecklistAnswer>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [addingQuestion, setAddingQuestion] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCellTypeChecklistResponses(projectId, cellId)
      setDetail(data)
      const drafts: Record<string, string> = {}
      const open: Record<string, boolean> = {}
      for (const item of data.items) {
        drafts[item.itemKey] = item.comment ?? ''
        if (item.response === 'no' || item.response === 'not_applicable') {
          open[item.itemKey] = true
        }
      }
      setCommentDrafts(drafts)
      setCommentOpen(open)
    } catch {
      toast.error('Failed to load checklist')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, cellId])

  useEffect(() => {
    void load()
  }, [load])

  const patchItem = (updated: CellTypeChecklistItem) => {
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) => (item.itemKey === updated.itemKey ? updated : item)),
          }
        : prev,
    )
  }

  const saveResponse = async (
    item: CellTypeChecklistItem,
    response: TypeChecklistAnswer,
    comment = '',
  ) => {
    if ((response === 'no' || response === 'not_applicable') && !comment.trim()) {
      setCommentOpen((prev) => ({ ...prev, [item.itemKey]: true }))
      toast.error('Please enter a comment for No or Not applicable')
      return
    }

    setSavingKey(item.itemKey)
    try {
      const payload = { response, comment: comment.trim() }
      const updated =
        item.source === 'custom' && item.customItemId
          ? await updateCellCustomChecklistResponse(projectId, cellId, item.customItemId, payload)
          : await updateCellTypeChecklistResponse(projectId, cellId, item.itemIndex!, payload)

      patchItem(updated)
      if (response === 'yes') {
        setCommentOpen((prev) => ({ ...prev, [item.itemKey]: false }))
        setCommentDrafts((prev) => ({ ...prev, [item.itemKey]: '' }))
      }
      toast.success('Response saved')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to save response')
    } finally {
      setSavingKey(null)
    }
  }

  const handleSelect = (item: CellTypeChecklistItem, response: TypeChecklistAnswer) => {
    if (response === 'no' || response === 'not_applicable') {
      setPendingResponse((prev) => ({ ...prev, [item.itemKey]: response }))
      setCommentOpen((prev) => ({ ...prev, [item.itemKey]: true }))
      return
    }
    void saveResponse(item, response)
  }

  const handleCommentSave = (item: CellTypeChecklistItem) => {
    const response = pendingResponse[item.itemKey]
    if (response !== 'no' && response !== 'not_applicable') return
    void saveResponse(item, response, commentDrafts[item.itemKey] ?? '')
  }

  const handleAddQuestion = async () => {
    const trimmed = newQuestion.trim()
    if (!trimmed) {
      toast.error('Enter a question')
      return
    }

    setAddingQuestion(true)
    try {
      await addCellCustomChecklistItem(projectId, cellId, trimmed)
      setNewQuestion('')
      setShowAddForm(false)
      await load()
      toast.success('Question added')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to add question')
    } finally {
      setAddingQuestion(false)
    }
  }

  const handleDeleteQuestion = async (item: CellTypeChecklistItem) => {
    if (!window.confirm('Delete this checklist question?')) return

    setDeletingKey(item.itemKey)
    try {
      await deleteCellChecklistItem(projectId, cellId, item.itemKey)
      setDetail((prev) =>
        prev ? { ...prev, items: prev.items.filter((entry) => entry.itemKey !== item.itemKey) } : prev,
      )
      toast.success('Question deleted')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to delete question')
    } finally {
      setDeletingKey(null)
    }
  }

  const handleDownload = async () => {
    if (!detail?.items.length) {
      toast.error('No checklist questions to export')
      return
    }

    const safeCellName = (detail.cellName || 'cell').replace(/[^\w.-]+/g, '_')
    const fileName = `${detail.cellType}-${safeCellName}-checklist.xlsx`

    try {
      await downloadCellChecklistExport(projectId, cellId, fileName)
    } catch {
      toast.error('Failed to download checklist')
    }
  }

  const answeredCount = detail?.items.filter((item) => item.response).length ?? 0
  const totalCount = detail?.items.length ?? 0

  if (loading) {
    return (
      <div className="admin-projects-cell-checklist-tab admin-projects-cell-checklist-tab--loading">
        <p className="text-sm text-slate-500">Loading checklist…</p>
      </div>
    )
  }

  const resolvedType = detail?.cellType
  const hasItems = (detail?.items.length ?? 0) > 0

  if (!detail?.hasFile && !hasItems) {
    return (
      <div className="admin-projects-cell-checklist-tab">
        <div className="admin-projects-cell-checklist-empty">
          <FileSpreadsheet className="h-8 w-8 text-emerald-700" aria-hidden />
          <p className="admin-projects-cell-checklist-empty-title">No checklist yet</p>
          <p className="admin-projects-cell-checklist-empty-text">
            No checklist file for cell type <strong>{resolvedType || '—'}</strong> in this project.
          </p>
          {detail?.libraryName ? (
            <p className="admin-projects-cell-checklist-empty-meta">
              {detail.cellName} · {detail.libraryName}
            </p>
          ) : null}
          <p className="admin-projects-cell-checklist-empty-text">
            Upload a type checklist from the project Checklist tab, or add custom questions below.
          </p>
        </div>
        {isAdmin ? renderAddQuestionSection() : null}
      </div>
    )
  }

  return (
    <div className="admin-projects-cell-checklist-tab">
      <div className="admin-projects-cell-checklist-tab-head">
        <div className="admin-projects-cell-checklist-tab-head-main">
          <div className="admin-projects-cell-checklist-type-badge">{resolvedType || '—'}</div>
          <div className="admin-projects-cell-type-checklist-file">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="admin-projects-cell-checklist-file-name" title={detail?.fileName || 'Custom checklist'}>
                {detail?.fileName || 'Custom questions'}
              </p>
              <div className="admin-projects-cell-checklist-meta-chips">
                <span>{detail?.cellName}</span>
                <span>{detail?.libraryName || 'Library'}</span>
                <span>Type matched</span>
              </div>
            </div>
          </div>
        </div>
        <div className="admin-projects-cell-checklist-tab-head-side">
          <div className="admin-projects-cell-checklist-progress">
            <span className="admin-projects-cell-checklist-progress-value">
              {answeredCount}/{totalCount}
            </span>
            <span className="admin-projects-cell-checklist-progress-label">answered</span>
          </div>
          <div className="admin-projects-cell-checklist-tab-actions">
            {isAdmin ? (
              <Button size="sm" variant="secondary" onClick={() => setShowAddForm((prev) => !prev)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add question
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void handleDownload()} disabled={!hasItems}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download Excel
            </Button>
          </div>
        </div>
      </div>

      {isAdmin && showAddForm ? renderAddQuestionSection() : null}

      {!hasItems ? (
        <p className="admin-projects-cell-checklist-empty-inline">
          No checklist questions yet. {isAdmin ? 'Use Add question to create one.' : ''}
        </p>
      ) : (
        <div className="admin-projects-checklist-responses admin-projects-checklist-responses--cell-tab">
          <ul className="admin-projects-checklist-responses-list">
            {detail!.items.map((item, index) => {
              const needsComment = item.response === 'no' || item.response === 'not_applicable'
              const showComment = commentOpen[item.itemKey] || needsComment
              const activePending = pendingResponse[item.itemKey]
              const isSaving = savingKey === item.itemKey
              const isDeleting = deletingKey === item.itemKey

              return (
                <li
                  key={item.itemKey}
                  className={cn(
                    'admin-projects-checklist-response-item',
                    item.response && 'is-answered',
                    item.response === 'yes' && 'is-yes',
                    item.response === 'no' && 'is-no',
                    item.response === 'not_applicable' && 'is-na',
                  )}
                >
                  <div className="admin-projects-checklist-response-row">
                    <span className="admin-projects-checklist-response-num" aria-hidden>
                      {index + 1}
                    </span>
                    <div className="admin-projects-checklist-response-main">
                      <div className="admin-projects-checklist-response-item-head">
                        <p className="admin-projects-checklist-response-question">{item.itemName}</p>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="admin-projects-checklist-response-delete"
                            aria-label={`Delete ${item.itemName}`}
                            disabled={isDeleting || isSaving}
                            onClick={() => void handleDeleteQuestion(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <div
                        className="admin-projects-checklist-response-options"
                        role="group"
                        aria-label={`Response for ${item.itemName}`}
                      >
                        {RESPONSE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={cn(
                              'admin-projects-checklist-response-btn',
                              item.response === option.value && 'is-selected',
                              item.response === option.value && option.className,
                            )}
                            disabled={isSaving}
                            onClick={() => handleSelect(item, option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {showComment ? (
                    <div className="admin-projects-checklist-comment-box">
                      <p className="admin-projects-checklist-comment-label">
                        Comment required for No / Not applicable
                      </p>
                      <textarea
                        className="admin-projects-checklist-comment-input"
                        rows={2}
                        value={commentDrafts[item.itemKey] ?? ''}
                        placeholder="Enter reason or notes…"
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [item.itemKey]: e.target.value }))
                        }
                      />
                      <div className="admin-projects-checklist-comment-actions">
                        <button
                          type="button"
                          className={cn(
                            'admin-projects-checklist-response-btn',
                            activePending === 'no' && 'is-selected is-no',
                          )}
                          disabled={isSaving || activePending !== 'no'}
                          onClick={() => void handleCommentSave(item)}
                        >
                          Save as No
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'admin-projects-checklist-response-btn',
                            activePending === 'not_applicable' && 'is-selected is-na',
                          )}
                          disabled={isSaving || activePending !== 'not_applicable'}
                          onClick={() => void handleCommentSave(item)}
                        >
                          Save as Not applicable
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {item.comment && item.response !== 'yes' ? (
                    <p className="admin-projects-checklist-response-comment">
                      <span className="font-semibold">Comment:</span> {item.comment}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )

  function renderAddQuestionSection() {
    return (
      <div className="admin-projects-checklist-add-question">
        <label className="admin-projects-checklist-add-question-label" htmlFor="custom-checklist-question">
          Custom question
        </label>
        <textarea
          id="custom-checklist-question"
          className="admin-projects-checklist-comment-input"
          rows={2}
          value={newQuestion}
          placeholder="Enter a new checklist question…"
          onChange={(e) => setNewQuestion(e.target.value)}
        />
        <div className="admin-projects-checklist-add-question-actions">
          <Button size="sm" onClick={() => void handleAddQuestion()} disabled={addingQuestion}>
            {addingQuestion ? 'Adding…' : 'Add question'}
          </Button>
          {showAddForm ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowAddForm(false)
                setNewQuestion('')
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    )
  }
}
