import { motion } from 'framer-motion'
import { cn } from '@pages/employee/lib/utils'

const VARIANTS = {
  teal: {
    card: 'emp-ts-summary-card--teal',
    icon: 'emp-ts-summary-icon--teal',
    value: 'emp-ts-summary-value--teal',
    label: 'emp-ts-summary-label--teal',
    hint: 'emp-ts-summary-hint--teal',
  },
  turquoise: {
    card: 'emp-ts-summary-card--turquoise',
    icon: 'emp-ts-summary-icon--turquoise',
    value: 'emp-ts-summary-value--turquoise',
    label: 'emp-ts-summary-label--turquoise',
    hint: 'emp-ts-summary-hint--turquoise',
  },
  emerald: {
    card: 'emp-ts-summary-card--emerald',
    icon: 'emp-ts-summary-icon--emerald',
    value: 'emp-ts-summary-value--emerald',
    label: 'emp-ts-summary-label--emerald',
    hint: 'emp-ts-summary-hint--emerald',
  },
}

export function TimesheetSummaryCard({
  variant = 'emerald',
  title,
  value,
  hint,
  icon: Icon,
  className,
}) {
  const styles = VARIANTS[variant] ?? VARIANTS.emerald

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className={cn('emp-ts-summary-card', styles.card, className)}
    >
      <div className="emp-ts-summary-card-inner">
        <div className="min-w-0 flex-1">
          <p className={cn('emp-ts-summary-label', styles.label)}>{title}</p>
          <p className={cn('emp-ts-summary-value', styles.value)}>{value}</p>
          {hint ? <p className={cn('emp-ts-summary-hint', styles.hint)}>{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={cn('emp-ts-summary-icon', styles.icon)} aria-hidden>
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
