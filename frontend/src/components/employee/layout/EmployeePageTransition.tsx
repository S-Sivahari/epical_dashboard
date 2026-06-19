import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'

type EmployeePageTransitionProps = {
  children: ReactNode
  className?: string
}

export function EmployeePageTransition({ children, className }: EmployeePageTransitionProps) {
  const { pathname } = useLocation()

  return (
    <div key={pathname} className={cn('emp-page-transition', className)}>
      {children}
    </div>
  )
}
