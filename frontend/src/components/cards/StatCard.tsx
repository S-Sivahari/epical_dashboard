import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  iconBg?: string
  iconColor?: string
  className?: string
}

export function StatCard({
  label,
  value,
  icon,
  iconBg = 'rgba(38, 107, 28, 0.12)',
  iconColor = '#266b1c',
  className,
}: StatCardProps) {
  return (
    <div className={cn('col-sm-6 col-lg-3', className)}>
      <div className="card card-sm">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col">
              <div className="subheader">{label}</div>
              <div className="h1 mb-0">{value}</div>
            </div>
            <div className="col-auto">
              <span
                className="avatar avatar-md rounded"
                style={{ backgroundColor: iconBg, color: iconColor }}
              >
                {icon}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StatCardRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('row row-deck row-cards', className)}>{children}</div>
}
