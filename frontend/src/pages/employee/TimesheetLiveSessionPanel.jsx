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
  backendElapsedMs,
  backendElapsedLastFetch,
  useTaskTime = true,
  compact = false,
  inline = false,
}) {
  const [elapsed, setElapsed] = useState('00:00:00')

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + (serverTimeSkew || 0)
      const currentTask = activeTask || pausedTasks?.[0] || null

      if (
        useTaskTime &&
        backendElapsedMs != null &&
        backendElapsedLastFetch &&
        currentTask
      ) {
        const anchor = backendElapsedLastFetch.getTime()
        const liveMs = Math.max(0, backendElapsedMs + (now - anchor))
        const totalSeconds = Math.floor(liveMs / 1000)
        const h = Math.floor(totalSeconds / 3600)
        const m = Math.floor((totalSeconds % 3600) / 60)
        const s = totalSeconds % 60
        setElapsed(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        )
        return
      }

      const anchorTime =
        useTaskTime && currentTask?.startedAt
          ? currentTask.startedAt
          : checkInTime

      let pausedMs = 0
      if (currentTask) {
        pausedMs += currentTask.totalPausedMs || 0
        if (!activeTask && currentTask.pausedAt) {
          pausedMs += Math.max(0, now - new Date(currentTask.pausedAt).getTime())
        }
      }

      const elapsedMs = Math.max(0, now - anchorTime.getTime() - pausedMs)
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
  }, [
    checkInTime,
    activeTask,
    pausedTasks,
    serverTimeSkew,
    backendElapsedMs,
    backendElapsedLastFetch,
    useTaskTime,
  ])

  const sinceLabel = checkInTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  const isPaused = !activeTask && pausedTasks?.[0]

  if (inline) {
    return <span className="font-mono font-bold tabular-nums">{elapsed}</span>
  }

  if (compact) {
    return (
      <div>
        <p className="mt-0.5 font-mono text-lg font-extrabold tabular-nums text-emerald-900">{elapsed}</p>
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
  backendElapsedMs,
  backendElapsedLastFetch,
  checkoutReview,
  submitting,
  onPause,
  onResume,
  slim = false,
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

  if (slim) {
    return (
      <div className="emp-ts-session-active-head">
        <p className="emp-ts-session-project-name">
          {currentWorkTask?.project || 'Active session'}
        </p>
        {!checkoutReview ? (
          <div className="emp-ts-session-controls">
            {isPaused ? (
              <span className="emp-ts-paused-badge">Paused</span>
            ) : null}
            {activeTask ? (
              <Button
                type="button"
                onClick={onPause}
                disabled={submitting}
                className="emp-ts-btn-pause h-10 gap-2 px-5 text-sm"
              >
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            ) : pausedTasks?.[0] ? (
              <Button
                type="button"
                onClick={onResume}
                disabled={submitting}
                className="emp-ts-btn-pause h-10 gap-2 px-5 text-sm"
              >
                <Play className="h-4 w-4" />
                Resume
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="w-full space-y-2">
      <div className="rounded-lg border border-emerald-200/50 bg-gradient-to-b from-emerald-50/40 to-white p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-800/70">Live Timer</p>
            <LiveSessionTimer
              checkInTime={checkInTime}
              activeTask={activeTask}
              pausedTasks={pausedTasks}
              serverTimeSkew={serverTimeSkew}
              backendElapsedMs={backendElapsedMs}
              backendElapsedLastFetch={backendElapsedLastFetch}
              compact
            />
          </div>
          {isPaused ? (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
              Paused
            </span>
          ) : null}
        </div>
      </div>

      {currentWorkTask && !checkoutReview ? (
        <div className="rounded-lg border border-slate-200/70 bg-white p-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Active Project</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-900">{currentWorkTask.project}</p>
              {descriptionPreview ? (
                <p className="mt-0.5 line-clamp-1 text-[10px] leading-relaxed text-slate-600">
                  {descriptionPreview}
                </p>
              ) : null}
            </div>
            {activeTask ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPause}
                disabled={submitting}
                className="h-7 gap-1 border-emerald-200 px-2 text-[10px] text-emerald-800"
              >
                <Pause className="h-3 w-3" />
                Pause
              </Button>
            ) : pausedTasks?.[0] ? (
              <Button
                type="button"
                size="sm"
                onClick={onResume}
                disabled={submitting}
                className="emp-ts-btn-primary h-7 gap-1 px-2 text-[10px]"
              >
                <Play className="h-3 w-3" />
                Resume
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
