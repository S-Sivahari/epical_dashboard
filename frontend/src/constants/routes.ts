export const ROUTES = {
  LOGIN: '/auth/login',
  DASHBOARD: '/admin',
  EMPLOYEES: '/admin/employees',
  EMPLOYEE_ADD: '/admin/employees/add',
  EMPLOYEE: (id: string) => `/admin/employees/${id}`,
  EMPLOYEE_EDIT: (id: string) => `/admin/employees/${id}/edit`,
  LEAVES: '/admin/leaves',
  PROJECT_ANALYSIS: '/admin/project-management',
  PROJECT_ANALYSIS_PROJECTS: '/admin/project-management/projects',
  PROJECT_ANALYSIS_PROJECT_WORKSPACE: (id: string) => `/admin/project-management/projects/${id}`,
  PROJECT_ANALYSIS_PROJECT_CELL: (projectId: string, cellId: string) =>
    `/admin/project-management/projects/${projectId}/cells/${cellId}`,
  PROJECT_ANALYSIS_SIGNAL: '/admin/project-management/signal-analysis',
  PROJECT_ANALYSIS_NOTES: '/admin/project-management/notes',
  PROJECTS: '/admin/projects',
  PROJECT_WORKSPACE: (id: string) => `/admin/projects/${id}`,
  PROJECT_CELL: (projectId: string, cellId: string) => `/admin/projects/${projectId}/cells/${cellId}`,
  PROJECT_MGMT: '/admin/project-mgmt',
  PROJECT_MGMT_REVIEWS: '/admin/project-mgmt/reviews',
  PROJECT_MGMT_PROJECT: (id: string) => `/admin/project-mgmt/projects/${id}`,
  PROJECT_MGMT_CELL: (id: string) => `/admin/project-mgmt/cells/${id}`,
  EMPLOYEE_PROJECTS: '/employee/projects',
  EMPLOYEE_MY_PROJECTS: '/employee/projects/my-projects',
  EMPLOYEE_PROJECT_WORKSPACE: (id: string) => `/employee/projects/${id}`,
  EMPLOYEE_PROJECT_CELL: (projectId: string, cellId: string) =>
    `/employee/projects/${projectId}/cells/${cellId}`,
  EMPLOYEE_CELL: (id: string) => `/employee/cells/${id}`,
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
  NOTES: '/admin/project-management/notes',
  NOTES_DAY: (dateKey: string, options?: { childId?: string; highlight?: string }) => {
    const path = `/admin/project-management/notes/day/${dateKey}`
    if (!options?.childId && !options?.highlight) return path
    const params = new URLSearchParams()
    if (options.childId) params.set('child', options.childId)
    if (options.highlight) params.set('highlight', options.highlight)
    return `${path}?${params.toString()}`
  },
  SETTINGS: '/admin/settings',
  HELP: '/admin/help',
  EMPLOYEE_METAL_ROUTING: '/employee/metal-routing',
  EMPLOYEE_NOTES: '/employee/notes',
} as const
