import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@components/ui/Badge'
import { CellChecklistResponses, responseLabel } from './CellChecklistResponses'
import type { CellChecklistDetail, CellChecklistRowSummary, CellChecklistStatus } from '@/types/projectWorkspace'
import { cn } from '@/utils/cn'

function badgeVariant(status: CellChecklistStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'Applied') return 'success'
  if (status === 'Pending') return 'warning'
  return 'neutral'
}

export function WorkspaceCellChecklist({
  projectId,
  row,
  checklistId,
  onUpdated,
}: {
  projectId: string
  row: CellChecklistRowSummary
  checklistId: string | null
  onUpdated: (cellId: string, data: CellChecklistDetail) => void
}) {
  const [open, setOpen] = useState(false)

  if (!row.checklistName) {
    return <span className="text-slate-400">—</span>
  }

  const detail: CellChecklistDetail = {
    checklistId,
    checklistName: row.checklistName,
    cellStatus: row.cellStatus,
    items: row.items ?? [],
  }

  const firstItem = row.items?.[0]

  return (
    <div
      className="admin-projects-workspace-checklist"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="admin-projects-workspace-checklist-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="min-w-0 truncate font-medium text-slate-800">{row.checklistName}</span>
        <Badge variant={badgeVariant(row.cellStatus)} className="shrink-0 px-2 py-0.5 text-[0.6875rem] font-semibold">
          {firstItem?.response ? responseLabel(firstItem.response) : row.cellStatus}
        </Badge>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="admin-projects-workspace-checklist-popover">
          <CellChecklistResponses
            projectId={projectId}
            cellId={row.cellId}
            checklist={detail}
            compact
            onUpdated={(data) => onUpdated(row.cellId, data)}
          />
        </div>
      ) : null}
    </div>
  )
}
