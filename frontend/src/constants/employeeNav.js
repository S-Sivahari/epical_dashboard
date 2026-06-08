import { getEmployeePageTitle } from '@constants/employeeNavigation'

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
    to: '/employee/tickets',
    label: 'Raise Tickets',
    headerTitle: 'Raise Tickets',
  },
  {
    to: '/employee/help',
    label: 'Employee Guide',
    headerTitle: 'Employee Guide',
  },
  {
    to: '/employee/profile',
    label: 'My Profile',
    headerTitle: 'My Profile',
  },
]

/** Grouped sidebar navigation (labels may differ slightly for compact display). */
export const employeeNavGroups = [
  {
    label: 'Overview',
    items: [{ to: '/employee', label: 'Dashboard', end: true }],
  },
  {
    label: 'Work',
    items: [
      { to: '/employee/timesheet', label: 'Timesheet' },
      { to: '/employee/leave', label: 'Leave Request' },
      { to: '/employee/calendar', label: 'Company Calendar' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { to: '/employee/documents', label: 'Documents' },
      { to: '/employee/training', label: 'Training & Courses' },
      { to: '/employee/achievements', label: 'Company Achievements' },
    ],
  },
  {
    label: 'Support',
    items: [
      { to: '/employee/tickets', label: 'Raise Tickets' },
      { to: '/employee/help', label: 'Employee Guide' },
    ],
  },
  {
    label: 'Account',
    items: [{ to: '/employee/profile', label: 'My Profile' }],
  },
]

export function getEmployeePageHeader(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/employee'
  return {
    title: getEmployeePageTitle(normalized),
    showWelcomeSubtitle: false,
  }
}
