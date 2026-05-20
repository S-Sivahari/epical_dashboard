import { motion } from 'framer-motion'
import { Progress } from '@components/employee/ui/progress'

export function LeaveCard({ type, used, total, color }) {
  const remaining = total - used
  const pct = Math.round((used / total) * 100)

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-heading text-sm font-semibold">{type}</span>
        <span className="text-xs font-medium" style={{ color }}>
          {remaining} left
        </span>
      </div>
      <Progress value={pct} indicatorClassName="bg-primary" style={{ ['--indicator']: color }} />
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>Used: {used}</span>
        <span>Total: {total}</span>
      </div>
    </motion.div>
  )
}
