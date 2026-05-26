import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, FileText, ExternalLink, Loader } from 'lucide-react'
import { getMyPayslips, openMyPayslipPdf } from '@services/payslipService'
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

const schema = z.object({
  type: z.string().min(1, 'Select document type'),
  name: z.string().min(2, 'Document name required'),
  reason: z.string().min(5, 'Reason required'),
})

const columns = [
  { key: 'name', label: 'Document name' },
  { key: 'type', label: 'Type' },
  { key: 'reason', label: 'Reason' },
  { key: 'requestedDate', label: 'Requested' },
  { key: 'status', label: 'Status' },
  { key: 'rejection', label: 'Rejection reason' },
]

function mapRow(row) {
  const requested =
    typeof row.requestedAt === 'string'
      ? row.requestedAt.split('T')[0]
      : row.requestedAt
        ? new Date(row.requestedAt).toISOString().split('T')[0]
        : '—'
  return {
    id: row.id,
    type: row.documentType ?? '—',
    name: row.documentName ?? '—',
    reason: row.reason ?? '—',
    requestedDate: requested,
    status: row.status ?? 'Requested',
    rejection: row.status === 'Rejected' && row.rejectionReason ? row.rejectionReason : '—',
  }
}

export default function DocumentRequest() {
  const { toast } = useToast()
  const [requests, setRequests] = useState([])
  const [reqLoading, setReqLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [payslips, setPayslips] = useState([])
  const [payslipsLoading, setPayslipsLoading] = useState(true)

  const loadRequests = useCallback(async () => {
    setReqLoading(true)
    try {
      const data = await fetchMyDocumentRequests()
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      setRequests([])
      toast({
        title: 'Could not load requests',
        description: 'Pull to retry or contact HR if this continues.',
      })
    } finally {
      setReqLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  useEffect(() => {
    let cancelled = false
    setPayslipsLoading(true)
    getMyPayslips()
      .then((data) => {
        if (!cancelled) setPayslips(data)
      })
      .catch(() => {
        if (!cancelled) setPayslips([])
      })
      .finally(() => {
        if (!cancelled) setPayslipsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  })

  const filtered = requests.filter(
    (r) =>
      !search ||
      (r.documentName && r.documentName.toLowerCase().includes(search.toLowerCase())) ||
      (r.documentType && r.documentType.toLowerCase().includes(search.toLowerCase())) ||
      (r.reason && r.reason.toLowerCase().includes(search.toLowerCase())),
  )

  const approvedFromApi = requests.filter((r) => r.status === 'Approved')

  const tableData = filtered.map(mapRow)

  const onSubmit = async (data) => {
    try {
      await createDocumentRequest({
        documentType: data.type,
        documentName: data.name,
        reason: data.reason,
      })
      toast({
        title: 'Request submitted',
        description: `${data.name} is pending HR review.`,
      })
      reset()
      await loadRequests()
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
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4"
        >
          <h3 className="font-heading text-lg font-semibold">Request document</h3>
          <div>
            <Label>Document type *</Label>
            <Select value={watch('type')} onValueChange={(v) => setValue('type', v)}>
              <SelectTrigger className="mt-1">
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
            <Textarea className="mt-1" {...register('reason')} placeholder="Explain why HR should issue this" />
            {errors.reason && <p className="mt-1 text-xs text-danger">{errors.reason.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-heading font-semibold">Approved downloads</h3>
            <p className="mt-1 text-sm text-muted">Documents HR has finalized for you.</p>
            <div className="mt-4 space-y-3">
              {approvedFromApi.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
                  No approved documents yet.
                </p>
              ) : (
                approvedFromApi.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.documentName}</p>
                        <p className="text-xs text-muted">{doc.documentType}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 shrink-0"
                      onClick={() =>
                        void downloadMyDocumentPdf(doc.id, `${doc.documentName}.pdf`).catch(() =>
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">Payslips</h3>
          <p className="text-sm text-muted">Sent by HR to your dashboard</p>
        </div>
        {payslipsLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted">
            <Loader className="h-5 w-5 animate-spin" />
            Loading payslips…
          </div>
        ) : payslips.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No payslips yet. They will appear here after HR sends them from Payslip Management.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {payslips.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border p-4 hover:shadow-card-hover transition-shadow"
              >
                <p className="font-medium">{p.payMonth}</p>
                <p className="text-xs text-muted">Sent {new Date(p.sentAt).toLocaleDateString()}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => openMyPayslipPdf(p.id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-semibold">Your requests</h3>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name or type…"
            className="max-w-xs"
          />
        </div>
        {reqLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-16 text-muted">
            <Loader className="h-5 w-5 animate-spin" />
            Loading requests…
          </div>
        ) : (
          <DataTable columns={columns} data={tableData} statusKey="status" />
        )}
      </div>
    </div>
  )
}
