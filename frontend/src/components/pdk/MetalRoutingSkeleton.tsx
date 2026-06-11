import type { ReactNode } from 'react'
import { FolderKanban } from 'lucide-react'
import { cn } from '@/utils/cn'

export function MetalRoutingPill({
  tone,
  children,
  className,
}: {
  tone: 'success' | 'warning' | 'neutral' | 'danger'
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('metal-routing-pill', `metal-routing-pill--${tone}`, className)}>
      {children}
    </span>
  )
}

export function MetalRoutingStatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="metal-routing-stats-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="metal-routing-skeleton metal-routing-skeleton-stat" />
      ))}
    </div>
  )
}

export function MetalRoutingTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="py-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="metal-routing-skeleton metal-routing-skeleton-row" />
      ))}
    </div>
  )
}

export function MetalRoutingCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="metal-routing-skeleton-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="metal-routing-skeleton metal-routing-skeleton-card" />
      ))}
    </div>
  )
}

export function MetalRoutingEmptyState({
  icon: Icon = FolderKanban,
  title,
  description,
}: {
  icon?: typeof FolderKanban
  title: string
  description?: string
}) {
  return (
    <div className="metal-routing-empty-state" role="status">
      <span className="metal-routing-empty-state__icon" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
    </div>
  )
}
