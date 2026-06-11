import type { CellWorkflowTiming } from '@/types/projectWorkspace'
import { formatDateTime } from '@/utils/formatDate'

type CellWorkflowTimingSummaryProps = {
  timing?: CellWorkflowTiming | null
  className?: string
}

export function CellWorkflowTimingSummary({
  timing,
  className,
}: CellWorkflowTimingSummaryProps) {
  if (!timing) return null

  const rows = [
    timing.latestActivityTime
      ? { label: 'Latest activity', value: timing.latestActivityTime }
      : null,
    timing.workflowCompletionTime
      ? { label: 'Workflow completed', value: timing.workflowCompletionTime }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

  if (rows.length === 0) return null

  return (
    <dl className={className ?? 'admin-projects-workflow-timing-summary'}>
      {rows.map((row) => (
        <div key={row.label} className="admin-projects-workflow-timing-summary-row">
          <dt>{row.label}</dt>
          <dd>
            <time dateTime={row.value}>{formatDateTime(row.value)}</time>
          </dd>
        </div>
      ))}
    </dl>
  )
}
