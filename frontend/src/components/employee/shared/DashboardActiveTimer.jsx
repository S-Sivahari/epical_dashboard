import { Link } from 'react-router-dom'
import { Timer } from 'lucide-react'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { LiveSessionTimer } from '@pages/employee/TimesheetLiveSessionPanel'
import { cn } from '@pages/employee/lib/utils'

export function DashboardActiveTimer({ className, variant = 'hero' }) {
  // hero | commandBar | compact
  const { checkedIn, checkInTime, activeTask, pausedTasks, serverTimeSkew, initialized } =
    useTimesheetStore()
  const backendElapsedMs = useTimesheetStore((s) => s.backendElapsedMs)
  const backendElapsedLastFetch = useTimesheetStore((s) => s.backendElapsedLastFetch)

  if (!initialized || !checkedIn || !checkInTime) return null

  const isPaused = !activeTask && pausedTasks?.[0]
  const projectName = activeTask?.project || pausedTasks?.[0]?.project || 'Active session'

  if (variant === 'commandBar') {
    return (
      <Link
        to="/employee/timesheet"
        title="Go to timesheet to check out"
        className={cn(
          'cmd-bar-active-timer group inline-flex min-w-0 max-w-[min(100%,16rem)] items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/95 px-2 py-1 text-emerald-900 shadow-sm transition-colors hover:bg-emerald-100/90 sm:gap-2 sm:px-2.5 sm:py-1.5',
          className,
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2',
            isPaused ? 'bg-amber-500' : 'animate-pulse bg-emerald-500',
          )}
          aria-hidden
        />
        <Timer className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
        <span className="hidden min-w-0 truncate text-[11px] font-semibold sm:inline sm:text-xs">
          {projectName}
        </span>
        <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums sm:text-xs">
          <LiveSessionTimer
            checkInTime={checkInTime}
            activeTask={activeTask}
            pausedTasks={pausedTasks}
            serverTimeSkew={serverTimeSkew}
            backendElapsedMs={backendElapsedMs}
            backendElapsedLastFetch={backendElapsedLastFetch}
            inline
          />
        </span>
        {isPaused ? (
          <span className="hidden shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 sm:inline">
            Paused
          </span>
        ) : null}
      </Link>
    )
  }

  if (variant === 'hero') {
    return (
      <Link
        to="/employee/timesheet"
        title="Go to timesheet to check out"
        className={cn(
          'group inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-white/30 bg-white/15 px-2.5 py-1.5 text-white backdrop-blur-sm transition-colors hover:bg-white/25',
          className,
        )}
      >
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            isPaused ? 'bg-amber-300' : 'animate-pulse bg-emerald-300',
          )}
          aria-hidden
        />
        <Timer className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
        <span className="truncate text-[10px] font-semibold sm:text-xs">{projectName}</span>
        <span className="shrink-0 font-mono text-xs font-bold tabular-nums sm:text-sm">
          <LiveSessionTimer
            checkInTime={checkInTime}
            activeTask={activeTask}
            pausedTasks={pausedTasks}
            serverTimeSkew={serverTimeSkew}
            backendElapsedMs={backendElapsedMs}
            backendElapsedLastFetch={backendElapsedLastFetch}
            inline
          />
        </span>
        {isPaused ? (
          <span className="shrink-0 rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100">
            Paused
          </span>
        ) : null}
      </Link>
    )
  }

  return (
    <Link
      to="/employee/timesheet"
      title="Go to timesheet to check out"
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/80 px-2.5 py-1.5 text-emerald-900 transition-colors hover:bg-emerald-100/80',
        className,
      )}
    >
      <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <LiveSessionTimer
        checkInTime={checkInTime}
        activeTask={activeTask}
        pausedTasks={pausedTasks}
        serverTimeSkew={serverTimeSkew}
        backendElapsedMs={backendElapsedMs}
        backendElapsedLastFetch={backendElapsedLastFetch}
        inline
      />
    </Link>
  )
}
