import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const DOCUMENTS_PATH = '/employee/documents?tab=requests'

function DocumentRequestRow({ document }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-white/80 px-2.5 py-1.5 text-xs">
      <span className="min-w-0 truncate font-medium text-foreground">
        {document.documentName ?? 'Document request'}
      </span>
      <span className="shrink-0 text-[10px] text-muted">{document.documentType ?? '—'}</span>
    </li>
  )
}

export function DashboardDocumentRequests({ documents = [], className, compact = false, fill = false }) {
  const pending = useMemo(
    () => (Array.isArray(documents) ? documents : []).filter((doc) => doc.status === 'Requested'),
    [documents],
  )

  const cardClass = compact
    ? portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-3' })
    : portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5' })

  return (
    <InteractiveCard to={DOCUMENTS_PATH} className={cn(cardClass, 'emp-dash-card emp-dash-card--amber', className)}>
      <div className="emp-dash-bottom-widget-header">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <div className="emp-dash-icon emp-dash-icon--amber h-7 w-7 shrink-0" aria-hidden>
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <h3 className="font-heading font-semibold text-foreground truncate">Document requests</h3>
            {pending.length > 0 ? (
              <p className="mt-0.5 text-[11px] text-muted truncate">
                {pending.length} pending admin review
              </p>
            ) : null}
          </div>
        </div>
        <Link
          to={DOCUMENTS_PATH}
          className="emp-dash-btn emp-dash-btn--sm inline-flex shrink-0 items-center gap-0.5"
        >
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className={cn('flex min-h-0 flex-col', fill && 'emp-dash-widget-body flex-1')}>
        {pending.length === 0 ? (
          <div className="emp-dash-bottom-widget-empty">
            <p className="text-sm text-muted">No pending document requests</p>
          </div>
        ) : (
          <ul
            className={cn(
              'space-y-1.5 pr-0.5',
              fill ? 'min-h-0' : 'max-h-32 overflow-y-auto overscroll-contain',
            )}
          >
            {pending.map((document) => (
              <DocumentRequestRow key={document.id ?? document.documentName} document={document} />
            ))}
          </ul>
        )}
      </div>
    </InteractiveCard>
  )
}
