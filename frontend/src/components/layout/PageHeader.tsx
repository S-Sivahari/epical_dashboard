import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: ReactNode // keeping the prop to avoid breaking pages passing it
  className?: string
}) {
  // Don't render the header if there's no title, subtitle, or actions
  if (!title && !subtitle && !actions) {
    return null
  }

  return (
    <header className={cn('mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {title && <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>}
        {subtitle ? <p className={cn('max-w-2xl text-sm text-muted', title ? 'mt-1' : '')}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
