import type { ReactNode } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { StatCard, StatCardRow, type StatCardProps } from '@components/cards/StatCard'
import { ListPageCard } from '@components/tables/ListPageCard'
import { VuexyPagination } from '@components/tables/VuexyPagination'
import { cn } from '@/utils/cn'

export { StatCard, StatCardRow, type StatCardProps }

export function VuexyPageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('crewiq-dashboard admin-dashboard-view empwr-list-page', className)}>
      <PageWrapper>{children}</PageWrapper>
    </div>
  )
}

export function VuexyListPage({
  stats,
  toolbar,
  children,
  pagination,
  className,
  footerExtra,
}: {
  stats?: StatCardProps[]
  toolbar?: ReactNode
  children: ReactNode
  pagination?: {
    total: number
    page: number
    pageSize: number
    onPageChange: (p: number) => void
  }
  footerExtra?: ReactNode
  className?: string
}) {
  return (
    <VuexyPageShell className={className}>
      {stats && stats.length > 0 ? (
        <StatCardRow className="mb-5">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </StatCardRow>
      ) : null}
      <ListPageCard
        toolbar={toolbar}
        footer={
          pagination || footerExtra ? (
            <>
              {pagination ? (
                <VuexyPagination
                  total={pagination.total}
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  onPageChange={pagination.onPageChange}
                />
              ) : null}
              {footerExtra}
            </>
          ) : undefined
        }
      >
        {children}
      </ListPageCard>
    </VuexyPageShell>
  )
}

/** Toolbar helpers matching Vuexy invoice/user list */
export function VuexyShowSelect({
  value,
  options = [10, 25, 50, 100],
  onChange,
  disabled,
}: {
  value: number
  options?: number[]
  onChange?: (n: number) => void
  disabled?: boolean
}) {
  return (
    <div className="vuexy-show-select">
      <span>Show</span>
      <select
        value={value}
        disabled={disabled || !onChange}
        onChange={(e) => onChange?.(Number(e.target.value))}
        aria-label="Rows per page"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  )
}

export function VuexyToolbarSearch({
  value,
  onChange,
  placeholder = 'Search',
  onClear,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onClear?: () => void
}) {
  return (
    <div className="vuexy-toolbar-search">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && onClear ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-primary"
          onClick={onClear}
          aria-label="Clear search"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

export function VuexyToolbarFilter({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label?: string
  className?: string
}) {
  return (
    <div className={cn('vuexy-toolbar-filter relative', className)}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}

export function VuexyTableActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('vuexy-table-actions', className)}>{children}</div>
}

export function VuexyTableActionBtn({
  children,
  onClick,
  title,
  asChild,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
  asChild?: boolean
  className?: string
}) {
  if (asChild) {
    return <span className={cn('vuexy-table-action-btn', className)}>{children}</span>
  }
  return (
    <button type="button" className={cn('vuexy-table-action-btn', className)} onClick={onClick} title={title}>
      {children}
    </button>
  )
}
