import { Calendar } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'

type Props = {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

export function AdminLeaveDateRange({ from, to, onChange }: Props) {
  const handleFrom = (value: string) => {
    const nextTo = value && to && value > to ? value : to
    onChange(value, nextTo)
  }

  const handleTo = (value: string) => {
    const nextFrom = value && from && value < from ? value : from
    onChange(nextFrom, value)
  }

  const summary =
    from && to
      ? from === to
        ? formatDate(from)
        : `${formatDate(from)} – ${formatDate(to)}`
      : 'Select range'

  return (
    <div className="admin-leaves-date-range" title={summary}>
      <Calendar className="admin-leaves-date-range-icon" aria-hidden />
      <div className="admin-leaves-date-range-fields">
        <input
          type="date"
          value={from}
          onChange={(e) => handleFrom(e.target.value)}
          className="admin-leaves-date-range-input"
          aria-label="Start date"
        />
        <span className="admin-leaves-date-range-sep" aria-hidden>
          –
        </span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => handleTo(e.target.value)}
          className="admin-leaves-date-range-input"
          aria-label="End date"
        />
      </div>
    </div>
  )
}
