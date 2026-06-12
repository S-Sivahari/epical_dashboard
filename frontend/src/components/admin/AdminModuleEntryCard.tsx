import { ArrowRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

type AdminModuleEntryCardProps = {
  to: string
  title: string
  description: string
  icon: LucideIcon
  tone?: 'blue' | 'violet' | 'emerald' | 'slate'
  size?: 'default' | 'compact'
  openInNewTab?: boolean
}

export function AdminModuleEntryCard({
  to,
  title,
  description,
  icon: Icon,
  tone = 'blue',
  size = 'default',
  openInNewTab = false,
}: AdminModuleEntryCardProps) {
  const className = cn(
    'admin-module-entry-card',
    `admin-module-entry-card--tone-${tone}`,
    size === 'compact' && 'admin-module-entry-card--compact',
  )

  const content = (
    <>
      <span className="admin-module-entry-card__icon" aria-hidden>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="admin-module-entry-card__body">
        <span className="admin-module-entry-card__title">{title}</span>
        <span className="admin-module-entry-card__description">{description}</span>
      </span>
      <ArrowRight className="admin-module-entry-card__arrow h-4 w-4 shrink-0" aria-hidden />
    </>
  )

  if (openInNewTab) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={`${title}. ${description}. Opens in a new tab`}
      >
        {content}
      </a>
    )
  }

  return (
    <Link to={to} className={className} aria-label={`${title}. ${description}`}>
      {content}
    </Link>
  )
}
