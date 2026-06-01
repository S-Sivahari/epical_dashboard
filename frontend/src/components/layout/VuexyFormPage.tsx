import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { VuexyPageShell } from '@components/layout/VuexyListPage'
import { VuexyTabs, type VuexyTab } from '@components/layout/VuexyTabs'

/** Vuexy account-settings / add form layout */
export function VuexyFormPage({
  title,
  subtitle,
  children,
  actions,
  className,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <VuexyPageShell className={className}>
      {(title || actions) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? (
              <h1 className="font-display text-xl font-semibold text-[#5e5873] sm:text-2xl">{title}</h1>
            ) : null}
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      <div className="vuexy-content-card">
        <div className="vuexy-tab-panel">{children}</div>
      </div>
    </VuexyPageShell>
  )
}

/** Vuexy settings page with horizontal tabs */
export function VuexySettingsPage({
  tabs,
  activeTab,
  onTabChange,
  children,
  title,
}: {
  tabs: VuexyTab[]
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
  title?: string
}) {
  return (
    <VuexyPageShell>
      {title ? (
        <h1 className="mb-5 font-display text-xl font-semibold text-[#5e5873] sm:text-2xl">{title}</h1>
      ) : null}
      <div className="vuexy-content-card">
        <VuexyTabs tabs={tabs} activeId={activeTab} onChange={onTabChange} />
        <div className="vuexy-tab-panel">{children}</div>
      </div>
    </VuexyPageShell>
  )
}

/** Vuexy analytics dashboard section card */
export function VuexyDashCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('vuexy-content-card', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title ? <h3 className="font-display text-base font-semibold text-[#5e5873]">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
