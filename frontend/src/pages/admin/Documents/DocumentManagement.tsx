import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, CheckCircle2, XCircle, FileText, Inbox, History, Sparkles } from 'lucide-react'
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
          <p className="text-sm font-medium text-[var(--emerald-dark)]/70">Loading documents...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-doc-empty flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 shadow-sm">
            <FileText className="h-6 w-6 text-[var(--emerald-dark)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--emerald-dark)]">No records in this view</p>
          <p className="mt-1 max-w-md text-xs font-medium text-slate-600">
            Requests appear here after employees submit from Document Request.
          </p>
        </div>
      ) : tab === 'requested' ? (
        <table className="admin-doc-table min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="text-[11px] font-semibold uppercase tracking-wide">
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Employee / ID</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Fulfillment file</th>
              <th className="min-w-[200px] px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="admin-doc-row border-b border-[rgba(38,107,28,0.08)]">
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
            <tr className="text-[11px] font-semibold uppercase tracking-wide">
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Employee / ID</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Processed</th>
              <th className="min-w-[120px] px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="admin-doc-row border-b border-[rgba(38,107,28,0.08)]">
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
                      void downloadDocumentPdf(row.id, `${row.documentName}.pdf`).catch(() =>
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
            <tr className="text-[11px] font-semibold uppercase tracking-wide">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rejection reason</th>
              <th className="px-4 py-3 text-right">Download</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="admin-doc-row border-b border-[rgba(38,107,28,0.08)]">
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
                        void downloadDocumentPdf(row.id, `${row.documentName}.pdf`).catch(() =>
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
    <div className={cn('crewiq-dashboard', !embedded && 'admin-documents-view')}>
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
          className="mt-1 min-h-[100px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[var(--emerald-dark)] focus:ring-2 focus:ring-[rgba(38,107,28,0.12)]"
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

      <div className={cn(!embedded && 'admin-documents-shell animate-fadeIn')}>
        {!embedded ? (
          <>
            <div className="admin-documents-hero">
              <div className="admin-documents-hero-top">
                <div className="min-w-0">
                  <h1 className="admin-documents-hero-title font-display">Document Requests</h1>
                  <p className="admin-documents-hero-sub">
                    Review, fulfill, and track employee document requests
                  </p>
                </div>
                <div className="admin-documents-tab-rail">
                  {tabConfig.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[11px] font-bold transition-all duration-200',
                        tab === t.key ? 'admin-dash-action-btn-sm text-white' : 'admin-documents-tab-inactive',
                      )}
                    >
                      <t.icon className="h-3 w-3 shrink-0" />
                      {t.label}
                      {tab === t.key && (
                        <span className="rounded-full bg-white/20 px-1 py-px text-[9px] font-black tabular-nums leading-none">
                          {total}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-documents-metrics-band">
                <div className="admin-documents-metric-glass">
                  <p className="admin-documents-metric-label">In This View</p>
                  <p className="admin-documents-metric-value font-display">{total}</p>
                </div>
                <div className="admin-documents-metric-glass">
                  <p className="admin-documents-metric-label">On This Page</p>
                  <p className="admin-documents-metric-value font-display">{items.length}</p>
                </div>
                {tab === 'requested' && (
                  <div className="admin-documents-metric-glass">
                    <p className="admin-documents-metric-label">Awaiting Upload</p>
                    <p className="admin-documents-metric-value font-display">{pendingUploadCount}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-documents-body-grid">
              <aside className="admin-documents-sidebar space-y-4">
                <p className="admin-documents-sidebar-title">{activeTabMeta.label}</p>
                <p className="text-xs font-medium leading-relaxed text-[var(--emerald-dark)]/80">
                  {activeTabMeta.description}
                </p>
                <div className="admin-documents-stat-box rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--emerald-dark)]/70">
                    Total records
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[var(--emerald-dark)]">
                    {loading ? '—' : total}
                  </p>
                </div>
                {tab === 'requested' && (
                  <div className="admin-documents-tip-box rounded-lg p-3 text-xs font-medium leading-relaxed">
                    <Sparkles className="mb-1.5 h-3.5 w-3.5 text-[var(--emerald-dark)]" />
                    Upload the fulfillment file first, then approve so the employee can download it.
                  </div>
                )}
              </aside>

              <div className="admin-documents-main-panel">
                <div className="admin-documents-panel-header">
                  <div>
                    <h2 className="font-display text-sm font-bold text-[var(--emerald-dark)]">
                      {activeTabMeta.label} Documents
                    </h2>
                    <p className="text-xs font-medium text-slate-600">
                      {loading
                        ? 'Loading...'
                        : total === 0
                          ? 'No records to display'
                          : `Showing page ${page} · ${total} total record${total === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>
                <div className="admin-doc-table-wrap overflow-auto">{tableShell}</div>
                {!loading && total > 0 ? (
                  <div className="admin-documents-pagination mt-3">
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
  return <PageWrapper className="relative z-10 py-3 font-body">{content}</PageWrapper>
}
