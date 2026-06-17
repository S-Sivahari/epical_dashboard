import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function PageWrapper({
  children,
  className,
  fillViewport,
  scrollable,
}: {
  children: ReactNode
  className?: string
  /** Fills admin/employee main area without outer page scroll */
  fillViewport?: boolean
  /** Long content — allows page-level vertical scroll */
  scrollable?: boolean
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:px-6',
        fillViewport && 'flex min-h-0 flex-1 flex-col max-w-none',
        fillViewport &&
          !scrollable &&
          'overflow-hidden max-lg:overflow-x-hidden max-lg:overflow-y-auto',
        scrollable && 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden',
        className,
      )}
      {...(scrollable ? { 'data-page-scrollable': true } : {})}
    >
      {children}
    </div>
  )
}
