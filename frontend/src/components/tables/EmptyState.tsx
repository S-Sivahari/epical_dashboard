import type { LucideIcon } from 'lucide-react'
import { Button } from '@components/ui/Button'

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted" />
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
