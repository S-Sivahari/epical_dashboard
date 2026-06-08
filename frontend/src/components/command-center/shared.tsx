import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { cardHover } from '@/utils/motionPresets'

export function GlassCard({
  children,
  className,
  hover = true,
  padding = 'md',
}: {
  children: ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}) {
  const paddingClass = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }[padding]

  return (
    <motion.div
      className={cn('cmd-glass-card', paddingClass, className)}
      {...(hover ? cardHover : {})}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
  badge,
  tone = 'default',
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  badge?: ReactNode
  tone?: 'default' | 'blue' | 'green'
}) {
  const titleClass =
    tone === 'blue'
      ? 'cmd-section-title cmd-section-title-blue'
      : tone === 'green'
        ? 'cmd-section-title cmd-section-title-green'
        : 'cmd-section-title'

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className={titleClass}>{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="cmd-section-subtitle mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('cmd-skeleton rounded-xl', className)} />
}

export function ProgressRing({
  value,
  size = 48,
  stroke = 4,
  color = 'var(--emerald-primary)',
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--emerald-sage)"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}
