import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  FileText,
  LayoutGrid,
  Newspaper,
  Receipt,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react'
import { ROUTES } from '@constants/routes'
import { APP_SHORT_NAME } from '@/utils/constants'

export type AdminNavItem = {
  to: string
  label: string
  /** Shorter label for the horizontal top nav bar */
  navLabel?: string
  icon: LucideIcon
  /** When true, only exact path matches (e.g. dashboard at /admin) */
  end?: boolean
  notificationKey?: 'leaves' | 'documents'
}

export type AdminNavGroup = {
  label: string
  items: AdminNavItem[]
}

/** Admin sidebar — mirrors AppRoutes under /admin */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Main',
    items: [{ to: ROUTES.DASHBOARD, label: 'Dashboard', navLabel: 'Dashboard', icon: LayoutGrid, end: true }],
  },
  {
    label: 'People',
    items: [
      { to: ROUTES.EMPLOYEES, label: 'Manage Employees', navLabel: 'Employees', icon: Users },
      {
        to: ROUTES.LEAVES,
        label: 'Manage Leaves',
        navLabel: 'Leaves',
        icon: CalendarCheck,
        notificationKey: 'leaves',
      },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: ROUTES.PROJECTS, label: 'Projects / Timesheet', navLabel: 'Projects', icon: Briefcase },
      { to: ROUTES.CALENDAR, label: 'Company Calendar', navLabel: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Company',
    items: [
      { to: ROUTES.PAYSLIPS, label: 'Payslips', navLabel: 'Payslips', icon: Receipt },
      { to: ROUTES.TRAINING, label: 'Training & Courses', navLabel: 'Training', icon: BookOpen },
      { to: ROUTES.ACHIEVEMENTS, label: 'Company achievements', navLabel: 'Achievements', icon: Trophy },
      { to: ROUTES.ANALYTICS, label: 'Analytics', navLabel: 'Analytics', icon: BarChart3 },
      {
        to: ROUTES.DOCUMENTS,
        label: 'Documents Request',
        navLabel: 'Documents',
        icon: FileText,
        notificationKey: 'documents',
      },
      { to: ROUTES.NEWS, label: 'Manage News', navLabel: 'News', icon: Newspaper },
      { to: ROUTES.TICKETS, label: 'Tickets', navLabel: 'Tickets', icon: Ticket },
    ],
  },
]

/** Flat list for horizontal top navigation */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items)

/** Navbar titles for each admin route (and nested paths) */
export const ADMIN_ROUTE_TITLES: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.EMPLOYEES]: 'Manage Employees',
  [ROUTES.EMPLOYEE_ADD]: 'Add Employee',
  [ROUTES.LEAVES]: 'Manage Leaves',
  [ROUTES.PROJECTS]: 'Manage Projects',
  [ROUTES.CALENDAR]: 'Company Calendar',
  [ROUTES.TRAINING]: 'Training & Courses',
  [ROUTES.ACHIEVEMENTS]: 'Company achievements',
  [ROUTES.ANALYTICS]: 'Analytics',
  [ROUTES.DOCUMENTS]: 'Documents Request',
  [ROUTES.NEWS]: 'Manage News',
  [ROUTES.TICKETS]: 'Ticket management',
  [ROUTES.PAYSLIPS]: 'Manage Payslips',
  [ROUTES.SETTINGS]: 'Settings',
}

const ADMIN_ROUTE_PREFIXES = Object.entries(ADMIN_ROUTE_TITLES).sort(
  (a, b) => b[0].length - a[0].length,
)

export function isAdminNavActive(pathname: string, to: string, end?: boolean): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const target = to.replace(/\/+$/, '') || '/'
  if (end) {
    return normalized === target
  }
  return normalized === target || normalized.startsWith(`${target}/`)
}

export function isAdminNavGroupActive(pathname: string, group: AdminNavGroup): boolean {
  return group.items.some((item) => isAdminNavActive(pathname, item.to, item.end))
}

export function getAdminPageTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/'

  if (ADMIN_ROUTE_TITLES[normalized]) {
    return ADMIN_ROUTE_TITLES[normalized]
  }

  for (const [path, title] of ADMIN_ROUTE_PREFIXES) {
    if (normalized.startsWith(`${path}/`)) {
      if (normalized.includes('/edit')) return 'Edit Employee'
      if (normalized.match(/\/employees\/[^/]+$/)) return 'Employee Profile'
      return title
    }
  }

  if (normalized === ROUTES.DASHBOARD) return 'Dashboard'
  return APP_SHORT_NAME
}

export function shouldShowAdminBackButton(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  return parts.length > 2
}
