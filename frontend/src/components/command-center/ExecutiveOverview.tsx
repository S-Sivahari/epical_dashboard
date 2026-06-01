import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  Briefcase,
  ClipboardList,
  HeartPulse,
  Receipt,
  Users,
} from 'lucide-react'
import { AnimatedCounter } from './AnimatedCounter'
import { GlassCard, ProgressRing, SkeletonBlock } from './shared'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'
import { staggerContainer, staggerItem } from '@/utils/motionPresets'

interface ExecutiveOverviewProps {
  loading: boolean
  totalEmployees: number
  attendanceRate: number
  payrollStatus: { label: string; score: number; status: string }
  activeProjectsCount: number
  pendingRequestsCount: number
  companyHealthScore: number
}

const kpis = [
  { key: 'employees', label: 'Total Employees', icon: Users, color: 'var(--emerald-primary)', bg: 'var(--emerald-surface)', valueTone: 'text-[var(--text-primary)]' },
  { key: 'attendance', label: 'Attendance Rate', icon: Activity, color: 'var(--emerald-fresh)', bg: 'var(--emerald-sage)', suffix: '%', valueTone: 'text-[var(--text-green)]' },
  { key: 'payroll', label: 'Payroll Status', icon: Receipt, color: 'var(--emerald-dark)', bg: 'var(--emerald-surface)', valueTone: 'text-[var(--text-teal)]' },
  { key: 'projects', label: 'Active Projects', icon: Briefcase, color: 'var(--emerald-primary)', bg: 'var(--emerald-sage)', valueTone: 'text-[var(--text-blue-dark)]' },
  { key: 'requests', label: 'Pending Requests', icon: ClipboardList, color: 'var(--emerald-dark)', bg: 'rgba(209, 250, 229, 0.8)', valueTone: 'text-[var(--text-primary)]' },
  { key: 'health', label: 'Company Health', icon: HeartPulse, color: 'var(--emerald-fresh)', bg: 'var(--emerald-surface)', suffix: '/100', valueTone: 'text-[var(--text-green-fresh)]' },
] as const

export function ExecutiveOverview({
  loading,
  totalEmployees,
  attendanceRate,
  payrollStatus,
  activeProjectsCount,
  pendingRequestsCount,
  companyHealthScore,
}: ExecutiveOverviewProps) {
  const values: Record<string, number | string> = {
    employees: totalEmployees,
    attendance: attendanceRate,
    payroll: payrollStatus.score,
    projects: activeProjectsCount,
    requests: pendingRequestsCount,
    health: companyHealthScore,
  }

  return (
    <section className="cmd-hero">
      <div className="cmd-hero-bg" aria-hidden />
      <div className="relative z-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="cmd-hero-eyebrow">Executive Overview</p>
            <h1 className="cmd-hero-title">Company pulse at a glance</h1>
            <p className="cmd-hero-subtitle mt-1">
              Real-time metrics across people, payroll, and operations
            </p>
          </div>
          <Link to={ROUTES.ANALYTICS} className="cmd-hero-link">
            Full analytics →
          </Link>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            const val = values[kpi.key]
            const isAlert = kpi.key === 'requests' && pendingRequestsCount > 3

            return (
              <motion.div key={kpi.key} variants={staggerItem}>
                <GlassCard padding="sm" className={cn('cmd-kpi-card h-full', isAlert && 'cmd-kpi-alert')}>
                  {loading ? (
                    <SkeletonBlock className="h-20" />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{ background: kpi.bg, color: kpi.color }}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2.25} />
                        </div>
                        {kpi.key === 'health' && (
                          <ProgressRing value={companyHealthScore} size={40} stroke={3} />
                        )}
                        {kpi.key === 'attendance' && (
                          <ProgressRing value={attendanceRate} size={40} stroke={3} />
                        )}
                      </div>
                      <p className="cmd-metric-label mt-3">
                        {kpi.label}
                      </p>
                      <p className={cn('cmd-metric-value mt-1 font-display text-2xl tabular-nums', kpi.valueTone)}>
                        {kpi.key === 'payroll' ? (
                          <span className="text-lg">{payrollStatus.label}</span>
                        ) : typeof val === 'number' ? (
                          <AnimatedCounter value={val} suffix={'suffix' in kpi ? kpi.suffix : ''} />
                        ) : (
                          val
                        )}
                      </p>
                      {kpi.key === 'payroll' && (
                        <div className="cmd-progress-track mt-2">
                          <motion.div
                            className="cmd-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${payrollStatus.score}%` }}
                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </GlassCard>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
