import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Sparkles, TrendingUp } from 'lucide-react'
import { GlassCard, SectionHeader } from './shared'
import { cn } from '@/utils/cn'

interface Insight {
  id: string
  type: 'warning' | 'alert' | 'success' | 'info'
  title: string
  body: string
  action: string
  route: string
}

const typeConfig = {
  warning: { icon: TrendingUp, className: 'cmd-insight-warning', label: 'Trend' },
  alert: { icon: AlertTriangle, className: 'cmd-insight-alert', label: 'Action needed' },
  success: { icon: CheckCircle2, className: 'cmd-insight-success', label: 'Positive' },
  info: { icon: Info, className: 'cmd-insight-info', label: 'Insight' },
}

export function CompanyInsightsCenter({ insights }: { insights: Insight[] }) {
  return (
    <section>
      <SectionHeader
        title="Company Insights"
        subtitle="AI-generated recommendations based on your workforce data"
        tone="blue"
        badge={
          <span className="cmd-ai-badge cmd-badge-indigo inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            <Sparkles className="h-3 w-3" /> Smart
          </span>
        }
      />
      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((insight, i) => {
          const config = typeConfig[insight.type]
          const Icon = config.icon
          return (
            <motion.div key={insight.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <GlassCard className={cn('cmd-insight-card', config.className)} hover>
                <div className="flex gap-3">
                  <div className="cmd-insight-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="cmd-insight-label text-[10px] font-semibold uppercase tracking-wider">
                      {config.label}
                    </span>
                    <h3 className="mt-0.5 font-display text-base font-semibold text-[var(--text-primary)]">
                      {insight.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-slate-blue)]">{insight.body}</p>
                    <Link
                      to={insight.route}
                      className="cmd-insight-action mt-3 inline-flex items-center gap-1 text-sm font-semibold"
                    >
                      {insight.action}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
