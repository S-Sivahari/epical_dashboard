import { useCallback, useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { EmployeeFinalCellDetailsSection } from '@components/employee/projects/EmployeeFinalCellDetailsSection'
import {
  fetchMyCellChecklist,
  updateMyCellChecklistItem,
} from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import { cn } from '@pages/employee/lib/utils'

const RESPONSE_LABELS = {
  yes: 'Yes',
  no: 'No',
  not_applicable: 'N/A',
}

export function EmployeeCellChecklistSidebar({
  projectId,
  cellId,
  cellStatus = 'ready',
  readOnly = false,
  showCompletionRequirement = false,
  onChange,
  onCellCompleted,
}) {
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)
  const [commentTarget, setCommentTarget] = useState(null)
  const [comment, setComment] = useState('')
  const { toast } = useToast()

  const loadChecklist = useCallback(async () => {
    if (!projectId || !cellId) return
    setLoading(true)
    try {
      const data = await fetchMyCellChecklist(projectId, cellId)
      setChecklist(data)
      onChange?.(data)
    } catch {
      toast({ title: 'Error', description: 'Failed to load checklist' })
      setChecklist(null)
      onChange?.(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, cellId, toast])

  useEffect(() => {
    void loadChecklist()
  }, [loadChecklist])

  const saveResponse = async (item, response, reason = '') => {
    if (readOnly) return
    setSavingKey(item.itemKey)
    try {
      const data = await updateMyCellChecklistItem(projectId, cellId, item, {
        response,
        comment: reason,
      })
      setChecklist(data)
      onChange?.(data)
      setCommentTarget(null)
      setComment('')
      toast({ title: 'Saved', description: 'Checklist response saved' })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to save response' })
    } finally {
      setSavingKey(null)
    }
  }

  const handleOptionClick = (item, response) => {
    if (readOnly) return
    if (response === 'yes') {
      void saveResponse(item, 'yes')
      return
    }
    setCommentTarget({
      itemKey: item.itemKey,
      item,
      itemName: item.itemName,
      response,
    })
    setComment(item.response === response ? item.comment : '')
  }

  const submitComment = () => {
    if (!commentTarget) return
    if (!comment.trim()) {
      toast({ title: 'Reason required', description: 'Please enter a reason for No or N/A' })
      return
    }
    void saveResponse(commentTarget.item, commentTarget.response, comment.trim())
  }

  const answeredCount = checklist?.items?.filter((item) => item.response).length ?? 0
  const totalCount = checklist?.items?.length ?? 0
  const hasChecklistConfigured = Boolean(checklist?.hasFile || totalCount > 0)

  return (
    <div className="emp-wf-cell-checklist-split">
      <aside className="emp-wf-checklist-panel" aria-label="Cell checklist">
        <div className="emp-wf-checklist-panel-head">
          <div className="emp-wf-checklist-panel-title-row">
            <ClipboardList className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            <h2 className="emp-wf-checklist-panel-title">Checklist</h2>
          </div>
          {checklist?.checklistName || checklist?.fileName ? (
            <p className="emp-wf-checklist-panel-subtitle">
              {checklist.checklistName || checklist.fileName}
            </p>
          ) : null}
          {totalCount > 0 ? (
            <p className="emp-wf-checklist-panel-progress">
              {answeredCount} of {totalCount} answered
            </p>
          ) : null}
          {readOnly ? (
            <p className="emp-wf-checklist-panel-readonly">View only — you cannot edit this cell</p>
          ) : showCompletionRequirement && totalCount > 0 && !checklist?.isFilled ? (
            <p className="emp-wf-checklist-panel-required">
              Answer all checklist items before completing the final stage
            </p>
          ) : showCompletionRequirement && totalCount > 0 && checklist?.isFilled && !checklist?.isExtensionFilled ? (
            <p className="emp-wf-checklist-panel-required">
              Complete the final cell details before completing the final stage
            </p>
          ) : null}
        </div>

        <div className="emp-wf-checklist-panel-body">
          {loading ? (
            <p className="emp-wf-checklist-panel-empty">Loading checklist…</p>
          ) : !hasChecklistConfigured ? (
            <p className="emp-wf-checklist-panel-empty">
              No checklist file uploaded for this cell type yet. Ask your admin to upload one from the project Checklist tab.
            </p>
          ) : !checklist?.items?.length ? (
            <p className="emp-wf-checklist-panel-empty">
              Checklist file is uploaded but has no questions yet.
            </p>
          ) : (
            <ul className="emp-wf-checklist-list">
              {checklist.items.map((item) => (
                <li key={item.itemKey} className="emp-wf-checklist-item">
                  <p className="emp-wf-checklist-question">{item.itemName}</p>
                  <div
                    className="emp-wf-checklist-options"
                    role="group"
                    aria-label={`Response for ${item.itemName}`}
                  >
                    {['yes', 'no', 'not_applicable'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={readOnly || savingKey === item.itemKey}
                        className={cn(
                          'emp-wf-checklist-option',
                          item.response === option && 'is-selected',
                          option === 'yes' && item.response === option && 'is-yes',
                          option === 'no' && item.response === option && 'is-no',
                          option === 'not_applicable' && item.response === option && 'is-na',
                        )}
                        onClick={() => handleOptionClick(item, option)}
                      >
                        {RESPONSE_LABELS[option]}
                      </button>
                    ))}
                  </div>
                  {item.response && item.response !== 'yes' && item.comment ? (
                    <p className="emp-wf-checklist-reason">
                      <span className="font-semibold">Reason:</span> {item.comment}
                    </p>
                  ) : null}
                  {!readOnly && commentTarget?.itemKey === item.itemKey ? (
                    <div className="emp-wf-checklist-comment-box">
                      <p className="emp-wf-checklist-comment-label">
                        Reason for <strong>{RESPONSE_LABELS[commentTarget.response]}</strong>
                      </p>
                      <textarea
                        className="emp-wf-checklist-comment-input"
                        rows={3}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Enter the reason…"
                        autoFocus
                      />
                      <div className="emp-wf-checklist-comment-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setCommentTarget(null)
                            setComment('')
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingKey === item.itemKey}
                          onClick={submitComment}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <EmployeeFinalCellDetailsSection
        projectId={projectId}
        cellId={cellId}
        checklist={checklist}
        cellStatus={cellStatus}
        readOnly={readOnly}
        showCompletionRequirement={showCompletionRequirement}
        onCellCompleted={onCellCompleted}
        onChange={(data) => {
          setChecklist(data)
          onChange?.(data)
        }}
      />
    </div>
  )
}
