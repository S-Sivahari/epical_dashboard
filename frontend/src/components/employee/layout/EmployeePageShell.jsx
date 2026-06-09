/**
 * Shared employee portal page chrome: canvas gradient, pattern, and content slot.
 * Applied once in AppLayout so every employee route gets the same mild accent palette.
 */
export function EmployeePageShell({ children }) {
  return (
    <div
      className="emp-portal-page crewiq-dashboard admin-dashboard-view relative flex min-h-0 flex-1 flex-col"
      data-employee-page
    >
      <div className="dashboard-page-bg pointer-events-none" aria-hidden>
        <div className="dashboard-page-bg-gradient" />
        <div className="dashboard-page-bg-pattern" />
      </div>
      <div className="emp-portal-page__content relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}
