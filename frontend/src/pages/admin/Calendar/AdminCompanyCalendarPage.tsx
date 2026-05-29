import { PageWrapper } from '@components/layout/PageWrapper'
import { CompanyCalendar } from '../Leaves/CompanyCalendar'

/** Standalone admin route — same calendar component as Manage Leaves tab, no extra header gap. */
export default function AdminCompanyCalendarPage() {
  return (
    <PageWrapper>
      <div className="crewiq-dashboard">
        <CompanyCalendar />
      </div>
    </PageWrapper>
  )
}
