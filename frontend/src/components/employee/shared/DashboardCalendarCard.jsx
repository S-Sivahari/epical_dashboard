import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { CalendarWidget } from '@components/employee/shared/CalendarWidget'

export function DashboardCalendarCard({ holidays = [], className, fill = false }) {
  const cardClass = portalCardClass({
    className: 'flex h-full min-h-0 flex-col overflow-hidden p-3',
  })

  return (
    <InteractiveCard to="/employee/calendar" className={cn(cardClass, 'emp-dash-card emp-dash-card--violet', className)}>
      <div className="emp-dash-bottom-widget-header">
        <div className="flex min-w-0 items-center gap-2">
          <div className="emp-dash-icon emp-dash-icon--violet h-7 w-7" aria-hidden>
            <CalendarDays className="h-3.5 w-3.5" />
          </div>
          <h3 className="font-heading font-semibold text-foreground">Calendar</h3>
        </div>
        <Link
          to="/employee/calendar"
          className="emp-dash-btn emp-dash-btn--sm inline-flex shrink-0 items-center gap-0.5"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className={cn('emp-dash-calendar-mini min-h-0', fill && 'emp-dash-widget-body flex flex-1 flex-col')}>
        <CalendarWidget holidays={holidays} compact stretch />
      </div>
    </InteractiveCard>
  )
}
