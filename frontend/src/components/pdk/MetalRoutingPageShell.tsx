import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function MetalRoutingPageShell({
  children,
  fill,
  bleed,
  className,
}: {
  children: ReactNode
  fill?: boolean
  bleed?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex w-full min-h-0 flex-1 flex-col',
        fill ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto w-full',
          bleed ? 'metal-routing-page-shell--bleed max-w-none' : 'max-w-[1440px] metal-routing-page-shell',
          fill ? 'flex min-h-0 flex-1 flex-col' : 'min-h-0',
        )}
      >
        {children}
      </div>
    </div>
  )
}
