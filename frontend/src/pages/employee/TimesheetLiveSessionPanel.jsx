import { useEffect, useState } from 'react'
import { Play, Pause, Timer } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
function stripPreview(description, { taskTitle, projectName } = {}) {
  let s = String(description || '').trim()
  if (!s) return ''
  const prefixes = [
    taskTitle ? `${taskTitle} — ` : '',
    projectName ? `${projectName} — ` : '',
    projectName ? `Work on ${projectName} — ` : '',
  ].filter(Boolean)
  for (const prefix of prefixes) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length).trim()
      break
    }
  }
  if (/^Work on .+? — /i.test(s)) {
    return s.replace(/^Work on .+? — /i, '').trim()
  }
  return s
}

export function LiveSessionTimer({
  checkInTime,
  activeTask,
  pausedTasks,
  serverTimeSkew,
  compact = false,
}) {
  const [elapsed, setElapsed] = useState('00:00:00')

  useEffect(() => {
    const tick = () => {
      let pausedMs = 0
      const now = Date.now() + (serverTimeSkew || 0)

      if (activeTask) {
        pausedMs += activeTask.totalPausedMs || 0
      } else if (pausedTasks?.[0]) {
        const task = pausedTasks[0]
        pausedMs += task.totalPausedMs || 0
        if (task.pausedAt) {
          pausedMs += Math.max(0, now - new Date(task.pausedAt).getTime())
        }
      }

      const elapsedMs = Math.max(0, now - checkInTime.getTime() - pausedMs)
      const totalSeconds = Math.floor(elapsedMs / 1000)
      const h = Math.floor(totalSeconds / 3600)
      const m = Math.floor((totalSeconds % 3600) / 60)
      const s = totalSeconds % 60
      setElapsed(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      )
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [checkInTime, activeTask, pausedTasks, serverTimeSkew])

  const sinceLabel = checkInTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  const isPaused = !activeTask && pausedTasks?.[0]

  if (compact) {
    return (
      <div>
        <p className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-emerald-900">{elapsed}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">Since {sinceLabel}</p>
      </div>
    )
  }

  return (
    <div className="emp-ts-live-timer">
      <p className="type-card-label-caps tracking-widest text-emerald-800/80">Live timer</p>
      <p className="emp-ts-live-timer-value">{elapsed}</p>
      <p className="type-body mt-1.5 text-sm text-slate-600">Since {sinceLabel}</p>
      {isPaused ? (
        <span className="mt-2.5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
          Paused
        </span>
      ) : null}
    </div>
  )
}

export function TimesheetLiveSessionPanel({
  checkedIn,
  checkInTime,
  activeTask,
  pausedTasks,
  currentWorkTask,
  serverTimeSkew,
  checkoutReview,
  submitting,
  onPause,
  onResume,
}) {
  if (!checkedIn || !checkInTime) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-emerald-200/60 bg-gradient-to-b from-emerald-50/30 to-slate-50/50 p-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200/40 bg-white/80 text-emerald-700 shadow-sm">
          <Timer className="h-4 w-4" strokeWidth={2} />
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-700">No active session</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
          Check in to start tracking time
        </p>
      </div>
    )
  }

  const descriptionPreview = currentWorkTask
    ? stripPreview(currentWorkTask.description, {
        taskTitle: currentWorkTask.taskTitle,
        projectName: currentWorkTask.project,
      }) || currentWorkTask.taskTitle || ''
    : ''

  const isPaused = !activeTask && pausedTasks?.[0]

  return (
    <div className="space-y-2.5 w-full">
      {/* Compact Timer Display */}
      <div className="rounded-lg border border-emerald-200/50 bg-gradient-to-b from-emerald-50/40 to-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-800/70">Live Timer</p>
            <LiveSessionTimer
              checkInTime={checkInTime}
              activeTask={activeTask}
              pausedTasks={pausedTasks}
              serverTimeSkew={serverTimeSkew}
              compact={true}
            />
          </div>
          {isPaused && (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
              Paused
            </span>
          )}
        </div>
      </div>

      {/* Compact Current Project Info */}
      {currentWorkTask && !checkoutReview ? (
        <div className="rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Active Project</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-900">{currentWorkTask.project}</p>
              {descriptionPreview && (
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-600">
                  {descriptionPreview}
                </p>
              )}
            </div>
            
            {/* Compact Pause/Resume Button */}
            {activeTask ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPause}
                disabled={submitting}
                className="h-7 gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50 px-2.5"
              >
                <Pause className="h-3 w-3" />
                <span className="text-[10px] font-semibold">Pause</span>
              </Button>
            ) : pausedTasks?.[0] ? (
              <Button
                type="button"
                size="sm"
                onClick={onResume}
                disabled={submitting}
                className="emp-ts-btn-primary h-7 gap-1.5 px-2.5"
              >
                <Play className="h-3 w-3" />
                <span className="text-[10px] font-semibold">Resume</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
