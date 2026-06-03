import { CompanyCalendar } from '../Leaves/CompanyCalendar'

/** Standalone admin route — fills viewport below command bar + section nav. */
export default function AdminCompanyCalendarPage() {
  return (
    <div className="admin-hub-page-wrap admin-calendar-page flex min-h-0 flex-1 flex-col overflow-x-visible overflow-y-hidden px-4 py-2 font-body sm:px-5">
      <div
        className="crewiq-dashboard admin-calendar-view relative flex min-h-0 flex-1 flex-col"
        data-admin-calendar
      >
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <CompanyCalendar variant="admin" />
        </div>
      </div>
    </div>
  )
}
