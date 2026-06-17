import { useEffect, useMemo, useState } from 'react'

type ProjectsTotalDonutProps = {
  total: number
  inProgress: number
  completed: number
  cancelled: number
  className?: string
}

const SIZE = 100
const CENTER = SIZE / 2
const RADIUS = 38
const STROKE = 12

export function ProjectsTotalDonut({
  total,
  inProgress,
  completed,
  cancelled,
  className,
}: ProjectsTotalDonutProps) {
  const [isAnimated, setIsAnimated] = useState(false)
  const [displayTotal, setDisplayTotal] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsAnimated(true), 180)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isAnimated) {
      setDisplayTotal(0)
      return
    }

    const duration = 900
    const start = performance.now()
    let frame = 0

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setDisplayTotal(Math.round(total * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [isAnimated, total])

  const segments = useMemo(() => {
    const denominator = total || 1
    const circumference = 2 * Math.PI * RADIUS

    const progressDash = (inProgress / denominator) * circumference
    const completedDash = (completed / denominator) * circumference
    const cancelledDash = (cancelled / denominator) * circumference

    return {
      circumference,
      progressDash,
      completedDash,
      cancelledDash,
      completedOffset: -progressDash,
      cancelledOffset: -(progressDash + completedDash),
    }
  }, [total, inProgress, completed, cancelled])

  return (
    <div className={className ?? 'projects-sidebar-donut'} aria-label={`${total} total projects`}>
      <div className="projects-sidebar-donut-inner">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="projects-sidebar-donut-svg"
          aria-hidden
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth={STROKE}
          />

          {inProgress > 0 ? (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={STROKE}
              strokeDasharray={`${isAnimated ? segments.progressDash : 0} ${segments.circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              className="projects-sidebar-donut-segment projects-sidebar-donut-segment--progress"
            />
          ) : null}

          {completed > 0 ? (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="#22c55e"
              strokeWidth={STROKE}
              strokeDasharray={`${isAnimated ? segments.completedDash : 0} ${segments.circumference}`}
              strokeDashoffset={segments.completedOffset}
              strokeLinecap="round"
              className="projects-sidebar-donut-segment projects-sidebar-donut-segment--completed"
            />
          ) : null}

          {cancelled > 0 ? (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="#ef4444"
              strokeWidth={STROKE}
              strokeDasharray={`${isAnimated ? segments.cancelledDash : 0} ${segments.circumference}`}
              strokeDashoffset={segments.cancelledOffset}
              strokeLinecap="round"
              className="projects-sidebar-donut-segment projects-sidebar-donut-segment--cancelled"
            />
          ) : null}

          {total > 0 && inProgress === 0 && completed === 0 && cancelled === 0 ? (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={STROKE}
              strokeDasharray={`${isAnimated ? segments.circumference : 0} ${segments.circumference}`}
              strokeLinecap="round"
              className="projects-sidebar-donut-segment projects-sidebar-donut-segment--progress"
            />
          ) : null}
        </svg>

        <div className="projects-sidebar-donut-center">
          <span className="projects-sidebar-donut-total">{displayTotal}</span>
          <span className="projects-sidebar-donut-label">Total</span>
        </div>
      </div>
    </div>
  )
}
