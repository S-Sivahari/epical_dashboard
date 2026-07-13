import { useCallback, useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/store/authStore'
import {
  EMPTY_CHECKLIST_EXTENSION,
  type CellChecklistExtensionFields,
  type CellTypeChecklistDetail,
  type CellTypeChecklistItem,
  type ChecklistYesNo,
  type TypeChecklistAnswer,
} from '@/types/projectWorkspace'
import {
  addCellCustomChecklistItem,
  deleteCellChecklistItem,
  downloadCellChecklistExport,
  fetchCellTypeChecklistResponses,
  updateCellChecklistExtension,
  updateCellCustomChecklistResponse,
  updateCellTypeChecklistResponse,
} from '@/services/projectTypeChecklistService'
import { completeCell } from '@/services/projectWorkspaceService'
import {
  fetchCellCompletionReadiness,
  type CellCompletionReadiness,
} from '@/services/projectWorkspaceService'
import type { CellStatus } from '@/types/projectWorkspace'

const RESPONSE_OPTIONS: { value: TypeChecklistAnswer; label: string; className: string }[] = [
  { value: 'yes', label: 'Yes', className: 'is-yes' },
  { value: 'no', label: 'No', className: 'is-no' },
  { value: 'not_applicable', label: 'Not applicable', className: 'is-na' },
]

const EXTENSION_YES_NO_OPTIONS: { value: ChecklistYesNo; label: string; className: string }[] = [
  { value: 'yes', label: 'Yes', className: 'is-yes' },
  { value: 'no', label: 'No', className: 'is-no' },
]

type CellTypeChecklistTabProps = {
  projectId: string
  cellId: string
  cellStatus?: CellStatus
  onUpdated?: () => void
}

export function CellTypeChecklistTab({ projectId, cellId, cellStatus, onUpdated }: CellTypeChecklistTabProps) {
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
  const [savingExtension, setSavingExtension] = useState(false)
  const [completingFinalDetails, setCompletingFinalDetails] = useState(false)
  const [finalDetailsCompleted, setFinalDetailsCompleted] = useState(false)
  const [completionReadiness, setCompletionReadiness] = useState<CellCompletionReadiness | null>(null)
  const [extensionDrafts, setExtensionDrafts] = useState({
    dimensionX: '',
    dimensionY: '',
    highestMetalUsed: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, readiness] = await Promise.all([
        fetchCellTypeChecklistResponses(projectId, cellId),
        fetchCellCompletionReadiness(projectId, cellId).catch(() => null),
      ])
      setDetail(data)
      setCompletionReadiness(readiness)
      const drafts: Record<string, string> = {}
      const open: Record<string, boolean> = {}
      for (const item of data.items) {
        drafts[item.itemKey] = item.comment ?? ''
        if (
          (item.response === 'no' || item.response === 'not_applicable') &&
          !item.comment?.trim()
        ) {
          open[item.itemKey] = true
        }
      }
      setCommentDrafts(drafts)
      setCommentOpen(open)
      const ext = data.extension ?? EMPTY_CHECKLIST_EXTENSION
      setExtensionDrafts({
        dimensionX: ext.dimensionX != null ? String(ext.dimensionX) : '',
        dimensionY: ext.dimensionY != null ? String(ext.dimensionY) : '',
        highestMetalUsed: ext.highestMetalUsed ?? '',
      })
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

  useEffect(() => {
    setFinalDetailsCompleted(cellStatus === 'completed')
  }, [projectId, cellId, cellStatus])

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
      } else {
        setCommentOpen((prev) => ({ ...prev, [item.itemKey]: false }))
        setPendingResponse((prev) => {
          const next = { ...prev }
          delete next[item.itemKey]
          return next
        })
      }
      toast.success('Response saved')
      onUpdated?.()
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

  const handleCommentCommit = (item: CellTypeChecklistItem) => {
    const response =
      pendingResponse[item.itemKey] ??
      (item.response === 'no' || item.response === 'not_applicable' ? item.response : undefined)
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

  const saveExtension = async (payload: Partial<CellChecklistExtensionFields>) => {
    const items = detail?.items ?? []
    const answered = items.filter((item) => item.response).length
    if (items.length > 0 && answered < items.length) return

    setSavingExtension(true)
    try {
      const updated = await updateCellChecklistExtension(projectId, cellId, payload)
      setDetail((prev) => (prev ? { ...prev, extension: updated } : prev))
      setExtensionDrafts({
        dimensionX: updated.dimensionX != null ? String(updated.dimensionX) : '',
        dimensionY: updated.dimensionY != null ? String(updated.dimensionY) : '',
        highestMetalUsed: updated.highestMetalUsed ?? '',
      })
      const readiness = await fetchCellCompletionReadiness(projectId, cellId).catch(() => null)
      setCompletionReadiness(readiness)
      onUpdated?.()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to save checklist field')
    } finally {
      setSavingExtension(false)
    }
  }

  const handleDimensionBlur = (field: 'dimensionX' | 'dimensionY') => {
    const raw = extensionDrafts[field].trim()
    const current = detail?.extension ?? EMPTY_CHECKLIST_EXTENSION
    const currentValue = current[field]

    if (raw === '') {
      if (currentValue != null) void saveExtension({ [field]: null })
      return
    }

    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      toast.error('Enter a valid number')
      setExtensionDrafts((prev) => ({
        ...prev,
        [field]: currentValue != null ? String(currentValue) : '',
      }))
      return
    }

    if (currentValue === parsed) return
    void saveExtension({ [field]: parsed })
  }

  const handleHighestMetalBlur = () => {
    const raw = extensionDrafts.highestMetalUsed.trim()
    const current = (detail?.extension ?? EMPTY_CHECKLIST_EXTENSION).highestMetalUsed
    if (raw === current) return
    void saveExtension({ highestMetalUsed: raw })
  }

  const handleExtensionYesNo = (field: keyof Pick<
    CellChecklistExtensionFields,
    'virtualConnection' | 'overallSubstrateContact' | 'waivableDrcError'
  >, value: ChecklistYesNo) => {
    const current = detail?.extension ?? EMPTY_CHECKLIST_EXTENSION
    if (current[field] === value) return
    void saveExtension({ [field]: value })
  }

  const handleCompleteFinalDetails = async () => {
    if (!canCompleteFinalDetails) return

    const parsedX = Number(extensionDrafts.dimensionX)
    const parsedY = Number(extensionDrafts.dimensionY)
    const current = detail?.extension ?? EMPTY_CHECKLIST_EXTENSION

    setCompletingFinalDetails(true)
    try {
      const updated = await updateCellChecklistExtension(projectId, cellId, {
        dimensionX: parsedX,
        dimensionY: parsedY,
        highestMetalUsed: extensionDrafts.highestMetalUsed.trim(),
        virtualConnection: current.virtualConnection,
        overallSubstrateContact: current.overallSubstrateContact,
        waivableDrcError: current.waivableDrcError,
      })
      setDetail((prev) => (prev ? { ...prev, extension: updated } : prev))

      await completeCell(projectId, cellId)
      setFinalDetailsCompleted(true)
      toast.success('Cell completed')
      onUpdated?.()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; missing?: string[] } } })?.response?.data
      if (data?.missing?.length) {
        toast.error(`Complete all sections first: ${data.missing.join(', ')}`)
      } else {
        toast.error(data?.error || 'Failed to complete cell')
      }
    } finally {
      setCompletingFinalDetails(false)
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
  const checklistComplete = totalCount === 0 || answeredCount === totalCount
  const postChecklistLocked = totalCount > 0 && !checklistComplete
  const extension = detail?.extension ?? EMPTY_CHECKLIST_EXTENSION

  const extensionFieldsComplete =
    extensionDrafts.dimensionX.trim() !== '' &&
    extensionDrafts.dimensionY.trim() !== '' &&
    Number.isFinite(Number(extensionDrafts.dimensionX)) &&
    Number.isFinite(Number(extensionDrafts.dimensionY)) &&
    extensionDrafts.highestMetalUsed.trim() !== '' &&
    extension.virtualConnection != null &&
    extension.overallSubstrateContact != null &&
    extension.waivableDrcError != null

  const layoutSchemeComplete = completionReadiness?.sections.layoutDetails ?? false
  const isCellCompleted = cellStatus === 'completed'
  const canCompleteFinalDetails =
    checklistComplete &&
    extensionFieldsComplete &&
    layoutSchemeComplete &&
    !finalDetailsCompleted &&
    !isCellCompleted

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
        <div className="admin-projects-cell-checklist-tab-body">
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
        {renderFinalCellDetailsSection()}
      </div>
    )
  }

  return (
    <div className="admin-projects-cell-checklist-tab">
      <div className="admin-projects-cell-checklist-tab-head">
        <div className="admin-projects-cell-checklist-tab-head-main">
          <div className="admin-projects-cell-checklist-type-badge">{resolvedType || '—'}</div>
          <div className="admin-projects-cell-type-checklist-file">
            <FileSpreadsheet className="admin-projects-cell-checklist-file-icon shrink-0 text-emerald-700" aria-hidden />
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
                <Plus className="shrink-0" aria-hidden />
                Add question
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleDownload()}
              disabled={!hasItems}
            >
              <Download className="shrink-0" aria-hidden />
              Download Excel
            </Button>
          </div>
        </div>
      </div>

      {isAdmin && showAddForm ? renderAddQuestionSection() : null}

      <div
        className="admin-projects-cell-checklist-scroll"
        role="region"
        aria-label="Checklist questions"
      >
        <div className="admin-projects-checklist-responses admin-projects-checklist-responses--cell-tab">
          {!hasItems ? (
            <p className="admin-projects-cell-checklist-empty-inline">
              No checklist questions yet. {isAdmin ? 'Use Add question to create one.' : ''}
            </p>
          ) : null}
          <ul className="admin-projects-checklist-responses-list">
            {hasItems
              ? detail!.items.map((item, index) => {
              const needsComment = item.response === 'no' || item.response === 'not_applicable'
              const activePending = pendingResponse[item.itemKey]
              const isPendingEntry = activePending === 'no' || activePending === 'not_applicable'
              const hasSavedComment = Boolean(item.comment?.trim())
              const showCommentEditor =
                isPendingEntry ||
                (needsComment && (!hasSavedComment || Boolean(commentOpen[item.itemKey])))
              const showSavedComment = hasSavedComment && needsComment && !showCommentEditor
              const isSaving = savingKey === item.itemKey
              const isDeleting = deletingKey === item.itemKey

              return (
                <li
                  key={item.itemKey}
                  className={cn(
                    'admin-projects-checklist-response-item',
                    item.response && 'is-answered',
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
                        {RESPONSE_OPTIONS.map((option) => {
                          const isSelected =
                            activePending === option.value ||
                            (item.response === option.value && !isPendingEntry)
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={cn(
                                'admin-projects-checklist-response-btn',
                                isSelected && 'is-selected',
                                isSelected && option.className,
                              )}
                              disabled={isSaving}
                              onClick={() => handleSelect(item, option.value)}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {showCommentEditor ? (
                    <div className="admin-projects-checklist-comment-box">
                      <input
                        type="text"
                        className="admin-projects-checklist-comment-input"
                        value={commentDrafts[item.itemKey] ?? ''}
                        placeholder="Comment required…"
                        disabled={isSaving}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [item.itemKey]: e.target.value }))
                        }
                        onBlur={() => handleCommentCommit(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleCommentCommit(item)
                          }
                        }}
                      />
                    </div>
                  ) : null}

                  {showSavedComment ? (
                    <button
                      type="button"
                      className="admin-projects-checklist-response-comment admin-projects-checklist-response-comment--saved"
                      onClick={() => {
                        setCommentOpen((prev) => ({ ...prev, [item.itemKey]: true }))
                        if (item.response === 'no' || item.response === 'not_applicable') {
                          setPendingResponse((prev) => ({
                            ...prev,
                            [item.itemKey]: item.response,
                          }))
                        }
                      }}
                      title="Click to edit comment"
                    >
                      <span className="admin-projects-checklist-response-comment-label">Comment</span>
                      <span className="admin-projects-checklist-response-comment-text">{item.comment}</span>
                    </button>
                  ) : null}
                </li>
              )
              })
              : null}
          </ul>
        </div>
      </div>

      {renderFinalCellDetailsSection()}
    </div>
  )

  function renderYesNoField(
    label: string,
    field: keyof Pick<
      CellChecklistExtensionFields,
      'virtualConnection' | 'overallSubstrateContact' | 'waivableDrcError'
    >,
    value: ChecklistYesNo | null,
    fieldsDisabled: boolean,
  ) {
    return (
      <div className="admin-projects-final-cell-field admin-projects-final-cell-field--toggle">
        <span className="admin-projects-final-cell-label">{label}</span>
        <div
          className="admin-projects-final-cell-toggle"
          role="group"
          aria-label={label}
        >
          {EXTENSION_YES_NO_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'admin-projects-final-cell-toggle-btn',
                value === option.value && 'is-selected',
                value === option.value && option.className,
              )}
              disabled={fieldsDisabled}
              onClick={() => handleExtensionYesNo(field, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderFinalCellDetailsSection() {
    const ext = extension
    const fieldsDisabled = postChecklistLocked || savingExtension || completingFinalDetails
    const parsedX =
      extensionDrafts.dimensionX.trim() === '' ? null : Number(extensionDrafts.dimensionX)
    const parsedY =
      extensionDrafts.dimensionY.trim() === '' ? null : Number(extensionDrafts.dimensionY)
    const displayArea =
      parsedX != null && parsedY != null && Number.isFinite(parsedX) && Number.isFinite(parsedY)
        ? parsedX * parsedY
        : ext.area

    return (
      <section
        className={cn(
          'admin-projects-final-cell-details',
          postChecklistLocked && 'is-locked',
          finalDetailsCompleted && 'is-complete',
        )}
        aria-label="Final cell details"
      >
        <div className="admin-projects-final-cell-details-head">
          <h3 className="admin-projects-final-cell-details-title">Final Cell Details</h3>
          {postChecklistLocked ? (
            <p className="admin-projects-final-cell-details-lock-note">
              Complete checklist first ({answeredCount}/{totalCount})
            </p>
          ) : !isCellCompleted && !layoutSchemeComplete ? (
            <p className="admin-projects-final-cell-details-lock-note">
              Finish the full layout scheme before completing this cell.
            </p>
          ) : !isCellCompleted && !extensionFieldsComplete ? (
            <p className="admin-projects-final-cell-details-lock-note">
              Complete all final cell details before completing this cell.
            </p>
          ) : null}
        </div>

        <div className="admin-projects-final-cell-details-form">
          <div className="admin-projects-final-cell-details-row admin-projects-final-cell-details-row--dims">
            <div className="admin-projects-final-cell-field">
              <label className="admin-projects-final-cell-label" htmlFor="final-cell-dimension-x">
                Dimension X
              </label>
              <input
                id="final-cell-dimension-x"
                type="number"
                step="any"
                className="admin-projects-final-cell-input"
                value={extensionDrafts.dimensionX}
                placeholder="Value"
                disabled={fieldsDisabled}
                onChange={(e) =>
                  setExtensionDrafts((prev) => ({ ...prev, dimensionX: e.target.value }))
                }
                onBlur={() => handleDimensionBlur('dimensionX')}
              />
            </div>

            <div className="admin-projects-final-cell-field">
              <label className="admin-projects-final-cell-label" htmlFor="final-cell-dimension-y">
                Dimension Y
              </label>
              <input
                id="final-cell-dimension-y"
                type="number"
                step="any"
                className="admin-projects-final-cell-input"
                value={extensionDrafts.dimensionY}
                placeholder="Value"
                disabled={fieldsDisabled}
                onChange={(e) =>
                  setExtensionDrafts((prev) => ({ ...prev, dimensionY: e.target.value }))
                }
                onBlur={() => handleDimensionBlur('dimensionY')}
              />
            </div>

            <div className="admin-projects-final-cell-field">
              <span
                className="admin-projects-final-cell-label"
                title="Dimension X × Dimension Y"
              >
                Area
              </span>
              <output
                className="admin-projects-final-cell-area"
                aria-live="polite"
                title="Dimension X × Dimension Y"
              >
                {displayArea != null ? displayArea : '—'}
              </output>
            </div>
          </div>

          <div className="admin-projects-final-cell-details-row admin-projects-final-cell-details-row--pair">
            <div className="admin-projects-final-cell-field">
              <label className="admin-projects-final-cell-label" htmlFor="final-cell-highest-metal">
                Highest Metal Used
              </label>
              <input
                id="final-cell-highest-metal"
                type="text"
                className="admin-projects-final-cell-input"
                value={extensionDrafts.highestMetalUsed}
                placeholder="Enter metal layer"
                disabled={fieldsDisabled}
                onChange={(e) =>
                  setExtensionDrafts((prev) => ({ ...prev, highestMetalUsed: e.target.value }))
                }
                onBlur={() => handleHighestMetalBlur()}
              />
            </div>

            {renderYesNoField(
              'Virtual Connection',
              'virtualConnection',
              ext.virtualConnection,
              fieldsDisabled,
            )}
          </div>

          <div className="admin-projects-final-cell-details-row admin-projects-final-cell-details-row--pair">
            {renderYesNoField(
              'Overall Substrate Contact',
              'overallSubstrateContact',
              ext.overallSubstrateContact,
              fieldsDisabled,
            )}
            {renderYesNoField(
              'Waivable DRC Error',
              'waivableDrcError',
              ext.waivableDrcError,
              fieldsDisabled,
            )}
          </div>

          <div className="admin-projects-final-cell-details-footer">
            <Button
              size="sm"
              className="admin-projects-final-cell-complete-btn"
              disabled={!canCompleteFinalDetails || savingExtension || completingFinalDetails}
              onClick={() => void handleCompleteFinalDetails()}
            >
              {completingFinalDetails
                ? 'Completing…'
                : isCellCompleted || finalDetailsCompleted
                  ? 'Completed'
                  : 'Complete cell'}
            </Button>
          </div>
        </div>
      </section>
    )
  }

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
