import type { ReactNode } from 'react'

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface/50 p-4 lg:flex-row lg:flex-wrap lg:items-end">
      {children}
    </div>
  )
}
