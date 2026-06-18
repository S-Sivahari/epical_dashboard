import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CalendarDays,
  CalendarOff,
  Clock,
  FileText,
  HelpCircle,
  LayoutGrid,
  NotebookPen,
  Ticket,
  Trophy,
  User,
} from 'lucide-react'

export type EmployeeNavItem = {
  to: string
  label: string
  /** Shorter label for the horizontal top nav bar */
  navLabel?: string
  icon: LucideIcon
  end?: boolean
  notificationKey?: 'leaves' | 'documents'
}

export const EMPLOYEE_NOTES_NAV_ITEM: EmployeeNavItem = {
  to: '/employee/notes',
  label: 'Daily Notes',
  navLabel: 'Notes',
  icon: NotebookPen,
}

export const EMPLOYEE_NAV_ITEMS: EmployeeNavItem[] = [
  {
    to: '/employee',
    label: 'Employee Dashboard',
    navLabel: 'Dashboard',
    icon: LayoutGrid,
    end: true,
  },
  {
    to: '/employee/timesheet',
    label: 'Projects & Timesheets',
    navLabel: 'Projects & Timesheets',
    icon: Clock,
  },
  {
    to: '/employee/leave',
    label: 'Leave Request',
    navLabel: 'Leave',
    icon: CalendarOff,
    notificationKey: 'leaves',
  },
  {
    to: '/employee/calendar',
    label: 'Company Calendar',
    navLabel: 'Calendar',
    icon: CalendarDays,
  },
  {
    to: '/employee/documents',
    label: 'Documents',
    navLabel: 'Documents',
    icon: FileText,
    notificationKey: 'documents',
  },
  {
    to: '/employee/training',
    label: 'Training & Courses',
    navLabel: 'Training',
    icon: BookOpen,
  },
  {
    to: '/employee/achievements',
    label: 'Company Achievements',
    navLabel: 'Achievements',
    icon: Trophy,
  },
  {
    to: '/employee/tickets',
    label: 'Raise Tickets',
    navLabel: 'Tickets',
    icon: Ticket,
  },
  {
    to: '/employee/help',
    label: 'Employee Guide',
    navLabel: 'Guide',
    icon: HelpCircle,
  },
  {
    to: '/employee/profile',
    label: 'My Profile',
    navLabel: 'Profile',
    icon: User,
  },
]

/** Command bar subtitle — current page short title */
export const EMPLOYEE_ROUTE_TITLES: Record<string, string> = {
  '/employee': 'Dashboard',
  '/employee/timesheet': 'Projects & Timesheets',
  '/employee/project-analysis': 'Project Management',
  '/employee/projects': 'Projects',
  '/employee/metal-routing': 'Metal Routing',
  '/employee/notes': 'Daily Notes',
  '/employee/leave': 'Leave Request',
  '/employee/calendar': 'Company Calendar',
  '/employee/documents': 'Documents',
  '/employee/training': 'Training & Courses',
  '/employee/achievements': 'Company Achievements',
  '/employee/tickets': 'Raise Tickets',
  '/employee/help': 'Employee Guide',
  '/employee/profile': 'My Profile',
}

const ROUTE_PREFIXES = Object.entries(EMPLOYEE_ROUTE_TITLES).sort(
  (a, b) => b[0].length - a[0].length,
)

export function isEmployeeNavActive(pathname: string, to: string, end?: boolean): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const target = to.replace(/\/+$/, '') || '/'
  if (end) {
    return normalized === target
  }
  return normalized === target || normalized.startsWith(`${target}/`)
}

export function getEmployeePageTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/employee'

  if (EMPLOYEE_ROUTE_TITLES[normalized]) {
    return EMPLOYEE_ROUTE_TITLES[normalized]
  }

  for (const [path, title] of ROUTE_PREFIXES) {
    if (normalized.startsWith(`${path}/`)) {
      return title
    }
  }

  return 'Dashboard'
}

export function shouldShowEmployeeBackButton(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/'
  if (normalized === '/employee/profile') return false
  const parts = normalized.split('/').filter(Boolean)
  return parts.length > 2
}
