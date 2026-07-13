import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import {
  Eye,
  Ticket as TicketIcon,
  Clock,
  Loader2,
  CheckCircle2,
  X,
  Search,
  Trash2,
} from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import {
  TicketDetailModal,
} from '@pages/admin/Tickets/TicketDetailModal'
import type { Ticket, TicketStatus } from '@/types'
import { cn } from '@/utils/cn'
import { useTicketStore } from '@store/ticketStore'
import { deleteTicket, fetchTicketById, getNextStatus, getPrevStatus } from '@services/ticketService'
import { formatDateTime } from '@/utils/formatDate'

const BOARD_STATUSES = ['Pending', 'In Progress', 'Completed'] as const

const COLUMN_META: Record<
  TicketStatus,
  {
    label: string
    icon: typeof Clock
    column: string
    header: string
    iconBox: string
    count: string
    empty: string
  }
> = {
  Pending: {
    label: 'Pending',
    icon: Clock,
    column: 'bg-red-50/95 ring-1 ring-red-200/70',
    header: 'border-b border-red-200/60 bg-red-50/80',
    iconBox: 'bg-red-100 text-red-700 ring-red-300/40',
    count: 'bg-white/90 text-red-800 ring-red-200/80',
    empty: 'border-red-200/70 bg-red-50/50',
  },
  'In Progress': {
    label: 'In Progress',
    icon: Loader2,
    column: 'bg-emerald-50/95 ring-1 ring-emerald-200/70',
    header: 'border-b border-emerald-200/60 bg-emerald-50/80',
    iconBox: 'bg-emerald-100 text-emerald-700 ring-emerald-300/40',
    count: 'bg-white/90 text-emerald-800 ring-emerald-200/80',
    empty: 'border-emerald-200/70 bg-emerald-50/50',
  },
  Completed: {
    label: 'Completed',
    icon: CheckCircle2,
    column: 'bg-teal-50/95 ring-1 ring-teal-200/70',
    header: 'border-b border-teal-200/60 bg-teal-50/80',
    iconBox: 'bg-teal-100 text-teal-700 ring-teal-300/40',
    count: 'bg-white/90 text-teal-800 ring-teal-200/80',
    empty: 'border-teal-200/70 bg-teal-50/50',
  },
}

function formatCreatedAt(raw: Ticket['createdAt']): string {
  if (!raw) return '—'
  try {
    return formatDateTime(typeof raw === 'string' ? raw : String(raw))
  } catch {
    return String(raw)
  }
}

function priorityPillClass(priority: string): string {
  switch (priority) {
    case 'Critical':
      return 'bg-red-100 text-red-800 ring-red-200/70'
    case 'High':
      return 'bg-rose-100 text-rose-800 ring-rose-200/70'
    case 'Medium':
      return 'bg-amber-100 text-amber-800 ring-amber-200/70'
    case 'Low':
      return 'bg-sky-100 text-sky-800 ring-sky-200/70'
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200/70'
  }
}

const filterFieldClass = 'admin-tickets-filter-input'

export function TicketManagement() {
  const tickets = useTicketStore((s) => s.tickets)
  const loading = useTicketStore((s) => s.loading)
  const initialized = useTicketStore((s) => s.initialized)
  const fetchTickets = useTicketStore((s) => s.fetchTickets)
  const fetchTicketsSilent = useTicketStore((s) => s.fetchTicketsSilent)
  const updateStatus = useTicketStore((s) => s.updateStatus)
  const removeTicket = useTicketStore((s) => s.removeTicket)

  const [q, setQ] = useState('')
  const [employeeIdFilter, setEmployeeIdFilter] = useState('')
  const [priority, setPriority] = useState('all')
  const [moving, setMoving] = useState<{ id: string; dir: 'forward' | 'back' } | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null)
  const [deleting, setDeleting] = useState(false)
  const ticketsLoading = !initialized || loading

  useEffect(() => {
    void fetchTickets({
      q: q.trim() || undefined,
      priority: priority === 'all' ? undefined : priority,
    }).catch(() => toast.error('Failed to load tickets'))
  }, [fetchTickets, q, priority])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchTicketsSilent({
        q: q.trim() || undefined,
        priority: priority === 'all' ? undefined : priority,
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchTicketsSilent, q, priority])

  useEffect(() => {
    if (!detailOpen || !selectedId) {
      setDetailTicket(null)
      return
    }
    let cancelled = false
    void fetchTicketById(selectedId)
      .then((full) => {
        if (!cancelled) setDetailTicket(full)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load ticket details')
      })
    return () => {
      cancelled = true
    }
  }, [detailOpen, selectedId])

  const narrowed = useMemo(() => {
    const empNeedle = employeeIdFilter.trim().toLowerCase()
    return tickets.filter((t) => {
      if (empNeedle && !t.employeeId.toLowerCase().includes(empNeedle)) return false
      return true
    })
  }, [tickets, employeeIdFilter])

  const columns = useMemo(() => {
    return {
      Pending: narrowed.filter((t) => t.status === 'Pending'),
      'In Progress': narrowed.filter((t) => t.status === 'In Progress'),
      Completed: narrowed.filter((t) => t.status === 'Completed'),
    } as Record<TicketStatus, Ticket[]>
  }, [narrowed])

  const statusCounts = useMemo(
    () => ({
      Pending: tickets.filter((t) => t.status === 'Pending').length,
      'In Progress': tickets.filter((t) => t.status === 'In Progress').length,
      Completed: tickets.filter((t) => t.status === 'Completed').length,
    }),
    [tickets],
  )

  const hasActiveFilters = !!(q || employeeIdFilter || priority !== 'all')

  const isMoveForward = (id: string) => moving?.id === id && moving?.dir === 'forward'
  const isMoveBack = (id: string) => moving?.id === id && moving?.dir === 'back'

  const move = useCallback(
    async (id: string, direction: 'forward' | 'back') => {
      const t = tickets.find((x) => x.id === id)
      if (!t) return
      const next = direction === 'forward' ? getNextStatus(t.status) : getPrevStatus(t.status)
      if (!next) return
      setMoving({ id, dir: direction })
      try {
        await updateStatus(id, next)
        // Store already upserts; refresh list in background for active filters.
        void fetchTickets({
          q: q.trim() || undefined,
          priority: priority === 'all' ? undefined : priority,
        }).catch(() => {})
      } catch (error: unknown) {
        const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        toast.error(message || 'Failed to update ticket')
      } finally {
        setMoving(null)
      }
    },
    [tickets, updateStatus, fetchTickets, q, priority],
  )

  const openDetail = useCallback((id: string) => {
    setSelectedId(id)
    setDetailOpen(true)
  }, [])

  const closeDetail = useCallback(() => {
    setDetailOpen(false)
    setSelectedId(null)
    setDetailTicket(null)
  }, [])

  const handleModalUpdateStatus = useCallback(
    async (id: string, status: TicketStatus, remark?: string) => {
      setMoving({ id, dir: 'forward' })
      try {
        await updateStatus(id, status, remark)
        // Detail may need full ticket (comments/attachments); list already upserted.
        const full = await fetchTicketById(id)
        setDetailTicket(full)
        void fetchTickets({
          q: q.trim() || undefined,
          priority: priority === 'all' ? undefined : priority,
        }).catch(() => {})
      } finally {
        setMoving(null)
      }
    },
    [updateStatus, fetchTickets, q, priority],
  )


  const modalTicket =
    detailTicket ?? (selectedId ? (tickets.find((t) => t.id === selectedId) ?? null) : null)

  const clearFilters = () => {
    setQ('')
    setEmployeeIdFilter('')
    setPriority('all')
  }

  const requestDelete = (ticket: Ticket, e?: MouseEvent) => {
    e?.stopPropagation()
    setTicketToDelete(ticket)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return
    setDeleting(true)
    try {
      await deleteTicket(ticketToDelete.id)
      removeTicket(ticketToDelete.id)
      if (selectedId === ticketToDelete.id) {
        closeDetail()
      }
      setDeleteConfirmOpen(false)
      setTicketToDelete(null)
      toast.success('Ticket deleted')
      void fetchTickets({
        q: q.trim() || undefined,
        priority: priority === 'all' ? undefined : priority,
      }).catch(() => {})
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Failed to delete ticket')
    } finally {
      setDeleting(false)
    }
  }

  const renderTicketCard = (statusCol: TicketStatus, ticket: Ticket) => (
    <article
      key={ticket.id}
      className="admin-tickets-card mb-3 cursor-pointer"
      onClick={() => openDetail(ticket.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openDetail(ticket.id)
        }
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold capitalize leading-snug text-slate-800">
            {ticket.title}
          </h3>
          <p className="mt-1 font-mono text-xs text-slate-500">{ticket.id}</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-700">{ticket.employeeName}</span>
        <span className="mx-1 text-slate-300">·</span>
        <span className="font-mono text-slate-600">{ticket.employeeId}</span>
      </p>
      <p className="mt-1.5 text-sm text-slate-500">{formatCreatedAt(ticket.createdAt)}</p>

      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
            priorityPillClass(ticket.priority),
          )}
        >
          {ticket.priority}
        </span>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            className="h-8 border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => openDetail(ticket.id)}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            View
          </Button>

          <Button
            size="sm"
            variant="danger"
            type="button"
            className="admin-tickets-danger-btn h-8 px-2.5 text-xs"
            onClick={(e) => requestDelete(ticket, e)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </Button>

          {statusCol === 'Pending' && (
            <Button
              size="sm"
              type="button"
              disabled={moving !== null}
              className="h-8 border-0 bg-emerald-600 px-2.5 text-xs text-white shadow-sm hover:bg-emerald-700"
              onClick={() => void move(ticket.id, 'forward')}
              loading={isMoveForward(ticket.id)}
            >
              → In Progress
            </Button>
          )}

          {statusCol === 'In Progress' && (
            <>
              <Button
                size="sm"
                type="button"
                disabled={moving !== null}
                variant="secondary"
                className="h-8 border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => void move(ticket.id, 'back')}
                loading={isMoveBack(ticket.id)}
              >
                ← Pending
              </Button>
              <Button
                size="sm"
                type="button"
                disabled={moving !== null}
                className="h-8 border-0 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
                onClick={() => void move(ticket.id, 'forward')}
                loading={isMoveForward(ticket.id)}
              >
                Complete
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  )

  const renderKanbanColumn = (statusCol: TicketStatus, rows: Ticket[]) => {
    const meta = COLUMN_META[statusCol]
    const Icon = meta.icon

    return (
      <section
        key={statusCol}
        className={cn('flex min-h-0 min-w-0 flex-col rounded-xl', meta.column)}
      >
        <header
          className={cn(
            'flex shrink-0 items-center justify-between gap-2 px-3 py-2.5',
            meta.header,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-inset',
                meta.iconBox,
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <h2
              className={cn(
                'truncate text-sm font-semibold',
                statusCol === 'Pending' ? 'text-red-950' : 'text-emerald-950',
              )}
            >
              {meta.label}
            </h2>
          </div>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1',
              meta.count,
            )}
          >
            {rows.length}
          </span>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center',
                meta.empty,
              )}
            >
              <TicketIcon className="mb-2 h-5 w-5 text-emerald-400/70" aria-hidden />
              <p className="text-xs font-medium text-emerald-800/70">No tickets here</p>
            </div>
          ) : (
            rows.map((t) => renderTicketCard(statusCol, t))
          )}
        </div>
      </section>
    )
  }

  const openCount = statusCounts.Pending + statusCounts['In Progress']

  return (
    <PageWrapper fillViewport className="admin-hub-page-wrap admin-tickets-page relative z-10 max-w-none !px-0 !py-0 font-body">
      <div
        className="crewiq-dashboard admin-tickets-view relative flex h-full min-h-0 flex-1 flex-col"
        data-admin-tickets
      >
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-tickets-shell relative z-10 flex min-h-0 flex-1 flex-col">
          <header className="admin-tickets-hub-header shrink-0">
            <div className="admin-tickets-hero-top">
              <div className="min-w-0">
                <h1 className="admin-tickets-hero-title font-display">Support Tickets Hub</h1>
              </div>
            </div>
            <div className="admin-tickets-metrics-band" role="group" aria-label="Ticket metrics">
              <div className="admin-tickets-metric-tile">
                <p className="admin-tickets-metric-label">Matching Filters</p>
                <p className="admin-tickets-metric-value font-display">{narrowed.length}</p>
              </div>
              <div className="admin-tickets-metric-tile">
                <p className="admin-tickets-metric-label">Open Queue</p>
                <p className="admin-tickets-metric-value font-display">{openCount}</p>
              </div>
              <div className="admin-tickets-metric-tile">
                <p className="admin-tickets-metric-label">In Progress</p>
                <p className="admin-tickets-metric-value font-display">
                  {statusCounts['In Progress']}
                </p>
              </div>
              <div className="admin-tickets-metric-tile">
                <p className="admin-tickets-metric-label">Completed</p>
                <p className="admin-tickets-metric-value font-display">{statusCounts.Completed}</p>
              </div>
            </div>
          </header>

          <div className="admin-tickets-filter-bar shrink-0">
            <div className="admin-tickets-filter-controls">
              <label className="admin-tickets-filter-field admin-tickets-filter-field--search">
                <span className="admin-tickets-filter-label">Search</span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="text"
                    aria-label="Search tickets"
                    autoComplete="off"
                    className={filterFieldClass}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Title, employee, ID…"
                  />
                </div>
              </label>
              <label className="admin-tickets-filter-field">
                <span className="admin-tickets-filter-label">Employee ID</span>
                <input
                  type="text"
                  aria-label="Employee ID"
                  autoComplete="off"
                  className={filterFieldClass}
                  value={employeeIdFilter}
                  onChange={(e) => setEmployeeIdFilter(e.target.value)}
                  placeholder="Filter by ID"
                />
              </label>
              <label className="admin-tickets-filter-field">
                <span className="admin-tickets-filter-label">Priority</span>
                <select
                  aria-label="Priority"
                  className={cn(filterFieldClass, 'cursor-pointer')}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="all">All priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </label>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="admin-tickets-filter-clear"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>

          <div className="admin-tickets-board flex min-h-0 flex-1 flex-col">
            {ticketsLoading && tickets.length === 0 ? (
              <div className="admin-tickets-board-empty">
                <p className="text-sm font-medium admin-tickets-text-brand-muted">Loading tickets…</p>
              </div>
            ) : !ticketsLoading && tickets.length === 0 ? (
              <div className="admin-tickets-board-empty">
                <TicketIcon className="mb-3 h-9 w-9 admin-tickets-text-brand opacity-40" aria-hidden />
                <p className="text-sm font-semibold admin-tickets-text-brand">No tickets yet</p>
                <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-slate-600">
                  Tickets appear when employees submit support requests.
                </p>
              </div>
            ) : (
              <div className="admin-tickets-kanban-grid min-h-0 flex-1">
                {BOARD_STATUSES.map((statusCol) => renderKanbanColumn(statusCol, columns[statusCol]))}
              </div>
            )}
          </div>
        </div>

        <TicketDetailModal
          ticket={modalTicket}
          isOpen={detailOpen}
          onClose={closeDetail}
          onUpdateStatus={handleModalUpdateStatus}
          onDelete={
            modalTicket
              ? () => {
                  setTicketToDelete(modalTicket)
                  setDeleteConfirmOpen(true)
                }
              : undefined
          }
          deleting={deleting}
          advancing={!!moving}
        />

        <ConfirmModal
          isOpen={deleteConfirmOpen}
          title="Delete ticket?"
          description={
            ticketToDelete
              ? `Permanently delete ticket ${ticketToDelete.id} (“${ticketToDelete.title}”)? This cannot be undone.`
              : 'Permanently delete this ticket?'
          }
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          danger
          onClose={() => {
            if (deleting) return
            setDeleteConfirmOpen(false)
            setTicketToDelete(null)
          }}
          onConfirm={() => void handleDeleteTicket()}
        />
      </div>
    </PageWrapper>
  )
}
