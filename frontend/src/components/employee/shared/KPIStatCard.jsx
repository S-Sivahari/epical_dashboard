import { motion } from 'framer-motion'
import { cn } from '@pages/employee/lib/utils'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

export function KPIStatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <motion.div
      data-portal-card=""
      tabIndex={0}
      whileHover={{ y: -2 }}
      className={cn(portalCardClass({ className: cn('flex h-full min-h-[5.75rem] cursor-default flex-col justify-center p-4 sm:p-5', className) }))}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-card-label truncate">{title}</p>
          <p className="type-metric-lg mt-1 text-foreground">{value}</p>
          {trend && <p className="mt-1 truncate text-xs text-primary">{trend}</p>}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  )
}
