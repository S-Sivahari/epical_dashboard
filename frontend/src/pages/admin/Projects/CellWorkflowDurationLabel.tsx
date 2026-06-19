import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Clock } from 'lucide-react'

import { cn } from '@/utils/cn'

import type { CellStatus, CellWorkflowDuration } from '@/types/projectWorkspace'

import { formatLiveWorkflowDurationFromMs, formatWorkflowDurationFromMs } from '@/utils/durationFormat'



type CellWorkflowDurationLabelProps = {

  cellStatus: CellStatus

  workflowDuration?: CellWorkflowDuration | null

  fetchedAt?: number

  className?: string

  /** Always show in header, including 0m while in progress. */

  alwaysVisible?: boolean

  variant?: 'default' | 'header'

  onHold?: boolean

  /** Press and hold to toggle hold (pause productive time). */

  holdEnabled?: boolean

  onHoldToggle?: (hold: boolean) => void

}



const LIVE_TICK_MS = 1_000

const HOLD_PRESS_MS = 600



export function CellWorkflowDurationLabel({

  cellStatus,

  workflowDuration,

  fetchedAt,

  className,

  alwaysVisible = false,

  variant = 'default',

  onHold = false,

  holdEnabled = false,

  onHoldToggle,

}: CellWorkflowDurationLabelProps) {

  const [now, setNow] = useState(() => Date.now())

  const [isPressing, setIsPressing] = useState(false)

  const holdTimerRef = useRef<number | null>(null)

  const holdTriggeredRef = useRef(false)

  const isCompleted = cellStatus === 'completed'

  const isInProgress = cellStatus === 'in_progress'
  const shouldTickLive = !isCompleted && !onHold && Boolean(workflowDuration?.isActive)

  const canHold = holdEnabled && Boolean(onHoldToggle) && !isCompleted && isInProgress



  useEffect(() => {

    if (!shouldTickLive) return undefined

    const timer = window.setInterval(() => setNow(Date.now()), LIVE_TICK_MS)

    return () => window.clearInterval(timer)

  }, [shouldTickLive])



  const clearHoldTimer = useCallback(() => {

    if (holdTimerRef.current !== null) {

      window.clearTimeout(holdTimerRef.current)

      holdTimerRef.current = null

    }

  }, [])



  useEffect(() => () => clearHoldTimer(), [clearHoldTimer])



  const handlePressStart = useCallback(() => {

    if (!canHold) return

    holdTriggeredRef.current = false

    setIsPressing(true)

    clearHoldTimer()

    holdTimerRef.current = window.setTimeout(() => {

      holdTriggeredRef.current = true

      onHoldToggle?.(!onHold)

      setIsPressing(false)

    }, HOLD_PRESS_MS)

  }, [canHold, clearHoldTimer, onHold, onHoldToggle])



  const handlePressEnd = useCallback(() => {

    clearHoldTimer()

    setIsPressing(false)

  }, [clearHoldTimer])



  const display = useMemo(() => {

    const baseMs = workflowDuration?.totalMs ?? 0

    const anchor = fetchedAt ?? Date.now()

    const liveMs = shouldTickLive ? baseMs + Math.max(0, now - anchor) : baseMs

    const formatDuration = variant === 'header' ? formatLiveWorkflowDurationFromMs : formatWorkflowDurationFromMs

    const formatted = formatDuration(liveMs)



    if (!alwaysVisible && liveMs <= 0 && !shouldTickLive) return null



    if (isCompleted) {

      return {

        formatted,

        liveMs,

        label: 'Total',

        isRunning: false,

        isPaused: false,

      }

    }



    if (onHold) {

      return {

        formatted,

        liveMs,

        label: 'On Hold',

        isRunning: false,

        isPaused: true,

      }

    }



    if (shouldTickLive) {

      return {

        formatted,

        liveMs,

        label: 'Running',

        isRunning: true,

        isPaused: false,

      }

    }



    if (isInProgress) {

      return {

        formatted,

        liveMs,

        label: liveMs > 0 ? 'Paused' : 'Ready',

        isRunning: false,

        isPaused: liveMs > 0,

      }

    }



    return {

      formatted: formatDuration(0),

      liveMs: 0,

      label: 'Time',

      isRunning: false,

      isPaused: false,

    }

  }, [workflowDuration, shouldTickLive, isCompleted, isInProgress, onHold, now, fetchedAt, alwaysVisible, variant])



  if (!display) return null



  const holdHint = canHold

    ? onHold

      ? 'Press and hold to resume productive time'

      : 'Press and hold to pause productive time'

    : ''



  const title = isCompleted

    ? `Total productive time: ${display.formatted}`

    : display.isRunning

      ? `Productive time running: ${display.formatted}${holdHint ? `. ${holdHint}` : ''}`

      : `Productive time: ${display.formatted}${display.isPaused ? ' (paused)' : ''}${holdHint ? `. ${holdHint}` : ''}`



  if (variant === 'header') {

    const timerClassName = cn(

      'admin-projects-cell-live-timer',

      display.isRunning && 'is-running',

      (display.isPaused || onHold) && 'is-paused',

      onHold && 'is-on-hold',

      canHold && 'is-interactive',

      isPressing && 'is-holding',

      className,

    )



    const content = (

      <>

        <Clock className="admin-projects-cell-live-timer-icon" aria-hidden />

        <span className="admin-projects-cell-live-timer-copy">

          <span className="admin-projects-cell-live-timer-value">{display.formatted}</span>

          <span className="admin-projects-cell-live-timer-label">{display.label}</span>

        </span>

      </>

    )



    if (canHold) {

      return (

        <button

          type="button"

          className={timerClassName}

          title={title}

          aria-live={display.isRunning ? 'polite' : 'off'}

          aria-label={title}

          onPointerDown={(event) => {

            event.preventDefault()

            handlePressStart()

          }}

          onPointerUp={handlePressEnd}

          onPointerLeave={handlePressEnd}

          onPointerCancel={handlePressEnd}

          onContextMenu={(event) => event.preventDefault()}

        >

          {content}

        </button>

      )

    }



    return (

      <span

        className={timerClassName}

        title={title}

        aria-live={display.isRunning ? 'polite' : 'off'}

        aria-label={title}

      >

        {content}

      </span>

    )

  }



  const prefix = isCompleted ? 'Total productive time:' : 'Productive time:'



  return (

    <span className={className ?? 'admin-projects-cell-workflow-duration'} title={title}>

      <Clock className="admin-projects-cell-workflow-duration-icon" aria-hidden />

      <span>

        {prefix} {display.formatted}

      </span>

    </span>

  )

}


