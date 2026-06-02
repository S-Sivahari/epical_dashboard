import { useEffect, useState } from 'react'
import { Play, Pause } from 'lucide-react'
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
  hasBackendElapsedData,
  backendElapsedLastFetch,
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
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
  ])

  const sinceLabel = checkInTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  const isPaused = !activeTask && pausedTasks?.[0]

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/80 to-white px-4 py-6 text-center shadow-sm">
      <p className="type-card-label-caps tracking-widest text-emerald-800/80">Active session</p>
      <p className="type-metric-xl mt-2 text-emerald-700 sm:text-5xl">{elapsed}</p>
      <p className="type-body mt-2">Since {sinceLabel}</p>
      {isPaused && (
        <span className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
          Paused
        </span>
      )}
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
  hasBackendElapsedData,
  backendElapsedLastFetch,
  checkoutReview,
  submitting,
  onPause,
  onResume,
}) {
  if (!checkedIn || !checkInTime) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50/50 px-6 text-center">
        <p className="text-sm font-semibold text-muted">No active session</p>
        <p className="mt-1 max-w-xs text-xs text-muted">
          Select a project and check in to start tracking time. Work description is optional.
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

  return (
    <div className="flex h-full min-h-[320px] flex-col gap-4">
      <LiveSessionTimer
        checkInTime={checkInTime}
        activeTask={activeTask}
        pausedTasks={pausedTasks}
        serverTimeSkew={serverTimeSkew}
        backendElapsedMs={backendElapsedMs}
        hasBackendElapsedData={hasBackendElapsedData}
        backendElapsedLastFetch={backendElapsedLastFetch}
      />

      {currentWorkTask && !checkoutReview && (
        <div className="flex flex-1 flex-col rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="type-card-label-caps text-[10px] tracking-widest">Current project</p>
          <p className="type-card-title mt-1.5">{currentWorkTask.project}</p>
          {descriptionPreview ? (
            <div className="timesheet-panel-scroll mt-2 max-h-28 flex-1 overflow-y-auto rounded-lg border border-border/60 bg-slate-50/80 px-3 py-2">
              <p className="type-body whitespace-pre-wrap break-words">
                {descriptionPreview}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm italic text-muted">No description added yet.</p>
          )}

          <div className="mt-4 pt-1">
            {activeTask ? (
              <Button
                type="button"
                variant="outline"
                onClick={onPause}
                disabled={submitting}
                className="h-10 w-full gap-2 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              >
                <Pause className="h-4 w-4" /> Pause
              </Button>
            ) : pausedTasks?.[0] ? (
              <Button
                type="button"
                onClick={onResume}
                disabled={submitting}
                className="h-10 w-full gap-2"
              >
                <Play className="h-4 w-4" /> Resume
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
