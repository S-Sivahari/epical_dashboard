import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface VuexyTab {
  id: string
  label: string
  icon?: ReactNode
}

export function VuexyTabs({
  tabs,
  activeId,
  onChange,
  className,
}: {
  tabs: VuexyTab[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('vuexy-tabs', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn('vuexy-tab', activeId === tab.id && 'vuexy-tab-active')}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
