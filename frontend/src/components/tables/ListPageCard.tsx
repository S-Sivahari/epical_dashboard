import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** Tabler list card: card-header toolbar + table body + card-footer */
export function ListPageCard({
  toolbar,
  children,
  footer,
  className,
}: {
  toolbar?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('card', className)}>
      {toolbar ? (
        <div className="card-header">
          <div className="empwr-list-toolbar">{toolbar}</div>
        </div>
      ) : null}
      <div className="card-table table-responsive">{children}</div>
      {footer ? <div className="card-footer">{footer}</div> : null}
    </div>
  )
}
