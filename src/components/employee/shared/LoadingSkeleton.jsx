import { cn } from '@pages/employee/lib/utils'

export function LoadingSkeleton({ className }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-200', className)} />
}

export function PageLoader() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
