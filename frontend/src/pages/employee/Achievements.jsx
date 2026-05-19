import { motion } from 'framer-motion'
import { Trophy, Award, Star, Medal } from 'lucide-react'
import { achievements } from '@pages/employee/data/mockData'
import { formatDate } from '@pages/employee/lib/utils'

const iconMap = { trophy: Trophy, award: Award, star: Star, medal: Medal }

export default function Achievements() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-2xl font-bold">Your Achievements</h2>
        <p className="text-muted">Recognition and milestones at Epical Technologies</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {achievements.map((a, i) => {
          const Icon = iconMap[a.icon] || Trophy
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.03 }}
              className="rounded-xl border border-border bg-card p-6 text-center shadow-card"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-heading font-semibold">{a.title}</h3>
              <p className="mt-1 text-xs text-primary">{a.date}</p>
              <p className="mt-2 text-sm text-muted">{a.description}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-heading text-lg font-semibold">Milestone Timeline</h3>
        <div className="mt-6 space-y-0">
          {achievements.map((a, i) => (
            <div key={a.id} className="relative flex gap-4 pb-8 last:pb-0">
              {i < achievements.length - 1 && (
                <div className="absolute left-[11px] top-6 h-full w-0.5 bg-border" />
              )}
              <div className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="font-heading font-semibold">{a.title}</p>
                <p className="text-xs text-muted">{formatDate(a.date)}</p>
                <p className="mt-1 text-sm text-muted">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
