import { CompanyCalendar } from '@pages/admin/Leaves/CompanyCalendar'

/** Employee calendar — same layout as admin company calendar, read-only (no add/edit). */
export default function EmployeeCompanyCalendarPage() {
  return (
    <div className="admin-calendar-page flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 font-body sm:px-4">
      <div
        className="crewiq-dashboard admin-calendar-view flex min-h-0 flex-1 flex-col"
        data-employee-calendar
      >
        <CompanyCalendar variant="employee" />
      </div>
    </div>
  )
}
