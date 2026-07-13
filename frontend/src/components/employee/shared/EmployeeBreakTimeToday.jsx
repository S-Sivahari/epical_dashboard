import { useEffect, useState } from 'react'
import { Coffee } from 'lucide-react'
import { formatBreakTimeToday } from '@utils/workBreaks'
import { cn } from '@pages/employee/lib/utils'

export function EmployeeBreakTimeToday({
  breaks,
  serverTimeSkew = 0,
  className,
  compact = false,
}) {
  const [liveNow, setLiveNow] = useState(() => Date.now() + (serverTimeSkew || 0))

  useEffect(() => {
    setLiveNow(Date.now() + (serverTimeSkew || 0))
  }, [serverTimeSkew, breaks])

  useEffect(() => {
    const tick = () => setLiveNow(Date.now() + (serverTimeSkew || 0))
    tick()
    const intervalMs = breaks?.activeBreak ? 1000 : 15000
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [serverTimeSkew, breaks?.activeBreak])

  const label = formatBreakTimeToday(breaks, liveNow)

  return (
    <div
      className={cn('emp-break-time-today', compact && 'emp-break-time-today--compact', className)}
      aria-label={`Break time today: ${label}`}
    >
      <Coffee className="emp-break-time-today__icon" aria-hidden />
      <span className="emp-break-time-today__label">Break today</span>
      <span className="emp-break-time-today__value tabular-nums">{label}</span>
    </div>
  )
}
