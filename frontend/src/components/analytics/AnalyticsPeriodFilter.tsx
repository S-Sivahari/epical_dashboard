import { CalendarDays } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { AnalyticsPeriodPreset } from '@/services/analyticsService'
import { getPeriodLabel, normalizeCustomDateRange } from '@/services/analyticsService'
import { formatDateKey } from '@/pages/admin/Dashboard/dashboardChartUtils'

const PRESETS: { value: AnalyticsPeriodPreset; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'this_week', label: 'This Week' },
  { value: 'past_week', label: 'Past Week' },
  { value: 'last_two_weeks', label: 'Last 2 Weeks' },
  { value: 'custom', label: 'Custom' },
]

type Props = {
  preset: AnalyticsPeriodPreset
  year: number
  month: number
  customFrom: string
  customTo: string
  onPresetChange: (preset: AnalyticsPeriodPreset) => void
  onMonthChange: (year: number, month: number) => void
  onCustomRangeChange: (from: string, to: string) => void
}

function toMonthInputValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseMonthInputValue(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

function todayKey() {
  return formatDateKey(new Date())
}

export function AnalyticsPeriodFilter({
  preset,
  year,
  month,
  customFrom,
  customTo,
  onPresetChange,
  onMonthChange,
  onCustomRangeChange,
}: Props) {
  const isMonth = preset === 'month'
  const isCustom = preset === 'custom'
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const rangeLabel = getPeriodLabel(preset, year, month, { from: customFrom, to: customTo })
  const maxDate = todayKey()

  return (
    <div className="admin-analytics-filter-field admin-analytics-period-filter">
      <span className="admin-analytics-filter-label">Reporting Period</span>

      <div className="admin-analytics-period-presets" role="group" aria-label="Reporting period">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={preset === p.value}
            onClick={() => onPresetChange(p.value)}
            className={cn(
              'admin-analytics-period-preset',
              preset === p.value && 'is-active',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isMonth ? (
        <div className="admin-analytics-period-wrap">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--emerald-dark)]" />
          <input
            id="analytics-period"
            type="month"
            value={toMonthInputValue(year, month)}
            max={toMonthInputValue(new Date().getFullYear(), new Date().getMonth() + 1)}
            onChange={(e) => {
              const parsed = parseMonthInputValue(e.target.value)
              if (parsed) onMonthChange(parsed.year, parsed.month)
            }}
            className="admin-analytics-period-input"
            aria-label={`Reporting period: ${monthLabel}`}
          />
          <span className="admin-analytics-period-label">{monthLabel}</span>
        </div>
      ) : isCustom ? (
        <div className="admin-analytics-custom-range" role="group" aria-label="Custom date range">
          <label className="admin-analytics-custom-range-field">
            <span className="admin-analytics-custom-range-label">Start date</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || maxDate}
              onChange={(e) => {
                const nextFrom = e.target.value
                if (!nextFrom) return
                const normalized = normalizeCustomDateRange(nextFrom, customTo || nextFrom)
                if (normalized) onCustomRangeChange(normalized.from, normalized.to)
              }}
              className="admin-analytics-custom-range-input"
            />
          </label>
          <label className="admin-analytics-custom-range-field">
            <span className="admin-analytics-custom-range-label">End date</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              max={maxDate}
              onChange={(e) => {
                const nextTo = e.target.value
                if (!nextTo) return
                const normalized = normalizeCustomDateRange(customFrom || nextTo, nextTo)
                if (normalized) onCustomRangeChange(normalized.from, normalized.to)
              }}
              className="admin-analytics-custom-range-input"
            />
          </label>
        </div>
      ) : (
        <div className="admin-analytics-period-range-label" aria-live="polite">
          {rangeLabel}
        </div>
      )}
    </div>
  )
}
