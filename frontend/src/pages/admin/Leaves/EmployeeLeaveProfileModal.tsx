import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { DataTable, type Column } from '@components/tables/DataTable'
import type { EmployeeLeaveSummary, LeaveRequest } from '@/types'
import * as leaveService from '@services/leaveService'
import { formatDate } from '@/utils/formatDate'

const LEAVE_TYPE_COLORS: Record<string, string> = {
  'Casual Leave': 'border-green-200 bg-green-50',
  'Sick Leave': 'border-blue-200 bg-blue-50',
  'Earned Leave': 'border-violet-200 bg-violet-50',
  'Compensation Leave': 'border-amber-200 bg-amber-50',
}

const EDITABLE_ALLOCATION_TYPES = new Set(['Casual Leave', 'Sick Leave', 'Earned Leave'])

function getStatusBadgeVariant(status: LeaveRequest['status']) {
  switch (status) {
    case 'Approved':
      return 'success'
    case 'Pending':
      return 'warning'
    case 'Rejected':
      return 'danger'
    case 'Cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function EmployeeLeaveProfileModal({
  isOpen,
  employeeId,
  employeeName,
  onClose,
}: {
  isOpen: boolean
  employeeId: string | null
  employeeName: string
  onClose: () => void
}) {
  const [summary, setSummary] = useState<EmployeeLeaveSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [allocationDraft, setAllocationDraft] = useState<Record<string, string>>({})
  const [savingAllocations, setSavingAllocations] = useState(false)

  const loadSummary = async (id: string) => {
    setLoading(true)
    try {
      const data = await leaveService.getEmployeeLeaveSummary(id)
      setSummary(data)
      setAllocationDraft(
        Object.fromEntries(data.balances.map((b) => [b.type, String(b.total)])),
      )
    } catch (error) {
      console.error('[EmployeeLeaveProfile] load failed:', error)
      toast.error('Failed to load employee leave details')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !employeeId) {
      setSummary(null)
      setAllocationDraft({})
      return
    }

    let cancelled = false
    void (async () => {
      await loadSummary(employeeId)
      if (cancelled) return
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, employeeId])

  const handleSaveAllocations = async () => {
    if (!employeeId || !summary) return

    const payload: Partial<Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave', number>> = {}
    for (const type of EDITABLE_ALLOCATION_TYPES) {
      const raw = allocationDraft[type]?.trim()
      const value = Number(raw)
      if (raw === '' || Number.isNaN(value) || value < 0) {
        toast.error(`${type} must be a non-negative number`)
        return
      }
      payload[type] = value
    }

    setSavingAllocations(true)
    try {
      await leaveService.updateEmployeeLeaveAllocations(employeeId, payload)
      toast.success('Leave allotments updated')
      await loadSummary(employeeId)
    } catch (error) {
      console.error('[EmployeeLeaveProfile] save allocations failed:', error)
      toast.error('Failed to update leave allotments')
    } finally {
      setSavingAllocations(false)
    }
  }

  const hasAllocationChanges = summary
    ? [...EDITABLE_ALLOCATION_TYPES].some((type) => {
        const saved = summary.balances.find((b) => b.type === type)?.total
        return allocationDraft[type] !== String(saved ?? 0)
      })
    : false

  const historyColumns: Column<LeaveRequest>[] = [
    { key: 'type', header: 'Type' },
    {
      key: 'from',
      header: 'From',
      render: (l) => formatDate(l.from),
    },
    {
      key: 'to',
      header: 'To',
      render: (l) => formatDate(l.to),
    },
    {
      key: 'days',
      header: 'Days',
      render: (l) => <span>{l.days}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <Badge variant={getStatusBadgeVariant(l.status)}>{l.status}</Badge>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (l) => (
        <span className="max-w-[180px] truncate text-sm text-muted" title={l.reason}>
          {l.reason}
        </span>
      ),
    },
  ]

  const displayName = summary?.employeeName ?? employeeName
  const profileTitle = summary?.employeeId
    ? `Leave Profile - ${displayName} (${summary.employeeId})`
    : `Leave Profile - ${displayName}`

  return (
    <Modal
      isOpen={isOpen}
      title={profileTitle}
      onClose={onClose}
      size="xl"
      className="flex max-h-[min(90vh,40rem)] min-h-0 flex-col overflow-hidden"
    >
      {loading ? (
        <div className="flex min-h-[200px] flex-1 items-center justify-center">
          <span className="text-sm text-muted">Loading leave details...</span>
        </div>
      ) : summary ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
          <section className="shrink-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Leave balances</h3>
              {hasAllocationChanges ? (
                <Button
                  size="sm"
                  onClick={() => void handleSaveAllocations()}
                  loading={savingAllocations}
                >
                  Save changes
                </Button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {summary.balances.map((b) => {
                const isEditable = EDITABLE_ALLOCATION_TYPES.has(b.type)
                const draftTotal = Number(allocationDraft[b.type] ?? b.total)
                const parsedTotal = Number.isNaN(draftTotal) ? b.total : draftTotal
                const draftRemaining = Math.max(0, parsedTotal - b.used)

                return (
                  <div
                    key={b.type}
                    className={`rounded-lg border p-3 ${LEAVE_TYPE_COLORS[b.type] ?? 'border-border bg-surface/40'}`}
                  >
                    <p className="text-xs font-semibold text-ink mb-2">{b.type}</p>
                    <ul className="space-y-1 text-xs text-ink">
                      <li className="flex flex-wrap items-center gap-1">
                        <span className="text-muted">Taken (approved):</span>
                        <strong>{b.used}</strong>
                        <span className="text-muted">/</span>
                        {isEditable ? (
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={allocationDraft[b.type] ?? String(b.total)}
                            onChange={(e) =>
                              setAllocationDraft((prev) => ({ ...prev, [b.type]: e.target.value }))
                            }
                            className="h-7 w-16 rounded border border-border bg-white px-2 text-xs font-semibold text-ink"
                            aria-label={`${b.type} allotment`}
                          />
                        ) : (
                          <strong>{b.total}</strong>
                        )}
                      </li>
                      <li>
                        <span className="text-muted">Pending requests:</span>{' '}
                        <strong>{b.pending}</strong> {b.pending === 1 ? 'day' : 'days'}
                      </li>
                      <li>
                        <span className="text-muted">Remaining:</span>{' '}
                        <strong>{isEditable && hasAllocationChanges ? draftRemaining : b.remaining}</strong>{' '}
                        {(isEditable && hasAllocationChanges ? draftRemaining : b.remaining) === 1 ? 'day' : 'days'}
                      </li>
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <h3 className="mb-3 shrink-0 text-sm font-semibold text-ink">Leave history</h3>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <DataTable
                columns={historyColumns}
                data={summary.history}
                loading={false}
                empty="No leave records for this employee."
                className="max-h-none overflow-y-visible"
              />
            </div>
          </section>
        </div>
      ) : (
        <div className="flex min-h-[200px] items-center justify-center">
          <span className="text-sm text-muted">Could not load leave details for this employee.</span>
        </div>
      )}
    </Modal>
  )
}
