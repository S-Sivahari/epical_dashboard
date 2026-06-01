import { PageWrapper } from '@components/layout/PageWrapper'
import { CompanyCalendar } from '../Leaves/CompanyCalendar'

/** Standalone admin route — same calendar component as Manage Leaves tab, no extra header gap. */
export default function AdminCompanyCalendarPage() {
  return (
    <PageWrapper className="relative z-10 py-3 font-body">
      <div className="crewiq-dashboard admin-calendar-view">
        <CompanyCalendar variant="admin" />
      </div>
    </PageWrapper>
  )
}
