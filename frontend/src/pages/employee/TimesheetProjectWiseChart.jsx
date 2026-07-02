import { useMemo } from 'react'
import { FolderKanban } from 'lucide-react'
import { formatHoursAsDuration } from '@/utils/durationFormat'

export function TimesheetProjectWiseChart({ data = [], emptyHint, compact = false, embedded = false }) {
  const maxHours = useMemo(
    () => (data.length > 0 ? Math.max(...data.map((d) => d.hours), 0.1) : 1),
    [data],
  )

  if (data.length === 0) {
    if (embedded) {
      return (
        <p className="emp-timesheet-session-projects-empty">
          {emptyHint || 'Hours appear after you log time on assigned projects.'}
        </p>
      )
    }

    return (
      <div
        className={
          compact
            ? 'flex h-full min-h-[6rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-slate-50/50 px-2 py-3 text-center'
            : 'flex min-h-[8rem] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-slate-50/50 px-4 py-6 text-center'
        }
      >
        <FolderKanban className={compact ? 'mb-1 h-5 w-5 text-slate-300' : 'mb-2 h-8 w-8 text-slate-300'} />
        <p className={compact ? 'text-[11px] font-semibold text-muted' : 'type-body font-semibold text-muted'}>
          No assigned projects
        </p>
        <p className={compact ? 'mt-0.5 text-[10px] text-muted' : 'type-body-sm mt-1'}>
          {emptyHint || 'Hours appear after you log time on assigned projects.'}
        </p>
      </div>
    )
  }

  if (embedded) {
    return (
      <div className="emp-timesheet-session-projects-list">
        {data.map((item) => (
          <div key={item.projectId || item.project} className="emp-timesheet-session-project-row">
            <p className="emp-timesheet-session-project-name" title={item.project}>
              {item.project}
            </p>
            <span className="emp-timesheet-session-project-hours">{formatHoursAsDuration(item.hours)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={compact ? 'emp-timesheet-breakdown-list emp-timesheet-breakdown-list--compact' : 'emp-timesheet-breakdown-list'}>
      {data.map((item) => {
        const pct = Math.min(100, Math.round((item.hours / maxHours) * 100))
        return (
          <div
            key={item.projectId || item.project}
            className={
              compact
                ? 'rounded-md border border-border/70 bg-slate-50/40 px-2 py-1.5'
                : 'rounded-lg border border-border/80 bg-slate-50/40 px-3 py-2.5 transition-colors hover:bg-slate-50'
            }
          >
            <div className="flex items-baseline justify-between gap-1.5">
              <p
                className={
                  compact
                    ? 'min-w-0 truncate text-[11px] font-semibold text-foreground'
                    : 'min-w-0 truncate text-sm font-semibold text-foreground'
                }
                title={item.project}
              >
                {item.project}
              </p>
              <span
                className={
                  compact
                    ? 'shrink-0 text-[11px] font-bold tabular-nums text-teal-700'
                    : 'shrink-0 text-sm font-bold tabular-nums text-teal-700'
                }
              >
                {formatHoursAsDuration(item.hours)}
              </span>
            </div>
            <div className={compact ? 'mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/80' : 'mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80'}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
