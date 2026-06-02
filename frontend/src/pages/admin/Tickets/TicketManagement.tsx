import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Eye,
  Ticket as TicketIcon,
  Clock,
  Loader2,
  CheckCircle2,
  LayoutGrid,
  X,
  Search,
} from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import {
  TicketDetailModal,
} from '@pages/admin/Tickets/TicketDetailModal'
import type { Ticket, TicketStatus } from '@/types'
import { cn } from '@/utils/cn'
import { useTicketStore } from '@store/ticketStore'
import { fetchTicketById, getNextStatus, getPrevStatus } from '@services/ticketService'
import { formatDateTime } from '@/utils/formatDate'

type SectionFilter = 'all' | TicketStatus

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

const tabItems: Array<{ id: SectionFilter; label: string; icon: typeof TicketIcon }> = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'Pending', label: 'Pending', icon: Clock },
  { id: 'In Progress', label: 'In Progress', icon: Loader2 },
  { id: 'Completed', label: 'Completed', icon: CheckCircle2 },
]

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

const filterFieldClass =
  'h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

export function TicketManagement() {
  const tickets = useTicketStore((s) => s.tickets)
  const loading = useTicketStore((s) => s.loading)
  const fetchTickets = useTicketStore((s) => s.fetchTickets)
  const fetchTicketsSilent = useTicketStore((s) => s.fetchTicketsSilent)
  const updateStatus = useTicketStore((s) => s.updateStatus)
  const addComment = useTicketStore((s) => s.addComment)

  const [q, setQ] = useState('')
  const [employeeIdFilter, setEmployeeIdFilter] = useState('')
  const [priority, setPriority] = useState('all')
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all')
  const [moving, setMoving] = useState<{ id: string; dir: 'forward' | 'back' } | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null)

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
      if (sectionFilter !== 'all' && t.status !== sectionFilter) return false
      return true
    })
  }, [tickets, employeeIdFilter, sectionFilter])

  const columns = useMemo(() => {
    return {
      Pending: narrowed.filter((t) => t.status === 'Pending'),
      'In Progress': narrowed.filter((t) => t.status === 'In Progress'),
      Completed: narrowed.filter((t) => t.status === 'Completed'),
    } as Record<TicketStatus, Ticket[]>
  }, [narrowed])

  const statusCounts = useMemo(
    () => ({
      all: tickets.length,
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
        await fetchTickets({
          q: q.trim() || undefined,
          priority: priority === 'all' ? undefined : priority,
        })
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
        const full = await fetchTicketById(id)
        setDetailTicket(full)
        await fetchTickets({
          q: q.trim() || undefined,
          priority: priority === 'all' ? undefined : priority,
        })
      } finally {
        setMoving(null)
      }
    },
    [updateStatus, fetchTickets, q, priority],
  )

  const handleModalAddComment = useCallback(
    async (id: string, text: string) => {
      await addComment(id, text)
      const full = await fetchTicketById(id)
      setDetailTicket(full)
    },
    [addComment],
  )

  const modalTicket =
    detailTicket ?? (selectedId ? (tickets.find((t) => t.id === selectedId) ?? null) : null)

  const clearFilters = () => {
    setQ('')
    setEmployeeIdFilter('')
    setPriority('all')
  }

  const visibleStatuses =
    sectionFilter === 'all' ? BOARD_STATUSES : ([sectionFilter] as readonly TicketStatus[])

  const renderTicketCard = (statusCol: TicketStatus, ticket: Ticket) => (
    <article
      key={ticket.id}
      className="mb-3 cursor-pointer rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
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
          <h3 className="line-clamp-2 text-sm font-medium capitalize text-slate-800">{ticket.title}</h3>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{ticket.id}</p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">{ticket.employeeName}</span>
        <span className="mx-1 text-slate-300">·</span>
        <span className="font-mono">{ticket.employeeId}</span>
      </p>
      <p className="mt-1 text-xs text-slate-400">{formatCreatedAt(ticket.createdAt)}</p>

      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
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
            className="h-7 border-slate-200 bg-white px-2 text-[11px] text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => openDetail(ticket.id)}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            View
          </Button>

          {statusCol === 'Pending' && (
            <Button
              size="sm"
              type="button"
              disabled={moving !== null}
              className="h-7 border-0 bg-emerald-600 px-2 text-[11px] text-white shadow-sm hover:bg-emerald-700"
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
                className="h-7 border-slate-200 bg-white px-2 text-[11px] text-slate-700 hover:bg-slate-50"
                onClick={() => void move(ticket.id, 'back')}
                loading={isMoveBack(ticket.id)}
              >
                ← Pending
              </Button>
              <Button
                size="sm"
                type="button"
                disabled={moving !== null}
                className="h-7 border-0 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-700"
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

  return (
    <PageWrapper className="admin-tickets-page relative z-10 max-w-none px-0 py-0 font-body">
      <div
        className="flex h-full min-h-0 flex-col bg-emerald-50/40"
        data-admin-tickets
      >
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-slate-900">
                Support Tickets
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {loading
                  ? 'Loading queue…'
                  : `${narrowed.length} ticket${narrowed.length === 1 ? '' : 's'} matching filters`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-0.5">
                {tabItems.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSectionFilter(tab.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                      sectionFilter === tab.id
                        ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/80'
                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-900',
                    )}
                  >
                    <tab.icon className="h-3 w-3 shrink-0" />
                    {tab.label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums',
                        sectionFilter === tab.id
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200/80 text-slate-600',
                      )}
                    >
                      {statusCounts[tab.id]}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="text"
                    aria-label="Search tickets"
                    autoComplete="off"
                    className={cn(filterFieldClass, 'w-36 pl-7 sm:w-44')}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search…"
                  />
                </div>
                <input
                  type="text"
                  aria-label="Employee ID"
                  autoComplete="off"
                  className={cn(filterFieldClass, 'w-28')}
                  value={employeeIdFilter}
                  onChange={(e) => setEmployeeIdFilter(e.target.value)}
                  placeholder="Employee ID"
                />
                <select
                  aria-label="Priority"
                  className={cn(filterFieldClass, 'w-32 cursor-pointer')}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="all">All priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    onClick={clearFilters}
                  >
                    <X className="h-3 w-3" aria-hidden />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <div className="mb-2 flex shrink-0 items-center justify-end gap-1.5 text-[11px] font-medium text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live queue
          </div>

          {loading && tickets.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
              <p className="text-sm font-medium text-slate-500">Loading tickets…</p>
            </div>
          ) : !loading && tickets.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 text-center">
              <TicketIcon className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-800">No tickets yet</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                Tickets appear when employees submit support requests.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                'grid min-h-0 flex-1 gap-3',
                visibleStatuses.length === 1
                  ? 'grid-cols-1'
                  : 'grid-cols-1 lg:grid-cols-3',
              )}
            >
              {visibleStatuses.map((statusCol) => renderKanbanColumn(statusCol, columns[statusCol]))}
            </div>
          )}
        </div>

        <TicketDetailModal
          ticket={modalTicket}
          isOpen={detailOpen}
          onClose={closeDetail}
          onUpdateStatus={handleModalUpdateStatus}
          onAddComment={handleModalAddComment}
          advancing={!!moving}
        />
      </div>
    </PageWrapper>
  )
}
