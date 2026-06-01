import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { Bell, CreditCard, Newspaper, Shield, User } from 'lucide-react'
import { GlassCard, SectionHeader } from './shared'

interface ActivityItem {
  id: string
  type: string
  title: string
  detail: string
  time: string
  icon: 'leave' | 'payroll' | 'news' | 'admin' | 'employee'
}

const iconMap = {
  leave: { Icon: User, color: 'var(--emerald-primary)', bg: 'var(--emerald-surface)' },
  payroll: { Icon: CreditCard, color: 'var(--emerald-dark)', bg: 'var(--emerald-sage)' },
  news: { Icon: Newspaper, color: 'var(--emerald-fresh)', bg: 'var(--emerald-surface)' },
  admin: { Icon: Shield, color: 'var(--emerald-dark)', bg: 'var(--emerald-sage)' },
  employee: { Icon: Bell, color: 'var(--emerald-primary)', bg: 'var(--emerald-surface)' },
}

export function LiveOperationsHub({ activities }: { activities: ActivityItem[] }) {
  return (
    <section>
      <SectionHeader
        title="Live Operations"
        subtitle="Real-time activity stream across your organization"
        tone="green"
        badge={<span className="cmd-badge-green inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"><span className="h-2 w-2 animate-pulse rounded-full bg-[var(--text-green)]" /> Live</span>}
      />
      <GlassCard padding="none" hover={false} className="overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
          {activities.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">No recent operations</p>
          ) : (
            <div className="relative px-5 py-4">
              <div className="absolute bottom-4 left-[2.125rem] top-4 w-px bg-[var(--border-subtle)]" aria-hidden />
              {activities.map((item, i) => {
                const { Icon, color, bg } = iconMap[item.icon]
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="cmd-timeline-item relative flex gap-4 pb-6 last:pb-0"
                  >
                    <div
                      className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-white"
                      style={{ background: bg, color }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                        <time className="shrink-0 text-[10px] text-[var(--text-muted)]">
                          {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                        </time>
                      </div>
                      <p className="mt-0.5 text-sm text-[var(--text-slate-blue)]">{item.detail}</p>
                      <span className="mt-1.5 inline-block rounded-md bg-[var(--emerald-sage)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-teal)]">
                        {item.type.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </GlassCard>
    </section>
  )
}
