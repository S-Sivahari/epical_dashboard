import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, CheckCircle2, XCircle } from 'lucide-react'
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

export function DocumentManagement() {
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
      await uploadFulfillmentFile(id, file)
      toast.success('File attached to request')
      await load()
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
      toast.success('Request approved')
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
      toast.success('Request rejected')
      setRejectOpen(false)
      await load()
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Could not reject')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageWrapper>
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
      >
        <p className="mb-3 text-sm text-muted">
          The employee will not receive a document file. Explain why this request was declined.
        </p>
        <label className="block text-xs font-medium uppercase tracking-wide text-muted">
          Reason for rejection
        </label>
        <textarea
          className="mt-1 min-h-[100px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
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

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {(
          [
            ['requested', 'Requested'],
            ['approved', 'Approved'],
            ['history', 'History'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-emerald-50 text-emerald-900 ring-1 ring-primary/40'
                : 'text-muted hover:bg-surface',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className={cn('max-h-[min(560px,calc(100vh-240px))] overflow-auto')}>
          {loading ? (
            <p className="p-10 text-center text-sm text-muted">Loading...</p>
          ) : items.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">
              No records in this view. Requests appear after employees submit from Document Request.
            </p>
          ) : tab === 'requested' ? (
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] border-b border-border bg-surface/90 backdrop-blur">
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Employee / ID</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Fulfillment file</th>
                  <th className="min-w-[200px] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn('border-b border-border/70', i % 2 === 1 ? 'bg-surface/40' : 'bg-white')}
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-ink">{row.documentName}</p>
                      <p className="text-xs text-muted">{row.documentType}</p>
                      <p className="font-mono text-[11px] text-muted">{row.id}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p>{row.employeeName}</p>
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
                          className="w-full shrink-0 sm:w-auto"
                          onClick={() => startUploadPick(row.id)}
                        >
                          <Upload className="h-4 w-4" />
                          Upload file
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          disabled={!row.hasFulfillmentFile || busyId !== null}
                          className="w-full shrink-0 bg-emerald-700 hover:bg-emerald-800 sm:w-auto"
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
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] border-b border-border bg-surface/90 backdrop-blur">
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Employee / ID</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Processed</th>
                  <th className="min-w-[120px] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn('border-b border-border/70', i % 2 === 1 ? 'bg-surface/40' : 'bg-white')}
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold">{row.documentName}</p>
                      <p className="text-xs text-muted">{row.documentType}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p>{row.employeeName}</p>
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
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] border-b border-border bg-surface/90 backdrop-blur">
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rejection reason</th>
                  <th className="px-4 py-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn('border-b border-border/70', i % 2 === 1 ? 'bg-surface/40' : 'bg-white')}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatWhen(row.processedAt || row.requestedAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold">{row.documentName}</p>
                      <p className="text-xs text-muted">{row.documentType}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p>{row.employeeName}</p>
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
        </div>

        {!loading && total > 0 ? (
          <div className="border-t border-border bg-surface/40 px-4 py-3">
            <PaginationBar
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </div>
    </PageWrapper>
  )
}
