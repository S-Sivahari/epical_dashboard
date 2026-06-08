import { motion } from 'framer-motion'
import { cn } from '@pages/employee/lib/utils'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

const KPI_TONES = ['sage', 'amber', 'sky', 'violet']

export function KPIStatCard({ title, value, icon: Icon, trend, className, tone, toneIndex = 0 }) {
  const resolvedTone = tone ?? KPI_TONES[((toneIndex % KPI_TONES.length) + KPI_TONES.length) % KPI_TONES.length]

  return (
    <motion.div
      data-portal-card=""
      tabIndex={0}
      whileHover={{ y: -2 }}
      className={cn(
        portalCardClass({
          className: cn(
            'emp-kpi-card flex h-full min-h-[5.75rem] cursor-default flex-col justify-center p-4 sm:p-5',
            `emp-kpi-card--${resolvedTone}`,
            className,
          ),
        }),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-card-label truncate">{title}</p>
          <p className="type-metric-lg mt-1 text-foreground">{value}</p>
          {trend && <p className="mt-1 truncate text-xs text-primary">{trend}</p>}
        </div>
        {Icon && (
          <div className={cn('emp-dash-icon', `emp-dash-icon--${resolvedTone}`)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  )
}
