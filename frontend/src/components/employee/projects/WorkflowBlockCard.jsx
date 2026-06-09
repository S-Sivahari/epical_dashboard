import { ArrowRight, Eye, Loader2 } from 'lucide-react'
import { EmployeePhotoAvatar } from '@components/employee/shared/EmployeePhotoAvatar'
import { complexityTag, getAdvancePayload, layoutStageButtonLabel, normalizeWorkflow } from '@/utils/cellWorkflowUi'
import { cn } from '@pages/employee/lib/utils'

export function WorkflowBlockCard({
  cell,
  user,
  viewTab,
  savingId,
  onAdvance,
  onRequestReview,
}) {
  const canEdit = Boolean(cell.isAssignedToMe)
  const advance = canEdit ? getAdvancePayload(cell, viewTab) : null
  const isSaving = savingId === cell.id
  const isReview = advance?.type === 'review'
  const wf = normalizeWorkflow(cell?.viewWorkflow).layout
  const awaitingReview = canEdit && viewTab === 'layout' && wf?.pendingReview
  const isDone = canEdit && !advance && !awaitingReview
  const actionLabel =
    viewTab === 'layout' && canEdit
      ? layoutStageButtonLabel(cell)
      : isReview
        ? 'Request Review'
        : isDone
          ? 'Completed'
          : 'Advance Stage'
  const displayName = cell.assignedEmployeeName?.trim() || 'Unassigned'
  const avatarName = cell.isAssignedToMe ? (user?.name || displayName) : displayName
  const avatarId = cell.isAssignedToMe ? user?.id : cell.assignedEmployeeId

  const handleAction = () => {
    if (!canEdit) return
    if (isReview) {
      void onRequestReview(cell)
      return
    }
    if (advance?.view) {
      void onAdvance(cell, advance)
    }
  }

  return (
    <article className={cn('emp-wf-card', !canEdit && 'emp-wf-card--readonly')}>
      <div className="emp-wf-card-head">
        <h3 className="emp-wf-card-title">{String(cell.name || 'UNNAMED').toUpperCase()}</h3>
        {!canEdit ? (
          <span className="emp-wf-view-only" title="View only — not assigned to you">
            <Eye className="h-3 w-3" />
            View
          </span>
        ) : (
          <span className="emp-wf-assigned-badge">Yours</span>
        )}
      </div>
      <div className="emp-wf-card-tags">
        <span className="emp-wf-tag emp-wf-tag--complexity">{complexityTag(cell.complexity)}</span>
        <span className="emp-wf-tag emp-wf-tag--type">{String(cell.cellType || 'block').toUpperCase()}</span>
      </div>

      <div className="emp-wf-card-user">
        <EmployeePhotoAvatar
          employeeId={avatarId}
          name={avatarName}
          className="emp-wf-avatar h-9 w-9 shrink-0"
          fallbackClassName="!bg-[#2563eb] !text-white text-xs font-bold"
        />
        <div className="emp-wf-card-user-text">
          <p className="emp-wf-card-user-name">{displayName}</p>
          <p className="emp-wf-card-user-role">
            {cell.isAssignedToMe ? (user?.designation || 'Engineer') : 'Assigned engineer'}
          </p>
        </div>
        <span className="emp-wf-card-hours">{cell.estimatedEffort || 0}h</span>
      </div>

      <button
        type="button"
        className={`emp-wf-advance-btn${isReview ? ' emp-wf-advance-btn--review' : ''}${isDone ? ' emp-wf-advance-btn--done' : ''}${!canEdit ? ' emp-wf-advance-btn--readonly' : ''}`}
        disabled={isSaving || !canEdit || isDone || awaitingReview}
        onClick={handleAction}
        title={
          !canEdit
            ? 'You can only advance cells assigned to you'
            : awaitingReview
              ? 'Waiting for admin review'
              : undefined
        }
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            {!canEdit ? 'View Only' : awaitingReview ? `Awaiting ${wf.pendingReview.toUpperCase()} review` : actionLabel}
            {canEdit && !isDone && !isSaving && !awaitingReview ? <ArrowRight className="h-3.5 w-3.5" /> : null}
          </>
        )}
      </button>
    </article>
  )
}
