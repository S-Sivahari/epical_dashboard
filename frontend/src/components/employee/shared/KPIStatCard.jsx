import { motion } from 'framer-motion'
import { cn } from '@pages/employee/lib/utils'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

export function KPIStatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <motion.div
      data-portal-card=""
      tabIndex={0}
      whileHover={{ y: -2 }}
      className={cn(portalCardClass({ className: cn('cursor-default p-5', className) }))}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{value}</p>
          {trend && <p className="mt-1 text-xs text-primary">{trend}</p>}
        </div>
        {Icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  )
}
