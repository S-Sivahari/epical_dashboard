import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Clock, Info } from 'lucide-react'
import { GlassCard, SectionHeader } from './shared'
import type { NotificationData } from '@store/notificationStore'
import { cn } from '@/utils/cn'

function categorizeNotification(n: NotificationData): 'urgent' | 'pending' | 'informational' | 'completed' {
  if (n.type.includes('Rejected') || n.type.includes('Submitted') || n.type.includes('ReviewRequested')) return 'pending'
  if (n.type.includes('Approved') || n.type.includes('Sent')) return 'completed'
  if (n.type.includes('Deleted') || n.type.includes('Skipped')) return 'urgent'
  return 'informational'
}

const groupConfig = {
  urgent: { label: 'Urgent', icon: AlertCircle, className: 'cmd-notif-urgent' },
  pending: { label: 'Pending', icon: Clock, className: 'cmd-notif-pending' },
  informational: { label: 'Informational', icon: Info, className: 'cmd-notif-info' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'cmd-notif-done' },
}

export function NotificationIntelligencePanel({
  notifications,
}: {
  notifications: NotificationData[]
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, NotificationData[]> = {
      urgent: [],
      pending: [],
      informational: [],
      completed: [],
    }
    notifications.forEach((n) => {
      groups[categorizeNotification(n)].push(n)
    })
    return groups
  }, [notifications])

  const total = notifications.length || 1
  const readCount = notifications.filter((n) => n.isRead).length
  const readRate = Math.round((readCount / total) * 100)
  const responseRate = Math.round(((grouped.completed.length + grouped.pending.length) / total) * 100)

  return (
    <section>
      <SectionHeader
        title="Notification Intelligence"
        subtitle="Grouped alerts with delivery analytics"
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Read rate', value: `${readRate}%`, tone: 'text-[var(--text-blue-dark)]' },
          { label: 'Response rate', value: `${responseRate}%`, tone: 'text-[var(--text-green)]' },
          { label: 'Delivered', value: notifications.length.toString(), tone: 'text-[var(--text-primary)]' },
        ].map((stat) => (
          <div key={stat.label} className="cmd-mini-stat rounded-xl p-3 text-center">
            <p className={`text-lg font-bold tabular-nums ${stat.tone}`}>{stat.value}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-subtle)]">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(groupConfig) as (keyof typeof groupConfig)[]).map((key) => {
          const config = groupConfig[key]
          const Icon = config.icon
          const items = grouped[key].slice(0, 3)
          return (
            <GlassCard key={key} padding="sm" className={cn('cmd-notif-group', config.className)} hover={false}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">{config.label}</h3>
                </div>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold tabular-nums">
                  {grouped[key].length}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No notifications</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((n, i) => (
                    <motion.li
                      key={n.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={cn(
                        'rounded-lg px-2.5 py-2 text-xs',
                        !n.isRead ? 'bg-white/80' : 'bg-white/50 text-[var(--text-secondary)]',
                      )}
                    >
                      <p className="font-medium text-[var(--text-primary)]">{n.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[var(--text-secondary)]">{n.message}</p>
                      <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              )}
            </GlassCard>
          )
        })}
      </div>
    </section>
  )
}
