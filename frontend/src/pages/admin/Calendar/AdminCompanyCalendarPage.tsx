import { PageWrapper } from '@components/layout/PageWrapper'
import { CompanyCalendar } from '../Leaves/CompanyCalendar'

/** Standalone admin route — same calendar component as Manage Leaves tab, no extra header gap. */
export default function AdminCompanyCalendarPage() {
  return (
    <PageWrapper className="admin-calendar-page relative z-10 flex h-full min-h-0 flex-col overflow-hidden py-2 font-body">
      <div className="crewiq-dashboard admin-calendar-view flex min-h-0 flex-1 flex-col" data-admin-calendar>
        <CompanyCalendar variant="admin" />
      </div>
    </PageWrapper>
  )
}
