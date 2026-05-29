import { useMemo } from 'react'
import { FolderKanban } from 'lucide-react'

export function TimesheetProjectWiseChart({ data = [] }) {
  const maxHours = useMemo(
    () => (data.length > 0 ? Math.max(...data.map((d) => d.hours), 0.1) : 1),
    [data]
  )

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-slate-50/50 px-4 text-center">
        <FolderKanban className="mb-2 h-8 w-8 text-slate-300" />
        <p className="type-body font-semibold text-muted">No project hours this week</p>
        <p className="type-body-sm mt-1">Hours appear after you log time on assigned projects.</p>
      </div>
    )
  }

  return (
    <div className="timesheet-panel-scroll flex max-h-[280px] flex-col gap-2.5 overflow-y-auto pr-1">
      {data.map((item) => {
        const pct = Math.min(100, Math.round((item.hours / maxHours) * 100))
        return (
          <div
            key={item.projectId || item.project}
            className="rounded-lg border border-border/80 bg-slate-50/40 px-3 py-2.5 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="type-body min-w-0 truncate font-semibold text-foreground" title={item.project}>
                {item.project}
              </p>
              <span className="type-metric-inline shrink-0 text-teal-700">
                {item.hours.toFixed(1)}h
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80">
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
