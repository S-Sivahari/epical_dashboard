import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Eye, Ticket as TicketIcon, Clock, Loader2, CheckCircle2, Sparkles, LayoutGrid } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { Button } from '@components/ui/Button'
import { Badge } from '@components/ui/Badge'
import {
  TicketDetailModal,
  priorityVariant,
  statusVariant,
} from '@pages/admin/Tickets/TicketDetailModal'
import type { Ticket, TicketStatus } from '@/types'
import { cn } from '@/utils/cn'
import { useTicketStore } from '@store/ticketStore'
import { fetchTicketById, getNextStatus, getPrevStatus } from '@services/ticketService'
import { formatDateTime } from '@/utils/formatDate'

type SectionFilter = 'all' | TicketStatus

const BOARD_STATUSES = ['Pending', 'In Progress', 'Completed'] as const

const SECTION_COPY: Record<TicketStatus, { title: string; badgeLabel: string }> = {
  Pending: { title: 'Pending', badgeLabel: 'Pending' },
  'In Progress': { title: 'In Progress', badgeLabel: 'In Progress' },
  Completed: { title: 'Completed', badgeLabel: 'Completed' },
}

const tabItems: Array<{ id: SectionFilter; label: string; icon: typeof TicketIcon }> = [
  { id: 'all', label: 'All Tickets', icon: LayoutGrid },
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

  const visibleStatuses =
    sectionFilter === 'all' ? BOARD_STATUSES : ([sectionFilter] as readonly TicketStatus[])

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

<<<<<<< HEAD
  const renderTicketTable = (statusCol: TicketStatus, rows: Ticket[]) => {
    const meta = SECTION_COPY[statusCol]
    const badgeVariant = statusVariant(statusCol)

    return (
      <section key={statusCol} className="admin-tickets-column overflow-hidden rounded-xl">
        <header className="admin-tickets-column-head flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-sm font-bold">{meta.title}</h2>
            <Badge variant={badgeVariant}>{meta.badgeLabel}</Badge>
          </div>
          <span className="text-sm font-bold tabular-nums text-white/80">{rows.length}</span>
        </header>

        {rows.length === 0 ? (
          <p className="admin-tickets-column-empty py-10 text-center text-sm font-medium">
            No tickets in this section.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-tickets-table min-w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3">Issue / ID</th>
                  <th className="px-4 py-3">Employee / ID</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="admin-tickets-row cursor-pointer transition-colors"
                    onClick={() => openDetail(t.id)}
                    role="presentation"
                  >
                    <td className="max-w-[220px] px-4 py-3 align-middle">
                      <div className="line-clamp-2 font-semibold capitalize text-ink">{t.title}</div>
                      <div className="mt-0.5 font-mono text-xs text-muted">{t.id}</div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="font-medium text-ink">{t.employeeName}</div>
                      <div className="mt-0.5 font-mono text-xs text-muted">{t.employeeId}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-muted">
                      {formatCreatedAt(t.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div
                        className="flex flex-wrap items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          className="admin-tickets-secondary-btn"
                          onClick={() => openDetail(t.id)}
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                          View
                        </Button>

                        {statusCol === 'Pending' && (
                          <Button
                            size="sm"
                            type="button"
                            disabled={moving !== null}
                            className="admin-dash-action-btn border-0"
                            onClick={() => void move(t.id, 'forward')}
                            loading={isMoveForward(t.id)}
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
                              className="admin-tickets-secondary-btn"
                              onClick={() => void move(t.id, 'back')}
                              loading={isMoveBack(t.id)}
                            >
                              ← Pending
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              disabled={moving !== null}
                              className="admin-dash-action-btn border-0"
                              onClick={() => void move(t.id, 'forward')}
                              loading={isMoveForward(t.id)}
                            >
                              Mark completed
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  }

  return (
    <PageWrapper className="relative z-10 py-3 font-body">
      <div className="crewiq-dashboard admin-tickets-view">
        <div className="admin-tickets-shell animate-fadeIn">
          {/* Hero */}
          <div className="admin-tickets-hero">
            <div className="admin-tickets-hero-top">
              <div className="min-w-0">
                <h1 className="admin-tickets-hero-title font-display">Support Tickets</h1>
                <p className="admin-tickets-hero-sub">Track, assign, and resolve employee requests</p>
              </div>
              <div className="admin-tickets-tab-rail">
                {tabItems.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSectionFilter(tab.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[11px] font-bold transition-all duration-200',
                      sectionFilter === tab.id
                        ? 'admin-dash-action-btn-sm text-white'
                        : 'admin-tickets-tab-inactive',
                    )}
                  >
                    <tab.icon className="h-3 w-3 shrink-0" />
                    {tab.label}
                    <span
                      className={cn(
                        'rounded-full px-1 py-px text-[9px] font-black tabular-nums leading-none',
                        sectionFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white/15 text-white/80',
                      )}
                    >
                      {statusCounts[tab.id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-tickets-metrics-band">
              <div className="admin-tickets-metric-glass">
                <p className="admin-tickets-metric-label">Pending</p>
                <p className="admin-tickets-metric-value font-display">{statusCounts.Pending}</p>
              </div>
              <div className="admin-tickets-metric-glass">
                <p className="admin-tickets-metric-label">In Progress</p>
                <p className="admin-tickets-metric-value font-display">{statusCounts['In Progress']}</p>
              </div>
              <div className="admin-tickets-metric-glass">
                <p className="admin-tickets-metric-label">Completed</p>
                <p className="admin-tickets-metric-value font-display">{statusCounts.Completed}</p>
              </div>
            </div>
          </div>

          <div className="admin-tickets-body-grid">
            {/* Filters sidebar */}
            <aside className="admin-tickets-sidebar space-y-4">
              <p className="admin-tickets-sidebar-title">Filters</p>
              <p className="text-xs font-medium leading-relaxed text-[var(--emerald-dark)]/80">
                Search tickets and narrow by employee or priority. Auto-refreshes every 30 seconds.
              </p>
              <Input
                label="Search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Title or employee name..."
              />
              <Input
                label="Employee ID"
                value={employeeIdFilter}
                onChange={(e) => setEmployeeIdFilter(e.target.value)}
                placeholder="Filter by ID..."
              />
              <SelectField
                label="Priority"
                id="ticket-priority"
                options={[
                  { value: 'all', label: 'All priorities' },
                  { value: 'Low', label: 'Low' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'High', label: 'High' },
                  { value: 'Critical', label: 'Critical' },
                ]}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
              {(q || employeeIdFilter || priority !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-[var(--emerald-dark)]"
                  onClick={() => {
                    setQ('')
                    setEmployeeIdFilter('')
                    setPriority('all')
                  }}
                >
                  Clear filters
                </Button>
              )}
              <div className="admin-tickets-tip-box rounded-lg p-3 text-xs font-medium leading-relaxed">
                <Sparkles className="mb-1.5 h-3.5 w-3.5 text-[var(--emerald-dark)]" />
                Click a row to open details. Use action buttons to move tickets through the workflow.
              </div>
            </aside>

            {/* Main board */}
            <div className="admin-tickets-main-panel">
              <div className="admin-tickets-panel-header">
                <div>
                  <h2 className="font-display text-sm font-bold text-[var(--emerald-dark)]">
                    Ticket Board
                  </h2>
                  <p className="text-xs font-medium text-slate-600">
                    {loading
                      ? 'Loading...'
                      : `${narrowed.length} ticket${narrowed.length === 1 ? '' : 's'} matching filters`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--emerald-dark)]">
                  <TicketIcon className="h-3.5 w-3.5" />
                  Live queue
                </div>
              </div>

              {loading && tickets.length === 0 ? (
                <div className="admin-tickets-empty flex min-h-[240px] items-center justify-center rounded-xl">
                  <p className="text-sm font-medium text-[var(--emerald-dark)]/70">Loading tickets…</p>
                </div>
              ) : !loading && tickets.length === 0 ? (
                <div className="admin-tickets-empty flex min-h-[240px] flex-col items-center justify-center rounded-xl px-6 text-center">
                  <TicketIcon className="mb-2 h-8 w-8 text-[var(--emerald-dark)]/40" />
                  <p className="text-sm font-semibold text-[var(--emerald-dark)]">No tickets yet</p>
                  <p className="mt-1 text-xs text-muted">
                    Tickets appear when employees submit requests or after database seed.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleStatuses.map((statusCol) =>
                    renderTicketTable(statusCol, columns[statusCol]),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

=======
  return (
    <PageWrapper className="admin-page">
      <div className="tickets-page crewiq-dashboard space-y-6">
        <div className="admin-toolbar admin-panel grid gap-4 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title or employee name..."
          />
          <Input
            label="Employee ID"
            value={employeeIdFilter}
            onChange={(e) => setEmployeeIdFilter(e.target.value)}
            placeholder="Filter by ID..."
          />
          <SelectField
            label="Priority"
            id="ticket-priority"
            options={[
              { value: 'all', label: 'All priorities' },
              { value: 'Low', label: 'Low' },
              { value: 'Medium', label: 'Medium' },
              { value: 'High', label: 'High' },
              { value: 'Critical', label: 'Critical' },
            ]}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
          <SelectField
            label="Status"
            id="ticket-section-filter"
            options={[
              { value: 'all', label: 'All sections' },
              { value: 'Pending', label: 'Pending' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Completed', label: 'Completed' },
            ]}
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value as SectionFilter)}
          />
        </div>

        {loading && tickets.length === 0 ? (
          <p className="text-sm text-muted">Loading tickets…</p>
        ) : null}
        {!loading && tickets.length === 0 ? (
          <p className="text-sm text-muted">
            No tickets yet. Use employee ticket creation or run database seed (<code className="rounded bg-[#F5F7F9] px-1">/api/seed</code>).
          </p>
        ) : null}

        <div className="space-y-6">
          {BOARD_STATUSES.map((statusCol) => {
            const meta = SECTION_COPY[statusCol]
            const rows = columns[statusCol]
            const badgeVariant = statusVariant(statusCol)

            return (
              <section
                key={statusCol}
                className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#F5F7F9] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-ink">{meta.title}</h2>
                    <Badge variant={badgeVariant}>{meta.badgeLabel}</Badge>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-muted">{rows.length}</span>
                </header>

                {rows.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted">No tickets in this section.</p>
                ) : (
                  <div className="overflow-x-auto bg-white">
                    <table className="tickets-table min-w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border bg-[#F5F7F9] text-[11px] font-semibold uppercase tracking-wide text-[#5c5a66]">
                          <th className="px-4 py-3">Issue / ID</th>
                          <th className="px-4 py-3">Employee / ID</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3">Priority</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((t, idx) => (
                          <tr
                            key={t.id}
                            className={cn(
                              'cursor-pointer border-b border-border bg-white transition-colors hover:bg-[rgba(6,192,51,0.06)]',
                              idx % 2 === 1 && 'bg-[#FAFBFC]',
                            )}
                            onClick={() => openDetail(t.id)}
                            role="presentation"
                          >
                            <td className="max-w-[220px] px-4 py-3 align-middle">
                              <div className="line-clamp-2 font-medium capitalize text-ink">{t.title}</div>
                              <div className="mt-0.5 font-mono text-xs text-[#5c5a66]">{t.id}</div>
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <div className="font-medium text-ink">{t.employeeName}</div>
                              <div className="mt-0.5 font-mono text-xs text-[#5c5a66]">{t.employeeId}</div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-middle text-[#5c5a66]">
                              {formatCreatedAt(t.createdAt)}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <div
                                className="flex flex-wrap items-center justify-end gap-2"
                                onClick={(e) => e.stopPropagation()}
                                role="presentation"
                              >
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  type="button"
                                  className="text-ink"
                                  onClick={() => openDetail(t.id)}
                                >
                                  <Eye className="h-4 w-4 text-muted" aria-hidden />
                                  View
                                </Button>

                                {statusCol === 'Pending' && (
                                  <Button
                                    size="sm"
                                    type="button"
                                    disabled={moving !== null}
                                    variant="secondary"
                                    onClick={() => void move(t.id, 'forward')}
                                    loading={isMoveForward(t.id)}
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
                                      onClick={() => void move(t.id, 'back')}
                                      loading={isMoveBack(t.id)}
                                    >
                                      ← Pending
                                    </Button>
                                    <Button
                                      size="sm"
                                      type="button"
                                      disabled={moving !== null}
                                      onClick={() => void move(t.id, 'forward')}
                                      loading={isMoveForward(t.id)}
                                    >
                                      Mark as completed
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}
        </div>

>>>>>>> 170f0a47d569781383899906ffbec802811fb10e
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
