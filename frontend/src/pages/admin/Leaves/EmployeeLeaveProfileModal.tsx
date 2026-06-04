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
}

const ALLOCATION_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave'] as const

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
      const fromSummary = data.allocations ?? Object.fromEntries(
        data.balances.map((b) => [b.type, String(b.total)]),
      )
      setAllocationDraft(
        Object.fromEntries(
          ALLOCATION_TYPES.map((type) => [type, String(fromSummary[type] ?? 0)]),
        ),
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

    const payload: Partial<Record<(typeof ALLOCATION_TYPES)[number], number>> = {}
    for (const type of ALLOCATION_TYPES) {
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

  return (
    <Modal
      isOpen={isOpen}
      title={`Leave Profile — ${displayName}`}
      onClose={onClose}
      size="xl"
    >
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <span className="text-sm text-muted">Loading leave details...</span>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          <p className="text-sm text-muted">{summary.employeeId}</p>

          <section>
            <h3 className="text-sm font-semibold text-ink mb-2">Allotted leave days (admin)</h3>
            <p className="text-xs text-muted mb-3">
              Set how many days this employee has per type. Leave history clears automatically on the 1st of each month.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {ALLOCATION_TYPES.map((type) => (
                <label key={type} className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink">{type}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={allocationDraft[type] ?? ''}
                    onChange={(e) =>
                      setAllocationDraft((prev) => ({ ...prev, [type]: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink"
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={() => void handleSaveAllocations()}
                loading={savingAllocations}
              >
                Save allotments
              </Button>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ink mb-3">Leave balances (this month)</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {summary.balances.map((b) => (
                <div
                  key={b.type}
                  className={`rounded-lg border p-3 ${LEAVE_TYPE_COLORS[b.type] ?? 'border-border bg-surface/40'}`}
                >
                  <p className="text-xs font-semibold text-ink mb-2">{b.type}</p>
                  <ul className="space-y-1 text-xs text-ink">
                    <li>
                      <span className="text-muted">Taken (approved):</span>{' '}
                      <strong>{b.used}</strong> / {b.total}
                    </li>
                    <li>
                      <span className="text-muted">Pending requests:</span>{' '}
                      <strong>{b.pending}</strong> {b.pending === 1 ? 'day' : 'days'}
                    </li>
                    <li>
                      <span className="text-muted">Remaining:</span>{' '}
                      <strong>{b.remaining}</strong> {b.remaining === 1 ? 'day' : 'days'}
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ink mb-3">Current leave (on leave today)</h3>
            {summary.currentLeaves.length === 0 ? (
              <p className="text-sm text-muted rounded-lg border border-dashed border-border p-4">
                Not on approved leave today.
              </p>
            ) : (
              <ul className="space-y-2">
                {summary.currentLeaves.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-sm"
                  >
                    <Badge variant="info">On Leave</Badge>
                    <span className="font-medium">{l.type}</span>
                    <span className="text-muted">
                      {formatDate(l.from)} – {formatDate(l.to)} ({l.days} {l.days === 1 ? 'day' : 'days'})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ink mb-3">Leave history</h3>
            <DataTable
              columns={historyColumns}
              data={summary.history}
              loading={false}
              empty="No leave records for this employee."
            />
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
