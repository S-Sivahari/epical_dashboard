import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Phone, BookOpen, ChevronDown } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { DataTable } from '@components/employee/shared/DataTable'
import { faqs } from '@pages/employee/data/mockData'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'
import { useTicketStore } from '@store/ticketStore'
import { formatDateTime } from '@/utils/formatDate'

const PAGE_SIZE = 8
const POLL_MS = 30000

const ticketSchema = z.object({
  title: z.string().min(3, 'Title required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.string().min(1, 'Select priority'),
})

const columns = [
  { key: 'title', label: 'Title' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'timestamp', label: 'Submitted' },
  { key: 'remarks', label: 'Admin Remarks' },
]

function formatAdminRemarks(comments) {
  if (!comments?.length) return '—'
  const adminComments = comments.filter((c) => c.authorRole === 'Admin')
  if (!adminComments.length) return '—'
  const text = adminComments.map((c) => c.text).join(' · ')
  return text.length > 100 ? `${text.slice(0, 100)}…` : text
}

function formatTimestamp(raw) {
  if (!raw) return '—'
  try {
    return formatDateTime(typeof raw === 'string' ? raw : String(raw))
  } catch {
    return String(raw)
  }
}

export default function HelpSupport() {
  const user = useAuthStore((s) => s.user)
  const tickets = useTicketStore((s) => s.tickets)
  const loading = useTicketStore((s) => s.loading)
  const fetchTickets = useTicketStore((s) => s.fetchTickets)
  const fetchTicketsSilent = useTicketStore((s) => s.fetchTicketsSilent)
  const createTicket = useTicketStore((s) => s.createTicket)

  const [openFaq, setOpenFaq] = useState(null)
  const [page, setPage] = useState(1)
  const { toast } = useToast()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(ticketSchema),
  })

  useEffect(() => {
    if (!user) return
    void fetchTickets().catch(() => {
      toast({ title: 'Failed to load tickets', description: 'Please refresh the page.', variant: 'destructive' })
    })
  }, [user, fetchTickets, toast])

  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      void fetchTicketsSilent()
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [user, fetchTicketsSilent])

  const displayTickets = useMemo(
    () =>
      tickets.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        timestamp: formatTimestamp(t.createdAt),
        remarks: formatAdminRemarks(t.comments),
      })),
    [tickets],
  )

  const totalPages = Math.max(1, Math.ceil(displayTickets.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedTickets = displayTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const onSubmit = async (data) => {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please log in to raise a ticket.', variant: 'destructive' })
      return
    }

    try {
      await createTicket({
        employeeId: user.id,
        employeeName: user.name,
        title: data.title,
        description: data.description,
        priority: data.priority,
      })
      toast({ title: 'Ticket created', description: 'Support team will respond within 24 hours.' })
      reset()
      setPage(1)
    } catch (error) {
      const message = error?.response?.data?.error || 'Could not submit your ticket. Please try again.'
      toast({ title: 'Failed to create ticket', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h3 className="font-heading text-lg font-semibold">Raise a Ticket</h3>
          <div>
            <Label>Issue Title *</Label>
            <Input className="mt-1" {...register('title')} />
            {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
          </div>
          <div>
            <Label>Description *</Label>
            <Textarea className="mt-1" {...register('description')} />
            {errors.description && <p className="mt-1 text-xs text-danger">{errors.description.message}</p>}
          </div>
          <div>
            <Label>Priority *</Label>
            <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select priority" /></SelectTrigger>
              <SelectContent>
                {['Low', 'Medium', 'High', 'Critical'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.priority && <p className="mt-1 text-xs text-danger">{errors.priority.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit Ticket'}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-heading font-semibold">Contact Support</h3>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex items-center gap-2 text-muted"><Mail className="h-4 w-4 text-primary" /> support@epical.com</p>
              <p className="flex items-center gap-2 text-muted"><Phone className="h-4 w-4 text-primary" /> +1 (800) 555-0199</p>
            </div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <BookOpen className="h-8 w-8 text-primary" />
            <h4 className="mt-3 font-heading font-semibold">User Guide</h4>
            <p className="mt-1 text-sm text-muted">Browse documentation for all portal features.</p>
            <Button variant="outline" size="sm" className="mt-3">View Guide</Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-heading text-lg font-semibold">Ticket History</h3>
        <p className="mt-1 text-sm text-muted">All tickets you have raised, including status updates from the support team.</p>

        {loading && displayTickets.length === 0 ? (
          <div className="mt-6 flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="mt-4">
              <DataTable columns={columns} data={pagedTickets} statusKey="status" />
            </div>
            {displayTickets.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, displayTickets.length)} of {displayTickets.length} tickets
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-medium">
                    Page {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-heading text-lg font-semibold">FAQ</h3>
        <div className="mt-4 space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between p-4 text-left font-medium"
              >
                {faq.q}
                <ChevronDown className={`h-4 w-4 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && <p className="border-t border-border px-4 pb-4 text-sm text-muted">{faq.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
