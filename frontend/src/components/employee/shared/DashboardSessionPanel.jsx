import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, LogOut, Loader2, Timer } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Textarea } from '@components/employee/ui/textarea'
import { LiveSessionTimer } from '@pages/employee/TimesheetLiveSessionPanel'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { useToast } from '@components/employee/shared/ToastProvider'
import { cn } from '@pages/employee/lib/utils'

function resolveCheckInTime(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function workNoteFromTask(work) {
  let s = String(work?.description || '').trim()
  if (!s) return ''
  const prefixes = [
    work?.taskTitle ? `${work.taskTitle} — ` : '',
    work?.project ? `${work.project} — ` : '',
    work?.project ? `Work on ${work.project} — ` : '',
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

export function DashboardSessionPanel({ className, fill = false, compact = false }) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [checkoutReview, setCheckoutReview] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [workSummary, setWorkSummary] = useState('')
  const initialized = useTimesheetStore((s) => s.initialized)
  const checkedIn = useTimesheetStore((s) => s.checkedIn)
  const checkInTime = useTimesheetStore((s) => s.checkInTime)
  const activeTask = useTimesheetStore((s) => s.activeTask)
  const pausedTasks = useTimesheetStore((s) => s.pausedTasks)
  const serverTimeSkew = useTimesheetStore((s) => s.serverTimeSkew)
  const backendElapsedMs = useTimesheetStore((s) => s.backendElapsedMs)
  const backendElapsedLastFetch = useTimesheetStore((s) => s.backendElapsedLastFetch)
  const hydrate = useTimesheetStore((s) => s.hydrate)
  const checkOut = useTimesheetStore((s) => s.checkOut)
  const completeTask = useTimesheetStore((s) => s.completeTask)

  const resolvedCheckIn = useMemo(() => resolveCheckInTime(checkInTime), [checkInTime])
  const currentWorkTask = activeTask || pausedTasks?.[0] || null

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (checkedIn) return
    setCheckoutReview(false)
    setCheckoutError('')
    setWorkSummary('')
  }, [checkedIn])

  const isPaused = !activeTask && pausedTasks?.[0]
  const projectName = currentWorkTask?.project || 'Active session'

  const beginCheckOut = () => {
    setCheckoutReview(true)
    setCheckoutError('')
    setWorkSummary(workNoteFromTask(currentWorkTask))
  }

  const cancelCheckOut = () => {
    setCheckoutReview(false)
    setCheckoutError('')
    setWorkSummary(workNoteFromTask(currentWorkTask))
  }

  const onConfirmCheckOut = async () => {
    const summary = String(workSummary || '').trim()

    try {
      setSubmitting(true)
      setCheckoutError('')
      if (currentWorkTask?.timesheetId) {
        await completeTask(currentWorkTask.timesheetId, summary)
      }
      await checkOut()
      setCheckoutReview(false)
      setWorkSummary('')
      toast({
        title: 'Checked out',
        description: 'Your work was submitted for admin approval.',
      })
    } catch (err) {
      const message = err.response?.data?.error || 'Please try again.'
      setCheckoutError(message)
      toast({
        title: 'Check out failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const panelClass = cn(
    'emp-dash-session-panel',
    compact && 'emp-dash-session-panel--compact',
    fill && 'h-full',
    className,
  )

  if (!initialized) {
    return (
      <div className={cn(panelClass, 'emp-dash-session-panel--loading')}>
        <div className={cn('animate-pulse rounded-xl bg-slate-100', compact ? 'h-24' : 'h-28')} />
      </div>
    )
  }

  if (!checkedIn || !resolvedCheckIn) {
    return (
      <div className={panelClass}>
        <div className="emp-dash-session-panel__head">
          <Timer className="h-4 w-4 shrink-0" aria-hidden />
          <p className="emp-dash-session-panel__title">Check in</p>
        </div>
        <p className="emp-dash-session-panel__hint">
          Start your work session from Projects &amp; Timesheets.
        </p>
        <Button asChild className="emp-dash-session-panel__checkin-btn w-full gap-2">
          <Link to="/employee/timesheet">
            <LogIn className="h-4 w-4 shrink-0" />
            Projects &amp; Timesheets
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={panelClass}>
      <div className="emp-dash-session-panel__head">
        <span
          className={cn(
            'emp-dash-session-panel__dot',
            isPaused ? 'emp-dash-session-panel__dot--paused' : 'emp-dash-session-panel__dot--live',
          )}
          aria-hidden
        />
        <p className="emp-dash-session-panel__title">Live session</p>
        {isPaused ? <span className="emp-dash-session-panel__badge">Paused</span> : null}
      </div>

      {checkoutReview ? (
        <div className="emp-dash-session-panel__checkout">
          <p className="emp-timesheet-session-note emp-timesheet-session-note--checkout text-amber-800">
            Update summary before checking out.
          </p>
          <Textarea
            className="emp-dash-session-panel__summary emp-timesheet-session-desc emp-timesheet-session-desc--checkout"
            value={workSummary}
            onChange={(event) => setWorkSummary(event.target.value)}
            placeholder="Update your work summary before checking out…"
            rows={3}
          />
          {checkoutError ? (
            <p className="emp-timesheet-session-note emp-timesheet-session-note--error text-danger">
              {checkoutError}
            </p>
          ) : null}
          <div className="emp-dash-session-panel__checkout-actions">
            <Button
              type="button"
              variant="outline"
              className="emp-dash-session-panel__cancel-btn"
              disabled={submitting}
              onClick={cancelCheckOut}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void onConfirmCheckOut()}
              className="emp-ts-btn-checkout emp-dash-session-panel__checkout-btn gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 shrink-0" />
              )}
              Check Out
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="emp-dash-session-panel__project" title={projectName}>
            {projectName}
          </p>

          <p className="emp-dash-session-panel__timer">
            <LiveSessionTimer
              checkInTime={resolvedCheckIn}
              activeTask={activeTask}
              pausedTasks={pausedTasks}
              serverTimeSkew={serverTimeSkew}
              backendElapsedMs={backendElapsedMs}
              backendElapsedLastFetch={backendElapsedLastFetch}
              inline
            />
          </p>

          <p className="emp-dash-session-panel__since">
            Since{' '}
            {resolvedCheckIn.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          <Button
            type="button"
            disabled={submitting}
            onClick={beginCheckOut}
            className="emp-ts-btn-checkout emp-dash-session-panel__checkout-btn w-full gap-2"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Check Out
          </Button>
        </>
      )}
    </div>
  )
}
