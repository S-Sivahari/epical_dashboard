import { motion } from 'framer-motion'
import { cn } from '@pages/employee/lib/utils'

export function KPIStatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)' }}
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-card transition-shadow',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="type-card-label">{title}</p>
          <p className="type-metric-lg mt-1 text-foreground">{value}</p>
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
