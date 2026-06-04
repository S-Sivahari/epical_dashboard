import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Calendar,
  BadgeCheck,
  Building2,
  Clock,
  FileText,
  CalendarOff,
} from 'lucide-react'
import { EmployeePhotoAvatar } from '@components/employee/shared/EmployeePhotoAvatar'
import { formatDate } from '@pages/employee/lib/utils'
import { cn } from '@pages/employee/lib/utils'

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

const STAT_ACCENT_CLASS = {
  teal: 'emp-stat-chip--teal',
  amber: 'emp-stat-chip--amber',
  blue: 'emp-stat-chip--blue',
  violet: 'emp-stat-chip--violet',
}

function ProfileStatMini({ title, value, trend, icon: Icon, horizontal = false, accent }) {
  const accentClass = accent ? STAT_ACCENT_CLASS[accent] : null

  if (horizontal) {
    return (
      <div
        className={cn(
          'flex min-w-[5.25rem] flex-1 flex-col justify-center rounded-lg border border-white/25 bg-black/10 px-2 py-2',
          accentClass,
        )}
      >
        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-white/70">{title}</p>
        <div className="mt-0.5 flex items-center justify-between gap-1">
          <p className="text-base font-bold leading-none text-white">{value}</p>
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-white/80" /> : null}
        </div>
        {trend ? <p className="mt-0.5 truncate text-[9px] text-emerald-100/90">{trend}</p> : null}
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-white/25 bg-black/10 p-2.5', accentClass)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/70">{title}</p>
          <p className="mt-0.5 text-lg font-bold leading-none text-white">{value}</p>
          {trend ? <p className="mt-1 truncate text-[10px] text-emerald-100/90">{trend}</p> : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-white',
              accentClass,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ProfileCard({
  employee,
  profile,
  attendance,
  compact = false,
  horizontal = false,
  stats = null,
  statsLoading = false,
  className,
}) {
  if (!employee) return null

  const employeeCode = profile?.employeeId ?? employee.id
  const roleLabel = profile?.designation ?? profile?.role ?? employee.designation
  const department = profile?.department

  const statsRow = statsLoading ? (
    <div className={cn('flex gap-2', horizontal ? 'min-w-0 flex-1' : 'mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-4 sm:grid-cols-4')}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn('animate-pulse rounded-lg bg-black/10', horizontal ? 'h-14 min-w-[5.25rem] flex-1' : 'h-[4.25rem]')}
        />
      ))}
    </div>
  ) : Array.isArray(stats) && stats.length > 0 ? (
    <div className={cn('flex gap-2', horizontal ? 'min-w-0 flex-1' : 'mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-4 sm:grid-cols-4')}>
      {stats.map((stat) => (
        <ProfileStatMini key={stat.title} {...stat} horizontal={horizontal} />
      ))}
    </div>
  ) : null

  if (horizontal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'emp-dashboard-hero relative min-h-[6.5rem] min-w-0 flex-1 overflow-hidden rounded-xl p-3 shadow-card sm:p-4',
          className,
        )}
      >
        <div className="relative z-10 flex h-full min-w-0 items-center gap-3">
          <EmployeePhotoAvatar
            employeeId={employee.id}
            name={employee.name}
            className="h-12 w-12 shrink-0 border-2 border-white/40 shadow-md sm:h-14 sm:w-14"
            fallbackClassName="bg-white/20 text-lg text-white"
          />

          <div className="min-w-[7.5rem] shrink-0 sm:min-w-[9rem]">
            <p className="truncate text-[11px] text-white/75">{greeting()},</p>
            <h2 className="truncate font-heading text-base font-bold text-white sm:text-lg">{employee.name}</h2>
            <p className="truncate text-[11px] text-white/70">{roleLabel ?? employeeCode}</p>
            {attendance?.checkedIn && !attendance?.checkOutTime ? (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Checked in
              </p>
            ) : null}
          </div>

          {statsRow}

          <div className="hidden shrink-0 gap-1 xl:flex">
            {quickLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                title={label}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/30 bg-black/15 text-white transition-colors hover:bg-black/25"
              >
                <Icon className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'emp-dashboard-hero relative overflow-hidden rounded-xl shadow-card',
        compact ? 'p-5 md:p-6' : 'rounded-2xl p-6 shadow-lg md:p-8',
        className,
      )}
    >
      <div
        className={cn(
          'relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between',
          compact ? 'gap-4' : 'gap-6',
        )}
      >
        <div className={cn('flex flex-col sm:flex-row sm:items-center', compact ? 'gap-4' : 'gap-5')}>
          <EmployeePhotoAvatar
            employeeId={employee.id}
            name={employee.name}
            className={
              compact
                ? 'h-16 w-16 border-[3px] border-white/40 shadow-md md:h-[4.5rem] md:w-[4.5rem]'
                : 'h-20 w-20 border-4 border-white/40 shadow-lg md:h-24 md:w-24'
            }
            fallbackClassName={compact ? 'bg-white/20 text-xl text-white' : 'bg-white/20 text-2xl text-white'}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80">{greeting()},</p>
            <h2
              className={cn('font-heading font-bold text-white', compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl')}
            >
              {employee.name}
            </h2>
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

      {statsRow}
    </motion.div>
  )
}
