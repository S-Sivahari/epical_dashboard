import { CompanyCalendar } from '../Leaves/CompanyCalendar'

/** Standalone admin route — fills viewport below command bar + section nav. */
export default function AdminCompanyCalendarPage() {
  return (
    <div className="admin-calendar-page flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 font-body sm:px-4">
      <div
        className="crewiq-dashboard admin-calendar-view flex min-h-0 flex-1 flex-col"
        data-admin-calendar
      >
        <CompanyCalendar variant="admin" />
      </div>
    </div>
  )
}
