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
import { getEmployeeAvatarUrl } from '@/utils/getAvatarUrl'
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
  sage: 'emp-stat-chip--sage',
  teal: 'emp-stat-chip--teal',
  amber: 'emp-stat-chip--amber',
  blue: 'emp-stat-chip--blue',
  violet: 'emp-stat-chip--violet',
}

function ProfileStatMini({ title, value, trend, icon: Icon, horizontal = false, accent, to }) {
  const accentClass = accent ? STAT_ACCENT_CLASS[accent] : null
  const statClassName = cn(
    horizontal
      ? 'emp-dash-btn emp-dash-btn--stat flex flex-col justify-center'
      : 'flex flex-1 flex-col justify-center rounded-lg border border-white/25 bg-black/10 transition-colors',
    to && horizontal && 'emp-dash-btn--link',
    to && !horizontal && 'cursor-pointer hover:bg-black/20',
    !horizontal && accentClass,
  )
  
  const statStyle = horizontal ? {
    minWidth: 'clamp(4.2rem, 3.8rem + 2vw, 5rem)',
    padding: 'clamp(0.45rem, 0.425rem + 0.125vw, 0.55rem) clamp(0.55rem, 0.5rem + 0.25vw, 0.65rem)',
  } : {
    minWidth: 'clamp(4rem, 3.6rem + 2vw, 4.8rem)',
    padding: 'clamp(0.375rem, 0.35rem + 0.125vw, 0.45rem)',
  }

  if (horizontal) {
    const content = (
      <span className="emp-dash-btn__label flex min-w-0 flex-col">
        <p className="emp-dash-btn__stat-title truncate text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]">
          {title}
        </p>
        <p className="emp-dash-btn__stat-value text-lg font-bold leading-none sm:text-xl">{value}</p>
        {trend ? (
          <p className="emp-dash-btn__stat-trend truncate text-[10px] sm:text-[11px]">{trend}</p>
        ) : null}
      </span>
    )

    if (to) {
      return (
        <Link to={to} className={statClassName} style={statStyle} title={`Go to ${title}`}>
          {content}
        </Link>
      )
    }

    return (
      <div className={statClassName} style={statStyle}>
        {content}
      </div>
    )
  }

  const verticalContent = (
    <>
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
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        title={`Go to ${title}`}
        className={cn(
          'block rounded-lg border border-white/25 bg-black/10 transition-colors hover:bg-black/20',
          accentClass,
        )}
        style={statStyle}
      >
        {verticalContent}
      </Link>
    )
  }

  return (
    <div className={cn('rounded-lg border border-white/25 bg-black/10', accentClass)} style={statStyle}>
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

  const photoFallback = getEmployeeAvatarUrl(
    profile ?? {},
    undefined,
  ) ?? employee?.avatarUrl

  const statsRow = statsLoading ? (
    <div
      className={cn(
        'flex gap-2',
        horizontal
          ? 'emp-dashboard-hero__stats-row w-full flex-wrap justify-start gap-2 sm:justify-end sm:gap-2.5'
          : 'mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-4 sm:grid-cols-4',
      )}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse rounded-lg bg-black/10',
            horizontal ? 'emp-dash-btn emp-dash-btn--stat emp-dash-btn--skeleton h-16 min-w-[6.75rem] sm:min-w-[7.5rem]' : 'h-[4.25rem]',
          )}
        />
      ))}
    </div>
  ) : Array.isArray(stats) && stats.length > 0 ? (
    <div
      className={cn(
        'flex gap-2',
        horizontal
          ? 'emp-dashboard-hero__stats-row w-full flex-wrap justify-start gap-2 sm:justify-end sm:gap-2.5'
          : 'mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-4 sm:grid-cols-4',
      )}
    >
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
          'emp-dashboard-hero emp-dashboard-hero--comb relative min-h-[7rem] min-w-0 flex-1 overflow-hidden rounded-xl shadow-card sm:min-h-[7.5rem]',
          className,
        )}
      >
        <div className="emp-dashboard-hero__decor" aria-hidden>
          <div className="emp-dashboard-hero__decor-base" />
          <div className="emp-dashboard-hero__decor-grid emp-dashboard-hero__decor-grid--soft" />
          <div className="emp-dashboard-hero__decor-grid emp-dashboard-hero__decor-grid--sharp" />
          <div className="emp-dashboard-hero__decor-circuit" />
          <span className="emp-dashboard-hero__decor-vline emp-dashboard-hero__decor-vline--1" />
          <span className="emp-dashboard-hero__decor-vline emp-dashboard-hero__decor-vline--2" />
          <span className="emp-dashboard-hero__decor-vline emp-dashboard-hero__decor-vline--3" />
          <span className="emp-dashboard-hero__decor-shard" />
          <span className="emp-dashboard-hero__decor-dot emp-dashboard-hero__decor-dot--1" />
          <span className="emp-dashboard-hero__decor-dot emp-dashboard-hero__decor-dot--2" />
          <span className="emp-dashboard-hero__decor-dot emp-dashboard-hero__decor-dot--3" />
          <span className="emp-dashboard-hero__decor-dot emp-dashboard-hero__decor-dot--4" />
        </div>

        <div className="emp-dashboard-hero__inner">
          <div className="emp-dashboard-hero__identity">
            <div className="emp-dashboard-hero__avatar-ring shrink-0">
              <EmployeePhotoAvatar
                employeeId={employee.id}
                name={employee.name}
                fallbackSrc={photoFallback}
                className="emp-dashboard-hero__avatar h-11 w-11 sm:h-12 sm:w-12"
                fallbackClassName="bg-transparent text-sm font-semibold text-slate-700 sm:text-base"
              />
            </div>

            <span className="emp-dashboard-hero__divider hidden sm:block" aria-hidden />

            <div className="emp-dashboard-hero__identity-copy min-w-0">
              <p className="emp-dashboard-hero__greeting truncate text-black">{greeting()},</p>
              <h2 className="emp-dashboard-hero__name truncate font-heading font-bold uppercase tracking-wide text-black">
                {employee.name}
              </h2>
              <p className="emp-dashboard-hero__role truncate text-xs text-black sm:text-sm">{roleLabel ?? employeeCode}</p>
            </div>
          </div>

          <div className="emp-dashboard-hero__stats-panel">{statsRow}</div>
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
            fallbackSrc={photoFallback}
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
