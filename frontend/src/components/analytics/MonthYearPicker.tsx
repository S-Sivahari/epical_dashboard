import { CalendarDays } from 'lucide-react'

type Props = {
  year: number
  month: number
  onChange: (year: number, month: number) => void
  id?: string
}

function toInputValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseInputValue(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function MonthYearPicker({ year, month, onChange, id = 'analytics-period' }: Props) {
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="admin-analytics-filter-field">
      <label htmlFor={id} className="admin-analytics-filter-label">
        Reporting Period
      </label>
      <div className="admin-analytics-period-wrap">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2f6b4f]" />
        <input
          id={id}
          type="month"
          value={toInputValue(year, month)}
          max={toInputValue(new Date().getFullYear(), new Date().getMonth() + 1)}
          onChange={(e) => {
            const parsed = parseInputValue(e.target.value)
            if (parsed) onChange(parsed.year, parsed.month)
          }}
          className="admin-analytics-period-input"
          aria-label={`Reporting period: ${label}`}
        />
        <span className="admin-analytics-period-label">{label}</span>
      </div>
    </div>
  )
}
