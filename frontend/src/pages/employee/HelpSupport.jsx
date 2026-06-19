import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Ticket, History, ChevronLeft, ChevronRight, Loader } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { DataTable } from '@components/employee/shared/DataTable'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'
import { useTicketStore } from '@store/ticketStore'
import { formatDateTime } from '@/utils/formatDate'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { useFormSessionDraft } from '@hooks/useFormSessionDraft'

const PAGE_SIZE = 6
const POLL_MS = 30000
const CARD_CLASS = portalCardClass({ className: 'p-5 sm:p-6' })

const ticketSchema = z.object({
  title: z.string().min(3, 'Title required'),
  description: z.string(),
  priority: z.string().min(1, 'Select priority'),
})

const columns = [
  {
    key: 'title',
    label: 'Title',
    render: (row) => (
      <span className="block max-w-[8rem] truncate font-medium text-foreground sm:max-w-[10rem]" title={row.title}>
        {row.title}
      </span>
    ),
  },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'timestamp', label: 'Submitted' },
  {
    key: 'remarks',
    label: 'Remarks',
    render: (row) => (
      <span className="block max-w-[7rem] truncate sm:max-w-[9rem]" title={row.remarksFull || row.remarks}>
        {row.remarks}
      </span>
    ),
  },
]

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-4 border-b border-border pb-4">
      <div className="flex items-start gap-3">
        <div className="emp-dash-icon emp-dash-icon--sky" aria-hidden>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
      </div>
    </div>
  )
}

function formatAdminRemarks(comments) {
  if (!comments?.length) return '—'
  const adminComments = comments.filter((c) => c.authorRole === 'Admin')
  if (!adminComments.length) return '—'
  return adminComments.map((c) => c.text).join(' · ')
}

function formatTimestamp(raw) {
  if (!raw) return '—'
  try {
    return formatDateTime(typeof raw === 'string' ? raw : String(raw))
  } catch {
    return String(raw)
  }
}

export default function RaiseTickets() {
  const user = useAuthStore((s) => s.user)
  const tickets = useTicketStore((s) => s.tickets)
  const loading = useTicketStore((s) => s.loading)
  const initialized = useTicketStore((s) => s.initialized)
  const fetchTickets = useTicketStore((s) => s.fetchTickets)
  const fetchTicketsSilent = useTicketStore((s) => s.fetchTicketsSilent)
  const createTicket = useTicketStore((s) => s.createTicket)

  const [page, setPage] = useState(1)
  const { toast } = useToast()

  const ticketFormDefaults = { title: '', description: '', priority: '' }

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: ticketFormDefaults,
  })

  const { clearDraft } = useFormSessionDraft('employee-ticket-raise', { reset, watch }, {
    defaultValues: ticketFormDefaults,
  })

  useEffect(() => {
    if (!user) return
    void fetchTickets().catch(() => {
      toast({ title: 'Failed to load tickets', description: 'Please refresh the page.', variant: 'destructive' })
    })
  }, [user, fetchTickets])

  const ticketsLoading = !initialized || loading

  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      void fetchTicketsSilent()
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [user, fetchTicketsSilent])

  const displayTickets = useMemo(
    () =>
      tickets.map((t) => {
        const remarksFull = formatAdminRemarks(t.comments)
        const remarks =
          remarksFull === '—' ? '—' : remarksFull.length > 60 ? `${remarksFull.slice(0, 60)}…` : remarksFull
        return {
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          timestamp: formatTimestamp(t.createdAt),
          remarks,
          remarksFull,
        }
      }),
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
      clearDraft()
      reset(ticketFormDefaults)
      setPage(1)
    } catch (error) {
      const message = error?.response?.data?.error || 'Could not submit your ticket. Please try again.'
      toast({ title: 'Failed to create ticket', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="max-w-full space-y-5 overflow-x-hidden" data-employee-tickets>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <InteractiveCard
          as="form"
          selectable={false}
          onSubmit={handleSubmit(onSubmit)}
          className={cn(CARD_CLASS, 'flex h-full flex-col')}
        >
          <SectionHeader
            icon={Ticket}
            title="Raise a ticket"
            description="Submit IT or workplace issues for the admin team"
          />
          <div className="flex flex-1 flex-col space-y-3">
            <div>
              <Label>Issue title *</Label>
              <Input className="mt-1" placeholder="Brief summary of the issue" {...register('title')} />
              {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                className="mt-1 min-h-[88px] resize-y"
                rows={3}
                placeholder="Describe the issue in detail"
                {...register('description')}
              />
              {errors.description && <p className="mt-1 text-xs text-danger">{errors.description.message}</p>}
            </div>
            <div>
              <Label>Priority *</Label>
              <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {['Low', 'Medium', 'High', 'Critical'].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.priority && <p className="mt-1 text-xs text-danger">{errors.priority.message}</p>}
            </div>
            <div className="mt-auto pt-1">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="emp-dash-btn emp-dash-btn--wide emp-portal-submit-btn w-full"
              >
                <span className="emp-dash-btn__label">
                  {isSubmitting ? 'Submitting…' : 'Submit ticket'}
                </span>
              </Button>
            </div>
          </div>
        </InteractiveCard>

        <InteractiveCard className={cn(CARD_CLASS, 'flex h-full min-h-0 flex-col')}>
          <SectionHeader
            icon={History}
            title="Ticket history"
            description="Status updates and remarks from the support team"
          />

          <div className="flex min-h-0 flex-1 flex-col">
            {ticketsLoading && displayTickets.length === 0 ? (
              <div className="flex flex-1 items-center justify-center gap-2 py-12 text-sm text-muted">
                <Loader className="h-5 w-5 animate-spin text-primary" />
                Loading tickets…
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1">
                  <DataTable
                    columns={columns}
                    data={pagedTickets}
                    statusKey="status"
                    compact
                    emptyMessage="No tickets yet. Submit your first request using the form."
                  />
                </div>

                {displayTickets.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <p className="text-xs text-muted">
                      {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, displayTickets.length)} of{' '}
                      {displayTickets.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs"
                        disabled={currentPage === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                      </Button>
                      <span className="min-w-[4.5rem] text-center text-xs font-medium text-foreground">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </InteractiveCard>
      </div>
    </div>
  )
}
