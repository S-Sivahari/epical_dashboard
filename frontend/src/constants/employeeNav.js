export const employeeNavItems = [
  {
    to: '/employee',
    label: 'Employee Dashboard',
    headerTitle: 'Employee Portal',
    showWelcomeSubtitle: true,
  },
  {
    to: '/employee/timesheet',
    label: 'Timesheet',
    headerTitle: 'Timesheet',
  },
  {
    to: '/employee/leave',
    label: 'Leave Request',
    headerTitle: 'Leave Request',
  },
  {
    to: '/employee/calendar',
    label: 'Company Calendar',
    headerTitle: 'Company Calendar',
  },
  {
    to: '/employee/documents',
    label: 'Documents',
    headerTitle: 'Documents',
  },
  {
    to: '/employee/training',
    label: 'Training & Courses',
    headerTitle: 'Training & Courses',
  },
  {
    to: '/employee/achievements',
    label: 'Company Achievements',
    headerTitle: 'Company Achievements',
  },
  {
    to: '/employee/support',
    label: 'Raise Tickets',
    headerTitle: 'Raise Tickets',
  },
]

export function getEmployeePageHeader(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/employee'

  if (normalized === '/employee') {
    return {
      title: 'Employee Portal',
      showWelcomeSubtitle: true,
    }
  }

  const match = [...employeeNavItems]
    .filter((item) => item.to !== '/employee')
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => normalized === item.to || normalized.startsWith(`${item.to}/`))

  if (match) {
    return {
      title: match.headerTitle ?? match.label,
      showWelcomeSubtitle: false,
    }
  }

  return {
    title: 'Employee Portal',
    showWelcomeSubtitle: false,
  }
}
