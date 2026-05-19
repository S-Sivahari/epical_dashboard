import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, FileText } from 'lucide-react'
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
import { Badge, statusVariant } from '@components/employee/ui/badge'
import { DataTable } from '@components/employee/shared/DataTable'
import { SearchBar } from '@components/employee/shared/SearchBar'
import { useAuthStore } from '@store/authStore'
import { useToast } from '@components/employee/shared/ToastProvider'
import {
  documentTypes,
  documentRequests,
  approvedDocuments,
  payslips,
} from '@pages/employee/data/mockData'

const schema = z.object({
  type: z.string().min(1, 'Select document type'),
  name: z.string().min(2, 'Document name required'),
  reason: z.string().min(5, 'Reason required'),
})

const columns = [
  { key: 'type', label: 'Document Type' },
  { key: 'reason', label: 'Reason' },
  { key: 'requestedDate', label: 'Requested Date' },
  { key: 'status', label: 'Status' },
]

export default function DocumentRequest() {
  const employee = useAuthStore((s) => s.user)
  const { toast } = useToast()
  const [requests, setRequests] = useState(documentRequests)
  const [search, setSearch] = useState('')

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
      r.type.toLowerCase().includes(search.toLowerCase()) ||
      r.reason.toLowerCase().includes(search.toLowerCase()),
  )

  const onSubmit = (data) => {
    setRequests((prev) => [
      {
        id: Date.now(),
        type: data.type,
        reason: data.reason,
        requestedDate: new Date().toISOString().split('T')[0],
        status: 'Pending',
      },
      ...prev,
    ])
    toast({ title: 'Request submitted', description: `${data.type} request is being processed.` })
    reset()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4"
        >
          <h3 className="font-heading text-lg font-semibold">Request Document</h3>
          <div>
            <Label>Document Type *</Label>
            <Select value={watch('type')} onValueChange={(v) => setValue('type', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className="mt-1 text-xs text-danger">{errors.type.message}</p>}
          </div>
          <div>
            <Label>Document Name *</Label>
            <Input
              className="mt-1"
              {...register('name')}
              placeholder="e.g. Salary Certificate 2026"
            />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div>
            <Label>Reason *</Label>
            <Textarea className="mt-1" {...register('reason')} />
            {errors.reason && <p className="mt-1 text-xs text-danger">{errors.reason.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            Submit Request
          </Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-heading font-semibold">Approved Documents</h3>
            <div className="mt-4 space-y-3">
              {approvedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted">{doc.date}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">Payslips</h3>
          <p className="text-sm text-muted">Employee ID: {employee?.id}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {payslips.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-border p-4 hover:shadow-card-hover transition-shadow"
            >
              <p className="font-medium">{p.month}</p>
              <p className="text-lg font-bold text-primary">{p.amount}</p>
              <Button size="sm" variant="outline" className="mt-3 w-full gap-1">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-semibold">All Requests</h3>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search requests..."
            className="max-w-xs"
          />
        </div>
        <DataTable columns={columns} data={filtered} statusKey="status" />
      </div>
    </div>
  )
}
