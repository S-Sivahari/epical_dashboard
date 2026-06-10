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
      <div
        className={cn(
          'mx-auto w-full max-w-[1440px]',
          'metal-routing-page-shell',
          fill ? 'flex min-h-0 flex-1 flex-col' : '',
        )}
      >
        {children}
      </div>
    </div>
  )
}
