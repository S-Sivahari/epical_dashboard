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
      <div className="emp-ts-active-empty">
        <div className="emp-ts-active-empty-icon">
          <Timer className="h-7 w-7" strokeWidth={2} />
        </div>
        <p className="emp-ts-active-empty-title">No active session</p>
        <p className="emp-ts-active-empty-text">
          Select a project and check in to start tracking. Your live timer and task details will
          appear here.
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <LiveSessionTimer
        checkInTime={checkInTime}
        activeTask={activeTask}
        pausedTasks={pausedTasks}
        serverTimeSkew={serverTimeSkew}
      />

      {currentWorkTask && !checkoutReview ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-emerald-200/50 bg-white p-3 shadow-sm">
          <p className="type-card-label-caps text-[10px] tracking-widest text-emerald-800/75">
            Current project
          </p>
          <p className="type-card-title mt-1 truncate">{currentWorkTask.project}</p>
          {descriptionPreview ? (
            <div className="timesheet-panel-scroll mt-2 max-h-24 flex-1 overflow-y-auto rounded-md border border-slate-200/80 bg-slate-50/80 px-2.5 py-2">
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                {descriptionPreview}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs italic text-muted">No description added yet.</p>
          )}

          <div className="mt-auto pt-3">
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
                className="emp-ts-btn-primary h-10 w-full gap-2"
              >
                <Play className="h-4 w-4" /> Resume
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
