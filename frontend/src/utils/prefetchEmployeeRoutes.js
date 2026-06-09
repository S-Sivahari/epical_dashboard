/** Prefetch lazy route chunks on sidebar hover so nav feels instant in dev. */
const prefetchers = {
  '/employee': () => import('@pages/employee/Dashboard'),
  '/employee/timesheet': () =>
    Promise.all([
      import('@pages/employee/Timesheet'),
      import('@pages/employee/TimesheetWeeklyChart'),
    ]),
  '/employee/projects': () =>
    Promise.all([
      import('@components/employee/projects/EmployeeProjectsLayout'),
      import('@pages/employee/EmployeeProjectsDashboard'),
    ]),
  '/employee/leave': () => import('@pages/employee/LeaveRequest'),
  '/employee/calendar': () => import('@pages/employee/CompanyCalendar'),
  '/employee/documents': () => import('@pages/employee/DocumentRequest'),
  '/employee/training': () => import('@pages/employee/Training'),
  '/employee/achievements': () => import('@pages/employee/Achievements'),
  '/employee/tickets': () => import('@pages/employee/HelpSupport'),
  '/employee/help': () => import('@pages/employee/EmployeeHelpSupport'),
  '/employee/profile': () => import('@pages/employee/EmployeeProfile'),
}

export function prefetchEmployeeRoute(path) {
  prefetchers[path]?.()
}

export function prefetchEmployeeDashboard() {
  prefetchEmployeeRoute('/employee')
}
