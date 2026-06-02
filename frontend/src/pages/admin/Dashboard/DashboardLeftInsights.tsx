import { useMemo } from 'react'
import { useLeaves } from '@hooks/useLeaves'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/formatDate'
import { OUT_TODAY_TOTAL_EMPLOYEES, type OutTodayEntry, type UpcomingDeadline } from './dashboardLeftPanelsData'

const URGENCY_DOT: Record<UpcomingDeadline['urgency'], string> = {
  red: 'dashboard-deadline-dot--red',
  amber: 'dashboard-deadline-dot--amber',
  green: 'dashboard-deadline-dot--green',
}

function normalizeLeaveType(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('sick')) return 'Sick'
  if (t.includes('wfh') || t.includes('work from home')) return 'WFH'
  if (t.includes('annual') || t.includes('casual') || t.includes('privilege')) return 'Annual'
  return type || 'Leave'
}

function isOutToday(from: string, to: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T23:59:59`)
  return start <= today && today <= end
}

type DashboardLeftInsightsProps = {
  totalEmployees: number
  upcomingDeadlines: UpcomingDeadline[]
  className?: string
}

export function DashboardLeftInsights({
  totalEmployees,
  upcomingDeadlines,
  className,
}: DashboardLeftInsightsProps) {
  const { leaves } = useLeaves()

  const outToday = useMemo((): OutTodayEntry[] => {
    return leaves
      .filter((l) => l.status === 'Approved' && isOutToday(l.from, l.to))
      .map((l) => ({
        id: l.id,
        name: l.employeeName || 'Employee',
        leaveType: normalizeLeaveType(l.type),
        returnDate: formatDate(l.to, 'MMM d'),
      }))
  }, [leaves])

  const employeeTotal = totalEmployees > 0 ? totalEmployees : OUT_TODAY_TOTAL_EMPLOYEES
  const absentCount = outToday.length

  return (
    <div className={cn('dashboard-left-insights', className)}>
      <section className="dashboard-insight-panel dashboard-insight-panel--mint dashboard-insight-panel--out-today">
        <header className="dashboard-insight-panel-header">
          <h3 className="dashboard-insight-panel-title">Who&apos;s out today</h3>
        </header>
        <div className="dashboard-insight-panel-body">
          <div className="dashboard-insight-panel-scroll">
            {outToday.length === 0 ? (
              <p className="dashboard-insight-empty">No approved leave for today.</p>
            ) : (
              <ul className="dashboard-insight-list" role="list">
                {outToday.map((entry, index) => (
                  <li
                    key={entry.id}
                    className={cn(
                      'dashboard-insight-row',
                      index < outToday.length - 1 && 'dashboard-insight-row--bordered',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="dashboard-insight-primary">{entry.name}</p>
                      <p className="dashboard-insight-secondary">
                        {entry.leaveType} · Returns {entry.returnDate}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="dashboard-insight-footer">
            {absentCount} of {employeeTotal} employees absent
          </p>
        </div>
      </section>

      <section className="dashboard-insight-panel dashboard-insight-panel--mint">
        <header className="dashboard-insight-panel-header">
          <h3 className="dashboard-insight-panel-title">Upcoming deadlines this week</h3>
        </header>
        <div className="dashboard-insight-panel-body">
          <div className="dashboard-insight-panel-scroll">
            {upcomingDeadlines.length === 0 ? (
              <p className="dashboard-insight-empty">No deadlines this week.</p>
            ) : (
              <ul className="dashboard-insight-list" role="list">
                {upcomingDeadlines.map((item, index) => (
                  <li
                    key={item.id}
                    className={cn(
                      'dashboard-insight-row dashboard-insight-row--deadline',
                      index < upcomingDeadlines.length - 1 && 'dashboard-insight-row--bordered',
                    )}
                  >
                    <span className={cn('dashboard-deadline-dot', URGENCY_DOT[item.urgency])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="dashboard-insight-deadline-date">{item.dateLabel}</p>
                      <p className="dashboard-insight-secondary">{item.label}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
