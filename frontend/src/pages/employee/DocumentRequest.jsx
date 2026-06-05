import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader,
  Receipt,
  CalendarDays,
} from 'lucide-react'
import { getMyPayslips } from '@services/payslipService'
import {
  createDocumentRequest,
  fetchMyDocumentRequests,
  downloadMyDocumentPdf,
} from '@services/documentRequestService'
import { DOCUMENT_REQUEST_TYPES } from '@constants/documentTypes'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/employee/ui/select'
import { DataTable } from '@components/employee/shared/DataTable'
import { SearchBar } from '@components/employee/shared/SearchBar'
import { useToast } from '@components/employee/shared/ToastProvider'
import { PayslipsSection } from '@components/employee/shared/PayslipsSection'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const POLL_INTERVAL_MS = 5000
const HISTORY_PAGE_SIZE = 10

const schema = z
  .object({
    type: z.string().min(1, 'Select document type'),
    otherDocumentType: z.string().optional(),
    name: z.string().min(2, 'Document name required'),
    reason: z.string().min(5, 'Reason required'),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'Other') {
      const details = (data.otherDocumentType || '').trim()
      if (details.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter the document type you need',
          path: ['otherDocumentType'],
        })
      }
    }
  })

function buildRequestColumns(onDownload, onDownloadError) {
  return [
    {
      key: 'requestedDate',
      label: 'Request date',
      render: (row) => (
        <div className="min-w-[6.5rem]">
          <span className="text-muted">{row.requestedDate}</span>
          {row.status === 'Rejected' && row.rejectionReason ? (
            <div className="mt-1.5 max-w-[200px] rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] leading-snug text-red-900">
              {row.rejectionReason}
            </div>
          ) : null}
        </div>
      ),
    },
    { key: 'type', label: 'Document type' },
    { key: 'name', label: 'Document name' },
    { key: 'status', label: 'Status' },
    { key: 'responseDetails', label: 'Admin response' },
    {
      key: 'actions',
      label: 'Download',
      render: (row) =>
        row.status === 'Approved' ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() =>
              void onDownload(row.id, `${row.name}.pdf`).catch(onDownloadError)
            }
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
  ]
}

const tabs = [
  { id: 'payslips', label: 'Payslip', icon: Receipt },
  { id: 'requests', label: 'Document Request', icon: FileText },
]

function getVisiblePageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
}

function formatDate(value) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

function mapRequestRow(row) {
  let responseDetails = 'Pending admin review'
  if (row.status === 'Approved') {
    responseDetails = row.processedAt
      ? `Approved on ${formatDate(row.processedAt)}${row.processedBy ? ` by ${row.processedBy}` : ''}`
      : 'Approved by admin'
  } else if (row.status === 'Rejected') {
    responseDetails = 'Rejected by admin'
  }

  return {
    id: row.id,
    type: row.documentType ?? '—',
    name: row.documentName ?? '—',
    requestedDate: formatDate(row.requestedAt),
    status: row.status ?? 'Requested',
    rejectionReason: row.rejectionReason ?? '',
    responseDetails,
  }
}

export default function DocumentRequest() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('payslips')
  const [requests, setRequests] = useState([])
  const [reqLoading, setReqLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [payslips, setPayslips] = useState([])
  const [payslipsLoading, setPayslipsLoading] = useState(true)

  const loadRequests = useCallback(async (silent = false) => {
    if (!silent) setReqLoading(true)
    try {
      const data = await fetchMyDocumentRequests()
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      if (!silent) {
        setRequests([])
        toast({
          title: 'Could not load requests',
          description: 'Pull to retry or contact admin if this continues.',
        })
      }
    } finally {
      if (!silent) setReqLoading(false)
    }
  }, [toast])

  const loadPayslips = useCallback(async (silent = false) => {
    if (!silent) setPayslipsLoading(true)
    try {
      const data = await getMyPayslips()
      setPayslips(Array.isArray(data) ? data : [])
    } catch {
      if (!silent) setPayslips([])
    } finally {
      if (!silent) setPayslipsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRequests()
    void loadPayslips()
  }, [loadRequests, loadPayslips])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'payslips' || tab === 'requests') {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    const interval = setInterval(() => {
      void loadRequests(true)
      void loadPayslips(true)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadRequests, loadPayslips])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadRequests(true)
        void loadPayslips(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [loadRequests, loadPayslips])

  useEffect(() => {
    if (activeTab === 'payslips') void loadPayslips(true)
    else void loadRequests(true)
  }, [activeTab, loadPayslips, loadRequests])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: '',
      otherDocumentType: '',
      name: '',
      reason: '',
    },
  })

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(
      (r) =>
        !search ||
        (r.documentName && r.documentName.toLowerCase().includes(search.toLowerCase())) ||
        (r.documentType && r.documentType.toLowerCase().includes(search.toLowerCase())) ||
        (r.reason && r.reason.toLowerCase().includes(search.toLowerCase())),
    )
    return filtered.sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
    )
  }, [requests, search])

  const approvedFromApi = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'Approved')
        .sort(
          (a, b) =>
            new Date(b.processedAt || b.requestedAt).getTime() -
            new Date(a.processedAt || a.requestedAt).getTime(),
        ),
    [requests],
  )

  const historyTotalPages = Math.max(1, Math.ceil(filteredRequests.length / HISTORY_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, historyTotalPages)
  const pagedRequests = filteredRequests.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE,
  )
  const tableData = pagedRequests.map(mapRequestRow)

  const requestColumns = useMemo(
    () =>
      buildRequestColumns(downloadMyDocumentPdf, () =>
        toast({
          title: 'Download failed',
          description: 'We could not open this file.',
        }),
      ),
    [toast],
  )

  useEffect(() => {
    setHistoryPage(1)
  }, [search])

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages)
    }
  }, [historyPage, historyTotalPages])

  const visiblePageNumbers = useMemo(
    () => getVisiblePageNumbers(safeHistoryPage, historyTotalPages),
    [safeHistoryPage, historyTotalPages],
  )

  const onSubmit = async (data) => {
    try {
      const documentType =
        data.type === 'Other'
          ? `Other: ${(data.otherDocumentType || '').trim()}`
          : data.type

      await createDocumentRequest({
        documentType,
        documentName: data.name,
        reason: data.reason,
      })
      toast({
        title: 'Request submitted',
        description: `${data.name} is pending admin review.`,
      })
      reset()
      await loadRequests()
      setHistoryPage(1)
    } catch (err) {
      const message = err?.response?.data?.error || 'Try again.'
      toast({
        title: 'Submission failed',
        description: message,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="employee-documents-tab-rail inline-flex w-full max-w-lg rounded-xl border p-1 sm:w-auto"
        role="tablist"
        aria-label="Documents sections"
      >
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'employee-documents-tab-btn flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 sm:flex-none sm:min-w-[10.5rem]',
                  activeTab === tab.id
                    ? 'employee-documents-tab-btn--active'
                    : 'employee-documents-tab-btn--inactive',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            )
          })}
      </div>

      <div className="transition-opacity duration-200">
        {activeTab === 'payslips' ? (
          <div key="payslips-panel" role="tabpanel" aria-label="Payslips">
            <PayslipsSection payslips={payslips} loading={payslipsLoading} />
          </div>
        ) : (
          <div
            key="requests-panel"
            role="tabpanel"
            aria-label="Document Requests"
            className="animate-in fade-in space-y-8 duration-200"
          >
            <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
              <InteractiveCard
                as="form"
                selectable={false}
                onSubmit={handleSubmit(onSubmit)}
                className={portalCardClass({ className: 'flex h-full flex-col space-y-4 p-6' })}
              >
                <div>
                  <h3 className="font-heading text-lg font-semibold">Request document</h3>
                  <p className="mt-1 text-sm text-muted">
                    Submit a new request for admin-issued documents such as certificates or letters.
                  </p>
                </div>
                <div>
                  <Label htmlFor="doc-request-type">Document type *</Label>
                  <Select
                    value={watch('type') || undefined}
                    onValueChange={(v) => {
                      setValue('type', v, { shouldValidate: true })
                      if (v !== 'Other') {
                        setValue('otherDocumentType', '', { shouldValidate: false })
                      }
                    }}
                  >
                    <SelectTrigger id="doc-request-type" className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_REQUEST_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type && <p className="mt-1 text-xs text-danger">{errors.type.message}</p>}
                </div>
                {watch('type') === 'Other' ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <Label htmlFor="doc-request-other-type">Specify document type *</Label>
                    <p className="mt-0.5 text-xs text-muted">
                      Describe what admin should prepare (for example bonafide letter, address proof letter).
                    </p>
                    <Input
                      id="doc-request-other-type"
                      className="mt-2"
                      {...register('otherDocumentType')}
                      placeholder="e.g. Bonafide certificate for visa"
                      autoComplete="off"
                    />
                    {errors.otherDocumentType ? (
                      <p className="mt-1 text-xs text-danger">{errors.otherDocumentType.message}</p>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <Label>Document name *</Label>
                  <Input
                    className="mt-1"
                    {...register('name')}
                    placeholder="e.g. Salary certificate 2026"
                  />
                  {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
                </div>
                <div>
                  <Label>Reason *</Label>
                  <Textarea
                    className="mt-1 min-h-[120px] resize-y"
                    {...register('reason')}
                    placeholder="Explain why admin should issue this"
                  />
                  {errors.reason && (
                    <p className="mt-1 text-xs text-danger">{errors.reason.message}</p>
                  )}
                </div>
                <div className="mt-auto pt-2">
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? 'Submitting…' : 'Submit request'}
                  </Button>
                </div>
              </InteractiveCard>

              <InteractiveCard selectable={false} className={portalCardClass({ className: 'flex h-full flex-col p-6' })}>
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-semibold">Approved downloads</h3>
                    <p className="mt-1 text-sm text-muted">Documents admin has finalized for you</p>
                  </div>
                </div>

                <div className="flex min-h-[280px] flex-1 flex-col">
                  {approvedFromApi.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-10 text-center">
                      <FileText className="mb-3 h-8 w-8 text-muted" />
                      <p className="text-sm font-medium text-foreground">No approved documents yet</p>
                      <p className="mt-1 max-w-xs text-xs text-muted">
                        Approved documents from admin will appear here for download.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                      {approvedFromApi.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/30 p-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <FileText className="h-5 w-5 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{doc.documentName}</p>
                              <p className="text-xs text-muted">
                                {doc.documentType}
                                {doc.processedAt ? ` · Approved ${formatDate(doc.processedAt)}` : ''}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 shrink-0"
                            onClick={() =>
                              void downloadMyDocumentPdf(doc.id, doc.documentName, doc.documentType).catch(
                                () =>
                                  toast({
                                    title: 'Download failed',
                                    description: 'We could not open this file.',
                                  }),
                              )
                            }
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </InteractiveCard>
            </div>

            <InteractiveCard className={portalCardClass({ className: 'p-6' })}>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-heading text-lg font-semibold">Request history</h3>
                    <p className="text-sm text-muted">
                      Track request dates, statuses, and admin responses
                    </p>
                  </div>
                </div>
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by name or type…"
                  className="max-w-xs"
                />
              </div>

              {reqLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted">
                  <Loader className="h-5 w-5 animate-spin" />
                  Loading requests…
                </div>
              ) : (
                <>
                  <DataTable columns={requestColumns} data={tableData} statusKey="status" />

                  {filteredRequests.length > 0 && (
                    <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted">
                        Showing{' '}
                        {(safeHistoryPage - 1) * HISTORY_PAGE_SIZE + 1}–
                        {Math.min(safeHistoryPage * HISTORY_PAGE_SIZE, filteredRequests.length)} of{' '}
                        {filteredRequests.length} records
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={safeHistoryPage <= 1}
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>

                        <div className="flex items-center gap-1">
                          {visiblePageNumbers.map((pageNum, index) => {
                            const prevPage = visiblePageNumbers[index - 1]
                            const showEllipsis = prevPage != null && pageNum - prevPage > 1
                            return (
                              <span key={pageNum} className="flex items-center gap-1">
                                {showEllipsis && (
                                  <span className="px-1 text-sm text-muted">…</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setHistoryPage(pageNum)}
                                  className={cn(
                                    'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
                                    pageNum === safeHistoryPage
                                      ? 'bg-primary text-white shadow-sm'
                                      : 'text-muted hover:bg-surface hover:text-foreground',
                                  )}
                                  aria-label={`Page ${pageNum}`}
                                  aria-current={pageNum === safeHistoryPage ? 'page' : undefined}
                                >
                                  {pageNum}
                                </button>
                              </span>
                            )
                          })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={safeHistoryPage >= historyTotalPages}
                          onClick={() =>
                            setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                          }
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </InteractiveCard>
          </div>
        )}
      </div>
    </div>
  )
}
