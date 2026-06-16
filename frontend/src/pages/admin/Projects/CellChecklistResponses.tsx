import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { updateCellChecklistItem } from '@/services/checklistService'
import type {
  CellChecklistDetail,
  CellChecklistItem,
  CellChecklistItemResponse,
  CellTypeChecklistItem,
} from '@/types/projectWorkspace'
import { cn } from '@/utils/cn'

function getChecklistItemMappingId(item: CellChecklistItem | CellTypeChecklistItem): string {
  if ('id' in item) return item.id
  return item.customItemId ?? item.itemKey
}

const RESPONSE_LABELS: Record<CellChecklistItemResponse, string> = {
  yes: 'Yes',
  no: 'No',
  not_applicable: 'N/A',
}

type CommentTarget = {
  mappingId: string
  itemName: string
  response: 'no' | 'not_applicable'
}

export function CellChecklistResponses({
  projectId,
  cellId,
  checklist,
  compact = false,
  onUpdated,
}: {
  projectId: string
  cellId: string
  checklist: CellChecklistDetail
  compact?: boolean
  onUpdated?: (data: CellChecklistDetail) => void
}) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null)
  const [comment, setComment] = useState('')

  const saveResponse = async (
    mappingId: string,
    response: CellChecklistItemResponse,
    reason?: string,
  ) => {
    setSavingId(mappingId)
    try {
      const data = await updateCellChecklistItem(projectId, cellId, mappingId, {
        response,
        comment: reason,
      })
      toast.success('Checklist response saved')
      setCommentTarget(null)
      setComment('')
      onUpdated?.(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to save response')
    } finally {
      setSavingId(null)
    }
  }

  const handleOptionClick = (
    item: CellChecklistDetail['items'][number],
    response: CellChecklistItemResponse,
  ) => {
    const mappingId = getChecklistItemMappingId(item)
    if (response === 'yes') {
      void saveResponse(mappingId, 'yes')
      return
    }
    setCommentTarget({
      mappingId,
      itemName: item.itemName,
      response,
    })
    setComment(item.response === response ? item.comment : '')
  }

  const submitComment = () => {
    if (!commentTarget) return
    if (!comment.trim()) {
      toast.error('Please enter a reason')
      return
    }
    void saveResponse(commentTarget.mappingId, commentTarget.response, comment.trim())
  }

  if (!checklist.items.length) {
    return <p className="text-xs text-slate-500">No checklist questions for this cell.</p>
  }

  return (
    <div className={cn('admin-projects-checklist-responses', compact && 'is-compact')}>
      <ul className="admin-projects-checklist-responses-list">
        {checklist.items.map((item) => {
          const mappingId = getChecklistItemMappingId(item)
          const activeComment =
            commentTarget?.mappingId === mappingId ? commentTarget : null
          return (
          <li key={mappingId} className="admin-projects-checklist-response-item">
            <p className="admin-projects-checklist-response-question">{item.itemName}</p>
            <div
              className="admin-projects-checklist-response-options"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="group"
              aria-label={`Response for ${item.itemName}`}
            >
              {(['yes', 'no', 'not_applicable'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={savingId === mappingId}
                  className={cn(
                    'admin-projects-checklist-response-btn',
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
              <p className="admin-projects-checklist-response-comment">
                <span className="font-semibold">Reason:</span> {item.comment}
              </p>
            ) : null}
            {activeComment ? (
              <div
                className="admin-projects-checklist-comment-box"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="admin-projects-checklist-comment-label">
                  Reason for <strong>{RESPONSE_LABELS[activeComment.response]}</strong> —{' '}
                  {activeComment.itemName}
                </p>
                <textarea
                  className="admin-projects-checklist-comment-input"
                  rows={compact ? 2 : 3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Enter the reason…"
                  autoFocus
                />
                <div className="admin-projects-checklist-comment-actions">
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
                  <Button type="button" size="sm" onClick={submitComment} disabled={savingId === mappingId}>
                    Save
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        )})}
      </ul>
    </div>
  )
}

export function responseLabel(response: CellChecklistItemResponse | null | undefined): string {
  if (!response) return '—'
  return RESPONSE_LABELS[response]
}
