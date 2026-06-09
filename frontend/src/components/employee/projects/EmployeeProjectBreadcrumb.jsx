import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'

export function EmployeeProjectBreadcrumb({ items = [], className }) {
  if (!items.length) return null

  return (
    <nav className={cn('emp-wf-breadcrumb', className)} aria-label="Breadcrumb">
      <ol className="emp-wf-breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="emp-wf-breadcrumb-item">
              {index > 0 ? <ChevronRight className="emp-wf-breadcrumb-sep h-3.5 w-3.5" aria-hidden /> : null}
              {item.to && !isLast ? (
                <Link to={item.to} className="emp-wf-breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                <span className={cn('emp-wf-breadcrumb-current', isLast && 'is-last')}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
