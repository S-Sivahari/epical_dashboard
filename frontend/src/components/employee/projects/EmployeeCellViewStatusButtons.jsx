import { cn } from '@/utils/cn'
import { WORK_STAGE_STATUSES } from '@/types/projectWorkspace'
import {
  WORKFLOW_STATUS_LABELS,
  normalizeViewStatus,
  workflowStageStatusClass,
} from '@pages/admin/Projects/projectWorkspaceUi'

export function EmployeeCellViewStatusButtons({ status, disabled, onChange }) {
  return (
    <div className="admin-projects-view-status-btns">
      {WORK_STAGE_STATUSES.map((value) => (
        <button
          key={value}
          type="button"
          className={cn(
            'admin-projects-view-status-btn',
            workflowStageStatusClass(value),
            status === value && 'is-active',
          )}
          disabled={disabled}
          onClick={() => onChange(value)}
        >
          {WORKFLOW_STATUS_LABELS[value]}
        </button>
      ))}
    </div>
  )
}

export function getEmployeeViewStatus(cell, viewTab) {
  if (viewTab === 'style') return normalizeViewStatus(cell?.viewWorkflow?.style?.status)
  if (viewTab === 'symbol') return normalizeViewStatus(cell?.viewWorkflow?.symbol?.status)
  return 'not_started'
}
