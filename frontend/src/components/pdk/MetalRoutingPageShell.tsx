import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function MetalRoutingPageShell({
  children,
  fill,
  className,
}: {
  children: ReactNode
  fill?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex w-full min-h-0 flex-1 flex-col',
        fill ? 'overflow-hidden' : 'overflow-y-auto',
        className,
      )}
    >
      <div className={cn(fill ? 'flex min-h-0 flex-1 flex-col p-4 sm:p-5' : 'p-4 sm:p-5 lg:p-6')}>
        {children}
      </div>
    </div>
  )
}
