import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, CheckCircle2, XCircle, FileText, Inbox, History } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { PaginationBar } from '@components/tables/Pagination'
import type { DocumentRequestRecord } from '@/types'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/formatDate'
import {
  approveDocumentRequest,
  fetchAdminDocumentRequests,
  rejectDocumentRequest,
  uploadFulfillmentFile,
  downloadDocumentPdf,
} from '@services/documentRequestService'

type AdminTab = 'requested' | 'approved' | 'history'

const PAGE_SIZE = 10

const tabConfig: Array<{
  key: AdminTab
  label: string
  icon: typeof Inbox
  description: string
}> = [
  {
    key: 'requested',
    label: 'Requested',
    icon: Inbox,
    description: 'Review pending requests, attach fulfillment files, then approve or reject.',
  },
  {
    key: 'approved',
    label: 'Approved',
    icon: CheckCircle2,
    description: 'Download fulfilled documents that are ready for employees.',
  },
  {
    key: 'history',
    label: 'History',
    icon: History,
    description: 'Full audit trail of approved and rejected document requests.',
  },
]

function statusBadge(status: DocumentRequestRecord['status']) {
  if (status === 'Approved') return <Badge variant="success">Approved</Badge>
  if (status === 'Rejected') return <Badge variant="danger">Rejected</Badge>
  return <Badge variant="warning">Requested</Badge>
}

function formatWhen(iso?: string): string {
  if (!iso) return '—'
  try {
    return formatDateTime(iso)
  } catch {
    return iso
  }
}

export function DocumentManagement({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<AdminTab>('requested')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<DocumentRequestRecord[]>([])
  const [total, setTotal] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminDocumentRequests({
        page,
        limit: PAGE_SIZE,
        ...(tab === 'history'
          ? { mode: 'history' }
          : { status: tab === 'requested' ? 'Requested' : 'Approved' }),
      })
      setItems(res.items)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load documents')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [tab])

  const startUploadPick = (id: string) => {
    uploadTargetRef.current = id
    fileInputRef.current?.click()
  }

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const id = uploadTargetRef.current
    e.target.value = ''
    uploadTargetRef.current = null
    if (!file || !id) return

    setBusyId(id)
    try {
      const updated = await uploadFulfillmentFile(id, file)
// Update the item in state immediately
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, hasFulfillmentFile: updated.hasFulfillmentFile ?? true }
            : item
        )
      )
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Upload failed')
    } finally {
      setBusyId(null)
    }
  }

  const onApprove = async (id: string) => {
    setBusyId(id)
    try {
      await approveDocumentRequest(id)
await load()
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Could not approve')
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (id: string) => {
    setRejectId(id)
    setRejectReason('')
    setRejectOpen(true)
  }

  const submitReject = async () => {
    if (!rejectId) return
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error('Provide a rejection reason')
      return
    }
    if (reason.length > 500) {
      toast.error('Rejection reason must be under 500 characters')
      return
    }
    setBusyId(rejectId)
    try {
      await rejectDocumentRequest(rejectId, reason)
setRejectOpen(false)
      await load()
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Could not reject')
    } finally {
      setBusyId(null)
    }
  }

  const pendingUploadCount = items.filter((r) => !r.hasFulfillmentFile).length
  const activeTabMeta = tabConfig.find((t) => t.key === tab)!

  const tableShell = (
    <>
      {loading ? (
        <div className="admin-doc-loading flex min-h-[240px] items-center justify-center">
          <p className="text-sm font-medium admin-documents-text-brand-muted">Loading documents...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-doc-empty flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 shadow-sm">
            <FileText className="h-6 w-6 admin-documents-text-brand" />
          </div>
          <p className="text-sm font-semibold admin-documents-text-brand">No records in this view</p>
          <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-600">
            Requests appear here after employees submit from Document Request.
          </p>
        </div>
      ) : tab === 'requested' ? (
        <table className="admin-doc-table min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
              <th className="px-4 py-3 text-slate-900">Document</th>
              <th className="px-4 py-3 text-slate-900">Employee / ID</th>
              <th className="px-4 py-3 text-slate-900">Reason</th>
              <th className="px-4 py-3 text-slate-900">Requested</th>
              <th className="px-4 py-3 text-slate-900">Fulfillment file</th>
              <th className="min-w-[200px] px-4 py-3 text-right text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="admin-doc-row">
                <td className="px-4 py-3 align-top">
                  <p className="font-semibold text-ink">{row.documentName}</p>
                  <p className="text-xs text-muted">{row.documentType}</p>
                  <p className="font-mono text-[11px] text-muted">{row.id}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-ink">{row.employeeName}</p>
                  <p className="font-mono text-xs text-muted">{row.employeeId}</p>
                </td>
                <td className="max-w-[220px] px-4 py-3 align-top">
                  <p className="line-clamp-4 text-muted">{row.reason}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-middle text-muted">
                  {formatWhen(row.requestedAt)}
                </td>
                <td className="px-4 py-3 align-middle">
                  {row.hasFulfillmentFile ? (
                    <Badge variant="success">Attached</Badge>
                  ) : (
                    <Badge variant="neutral">Not uploaded</Badge>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      disabled={busyId === row.id}
                      loading={busyId === row.id}
                      className="admin-doc-secondary-btn w-full shrink-0 sm:w-auto"
                      onClick={() => startUploadPick(row.id)}
                    >
                      <Upload className="h-4 w-4" />
                      Upload file
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      disabled={!row.hasFulfillmentFile || busyId !== null}
                      className="admin-dash-action-btn w-full shrink-0 border-0 sm:w-auto"
                      onClick={() => void onApprove(row.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      type="button"
                      disabled={busyId !== null}
                      className="w-full shrink-0 sm:w-auto"
                      onClick={() => openReject(row.id)}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : tab === 'approved' ? (
        <table className="admin-doc-table min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
              <th className="px-4 py-3 text-slate-900">Document</th>
              <th className="px-4 py-3 text-slate-900">Employee / ID</th>
              <th className="px-4 py-3 text-slate-900">Reason</th>
              <th className="px-4 py-3 text-slate-900">Processed</th>
              <th className="min-w-[120px] px-4 py-3 text-right text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="admin-doc-row">
                <td className="px-4 py-3 align-top">
                  <p className="font-semibold text-ink">{row.documentName}</p>
                  <p className="text-xs text-muted">{row.documentType}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-ink">{row.employeeName}</p>
                  <p className="font-mono text-xs text-muted">{row.employeeId}</p>
                </td>
                <td className="max-w-[240px] px-4 py-3 align-top">
                  <p className="line-clamp-3 text-muted">{row.reason}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatWhen(row.processedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    className="admin-doc-secondary-btn"
                    onClick={() =>
                      void downloadDocumentPdf(row.id, row.documentName, row.documentType).catch(() =>
                        toast.error('Download failed'),
                      )
                    }
                  >
                    Download
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="admin-doc-table min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
              <th className="px-4 py-3 text-slate-900">When</th>
              <th className="px-4 py-3 text-slate-900">Document</th>
              <th className="px-4 py-3 text-slate-900">Employee</th>
              <th className="px-4 py-3 text-slate-900">Status</th>
              <th className="px-4 py-3 text-slate-900">Rejection reason</th>
              <th className="px-4 py-3 text-right text-slate-900">Download</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="admin-doc-row">
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {formatWhen(row.processedAt || row.requestedAt)}
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-semibold text-ink">{row.documentName}</p>
                  <p className="text-xs text-muted">{row.documentType}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-ink">{row.employeeName}</p>
                  <p className="font-mono text-xs text-muted">{row.employeeId}</p>
                </td>
                <td className="px-4 py-3 align-middle">{statusBadge(row.status)}</td>
                <td className="max-w-[260px] px-4 py-3 align-top text-sm">
                  {row.status === 'Rejected' ? (
                    <span className="text-danger">{row.rejectionReason || '—'}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.status === 'Approved' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      className="admin-doc-secondary-btn"
                      onClick={() =>
                        void downloadDocumentPdf(row.id, row.documentName, row.documentType).catch(() =>
                          toast.error('Download failed'),
                        )
                      }
                    >
                      Download
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )

  const content = (
    <div
      className={cn(
        'crewiq-dashboard relative',
        !embedded && 'admin-documents-view flex min-h-0 flex-1 flex-col',
      )}
    >
      {!embedded ? (
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,image/jpeg,image/png,.jpg,.jpeg"
        aria-hidden
        onChange={(e) => void onFilePicked(e)}
      />

      <Modal
        isOpen={rejectOpen}
        title="Reject request"
        onClose={() => {
          setRejectOpen(false)
          setRejectId(null)
        }}
        size="md"
        className="admin-modal"
      >
        <p className="mb-3 text-sm text-muted">
          The employee will not receive a document file. Explain why this request was declined.
        </p>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
          Reason for rejection
        </label>
        <textarea
          className="admin-documents-textarea mt-2 min-h-[6.5rem] w-full rounded-lg border px-3 py-2.5 text-sm text-ink shadow-sm outline-none"
          value={rejectReason}
          onChange={(ev) => setRejectReason(ev.target.value)}
          placeholder="e.g. Missing tax year information..."
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => setRejectOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={!rejectReason.trim()}
            loading={busyId !== null && rejectId !== null && busyId === rejectId && rejectOpen}
            onClick={() => void submitReject()}
          >
            Reject request
          </Button>
        </div>
      </Modal>

      <div
        className={cn(
          !embedded && 'admin-documents-shell relative z-10 flex min-h-0 flex-1 animate-fadeIn flex-col',
        )}
      >
        {!embedded ? (
          <>
            <header className="admin-documents-hub-header">
              <div className="admin-documents-hero-top">
                <div className="min-w-0">
                  <h1 className="admin-documents-hero-title font-display">Document Requests Hub</h1>
                </div>
                <nav className="admin-documents-tab-rail" aria-label="Document request views">
                  {tabConfig.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={
                        tab === t.key
                          ? 'admin-documents-tab-btn admin-documents-tab-btn--active'
                          : 'admin-documents-tab-btn admin-documents-tab-btn--inactive'
                      }
                    >
                      <t.icon className="admin-documents-tab-icon shrink-0" aria-hidden />
                      <span className="admin-documents-tab-label">{t.label}</span>
                      <span className="admin-documents-tab-count tabular-nums">
                        {tab === t.key ? total : '—'}
                      </span>
                    </button>
                  ))}
                </nav>
              </div>
              <div className="admin-documents-metrics-band" role="group" aria-label="Document metrics">
                <div className="admin-documents-metric-tile">
                  <p className="admin-documents-metric-label">In This View</p>
                  <p className="admin-documents-metric-value font-display">{total}</p>
                </div>
                <div className="admin-documents-metric-tile">
                  <p className="admin-documents-metric-label">On This Page</p>
                  <p className="admin-documents-metric-value font-display">{items.length}</p>
                </div>
                {tab === 'requested' ? (
                  <div className="admin-documents-metric-tile">
                    <p className="admin-documents-metric-label">Awaiting Upload</p>
                    <p className="admin-documents-metric-value font-display">{pendingUploadCount}</p>
                  </div>
                ) : (
                  <div className="admin-documents-metric-tile admin-documents-metric-tile--muted" aria-hidden>
                    <p className="admin-documents-metric-label">Awaiting Upload</p>
                    <p className="admin-documents-metric-value font-display">—</p>
                  </div>
                )}
              </div>
            </header>

            <div className="admin-documents-body-grid admin-documents-body-grid--fill">
              <aside className="admin-documents-sidebar">
                <p className="admin-documents-sidebar-title">{activeTabMeta.label}</p>
                <p className="admin-documents-sidebar-desc">{activeTabMeta.description}</p>
                <div className="admin-documents-stat-box">
                  <p className="admin-documents-stat-label">Total records</p>
                  <p className="admin-documents-stat-value font-display tabular-nums">
                    {loading ? '—' : total}
                  </p>
                </div>
              </aside>

              <div className="admin-documents-main-panel">
                <div className="admin-documents-panel-header">
                  <div>
                    <h2 className="admin-documents-panel-title font-display">
                      {activeTabMeta.label} Documents
                    </h2>
                    <p className="admin-documents-panel-sub">
                      {loading
                        ? 'Loading...'
                        : total === 0
                          ? 'No records to display'
                          : `Showing page ${page} · ${total} total record${total === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>
                <div className="admin-doc-table-wrap">{tableShell}</div>
                {!loading && total > 0 ? (
                  <div className="admin-documents-pagination">
                    <PaginationBar total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
              {tabConfig.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    tab === t.key
                      ? 'bg-emerald-50 text-emerald-900 ring-1 ring-primary/40'
                      : 'text-muted hover:bg-surface',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="max-h-[min(560px,calc(100vh-240px))] overflow-auto">{tableShell}</div>
              {!loading && total > 0 ? (
                <div className="border-t border-border bg-surface/40 px-4 py-3">
                  <PaginationBar total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )

  if (embedded) return content
  return (
    <PageWrapper fillViewport scrollable className="admin-hub-page-wrap relative z-10 !py-3 font-body">
      {content}
    </PageWrapper>
  )
}
