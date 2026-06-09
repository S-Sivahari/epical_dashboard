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
    <InteractiveCard to={DOCUMENTS_PATH} className={cn(cardClass, className)}>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="emp-dash-icon emp-dash-icon--amber h-7 w-7" aria-hidden>
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-sm font-semibold text-foreground">Document requests</h3>
            <p className="mt-0.5 text-[11px] text-muted">
              {pending.length > 0
                ? `${pending.length} pending admin review`
                : 'Request certificates and letters'}
            </p>
          </div>
        </div>
        <Link
          to={DOCUMENTS_PATH}
          className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
        >
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className={cn(fill && 'emp-dash-widget-body min-h-0 flex-1')}>
        {pending.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-muted">No pending document requests</p>
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
