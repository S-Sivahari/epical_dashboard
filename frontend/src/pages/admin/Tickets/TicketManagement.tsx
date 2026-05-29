import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Eye } from 'lucide-react'
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
  Pending: { title: 'Pending Tickets', badgeLabel: 'Pending' },
  'In Progress': { title: 'In Progress Tickets', badgeLabel: 'In Progress' },
  Completed: { title: 'Completed Tickets', badgeLabel: 'Completed' },
}

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

  const isMoveForward = (id: string) => moving?.id === id && moving?.dir === 'forward'
  const isMoveBack = (id: string) => moving?.id === id && moving?.dir === 'back'

  const move = useCallback(
    async (id: string, direction: 'forward' | 'back') => {
      const t = tickets.find((x) => x.id === id)
      if (!t) return
      const next =
        direction === 'forward' ? getNextStatus(t.status) : getPrevStatus(t.status)
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

  return (
    <PageWrapper>
      <div className="mb-8 grid gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          No tickets yet. Use employee ticket creation or run database seed (<code>/api/seed</code>).
        </p>
      ) : null}

      <div className="space-y-8">
        {BOARD_STATUSES.map((statusCol) => {
          const meta = SECTION_COPY[statusCol]
          const rows = columns[statusCol]
          const badgeVariant = statusVariant(statusCol)

          return (
            <section
              key={statusCol}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-ink">{meta.title}</h2>
                  <Badge variant={badgeVariant}>{meta.badgeLabel}</Badge>
                </div>
                <span className="text-sm font-semibold tabular-nums text-muted">{rows.length}</span>
              </header>

              {rows.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">No tickets in this section.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface/40 text-[11px] font-semibold uppercase tracking-wide text-muted">
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
                            'cursor-pointer border-b border-border/80 transition-colors hover:bg-surface/30',
                            idx % 2 === 1 && 'bg-surface/15',
                          )}
                          onClick={() => openDetail(t.id)}
                          role="presentation"
                        >
                          <td className="max-w-[220px] px-4 py-3 align-middle">
                            <div className="line-clamp-2 font-medium capitalize text-ink">{t.title}</div>
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
                              <Button size="sm" variant="ghost" type="button" onClick={() => openDetail(t.id)}>
                                <Eye className="h-4 w-4 text-muted" aria-hidden />
                                View
                              </Button>

                              {statusCol === 'Pending' && (
                                <Button
                                  size="sm"
                                  type="button"
                                  disabled={moving !== null}
                                  variant="secondary"
                                  className="border-border font-semibold text-ink"
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
                                    className="border-border"
                                    onClick={() => void move(t.id, 'back')}
                                    loading={isMoveBack(t.id)}
                                  >
                                    ← Pending
                                  </Button>
                                  <Button
                                    size="sm"
                                    type="button"
                                    disabled={moving !== null}
                                    className="bg-emerald-700 font-semibold text-white hover:bg-emerald-800"
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

      <TicketDetailModal
        ticket={modalTicket}
        isOpen={detailOpen}
        onClose={closeDetail}
        onUpdateStatus={handleModalUpdateStatus}
        onAddComment={handleModalAddComment}
        advancing={!!moving}
      />
    </PageWrapper>
  )
}
