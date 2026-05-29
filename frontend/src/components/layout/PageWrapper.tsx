import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function PageWrapper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:px-6', className)}>
      {children}
    </div>
  )
}
