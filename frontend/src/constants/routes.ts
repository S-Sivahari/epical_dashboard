export const ROUTES = {
  LOGIN: '/auth/login',
  DASHBOARD: '/admin',
  EMPLOYEES: '/admin/employees',
  EMPLOYEE_ADD: '/admin/employees/add',
  EMPLOYEE: (id: string) => `/admin/employees/${id}`,
  EMPLOYEE_EDIT: (id: string) => `/admin/employees/${id}/edit`,
  LEAVES: '/admin/leaves',
  PROJECTS: '/admin/projects',
  PROJECT_WORKSPACE: (id: string) => `/admin/projects/${id}`,
  PROJECT_CELL: (projectId: string, cellId: string) => `/admin/projects/${projectId}/cells/${cellId}`,
  TIMESHEET: '/admin/timesheet',
  CALENDAR: '/admin/calendar',
  TRAINING: '/admin/training',
  ACHIEVEMENTS: '/admin/achievements',
  ANALYTICS: '/admin/analytics',
  DOCUMENTS: '/admin/documents',
  NEWS: '/admin/news',
  TICKETS: '/admin/tickets',
  PAYSLIPS: '/admin/payslips',
  METAL_ROUTING: '/admin/metal-routing',
  NOTES: '/admin/notes',
  NOTES_DAY: (dateKey: string, options?: { childId?: string; highlight?: string }) => {
    const path = `/admin/notes/day/${dateKey}`
    if (!options?.childId && !options?.highlight) return path
    const params = new URLSearchParams()
    if (options.childId) params.set('child', options.childId)
    if (options.highlight) params.set('highlight', options.highlight)
    return `${path}?${params.toString()}`
  },
  SETTINGS: '/admin/settings',
  HELP: '/admin/help',
  EMPLOYEE_METAL_ROUTING: '/employee/metal-routing',
} as const
