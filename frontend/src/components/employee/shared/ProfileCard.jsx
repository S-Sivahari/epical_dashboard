import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Calendar,
  BadgeCheck,
  Building2,
  Clock,
  FileText,
  CalendarOff,
  BookOpen,
  FolderKanban,
  ArrowRight,
  LogIn,
  LogOut,
} from 'lucide-react'
import { EmployeePhotoAvatar } from '@components/employee/shared/EmployeePhotoAvatar'
import { formatDate } from '@pages/employee/lib/utils'

const quickLinks = [
  { to: '/employee/timesheet', label: 'Timesheet', icon: Clock },
  { to: '/employee/leave', label: 'Leave', icon: CalendarOff },
  { to: '/employee/documents', label: 'Documents', icon: FileText },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function ProfileCard({ employee, profile, attendance }) {
  if (!employee) return null

  const firstName = employee.name?.split(' ')[0] ?? 'there'
  const employeeCode = profile?.employeeId ?? employee.id
  const roleLabel = profile?.designation ?? profile?.role ?? employee.designation
  const department = profile?.department

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-primary to-teal-600 p-6 shadow-lg md:p-8"
    >
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/5" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <EmployeePhotoAvatar
            employeeId={employee.id}
            name={employee.name}
            className="h-20 w-20 border-4 border-white/40 shadow-lg md:h-24 md:w-24"
            fallbackClassName="bg-white/20 text-2xl text-white"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80">{greeting()},</p>
            <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">{employee.name}</h2>
            <p className="mt-1 text-sm text-white/75">{employeeCode}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
              {roleLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-white/70" />
                  {roleLabel}
                </span>
              ) : null}
              {department ? (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 shrink-0 text-white/70" />
                  {department}
                </span>
              ) : null}
              {(profile?.joinedAt ?? employee.joinedAt) ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0 text-white/70" />
                  Joined {formatDate(profile?.joinedAt ?? employee.joinedAt)}
                </span>
              ) : null}
            </div>
            {attendance?.checkedIn && !attendance?.checkOutTime ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                Checked in today
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
          {quickLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
