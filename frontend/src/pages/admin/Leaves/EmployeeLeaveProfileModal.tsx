import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus } from 'lucide-react'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { DataTable, type Column } from '@components/tables/DataTable'
import type { EmployeeLeaveSummary, LeaveRequest } from '@/types'
import * as leaveService from '@services/leaveService'
import { useEmployeeStore } from '@store/employeeStore'
import { formatDate } from '@/utils/formatDate'
import { cn } from '@/utils/cn'

const LEAVE_TYPE_COLORS: Record<string, string> = {
  'Casual Leave': 'border-green-200 bg-green-50',
  'Sick Leave': 'border-blue-200 bg-blue-50',
  'Earned Leave': 'border-violet-200 bg-violet-50',
  'Compensation Leave': 'border-amber-200 bg-amber-50',
}

const ADJUSTABLE_TYPES = new Set([
  'Casual Leave',
  'Sick Leave',
  'Earned Leave',
  'Compensation Leave',
])

type PendingAdjustment = {
  type: string
  delta: number
  used: number
  total: number
  remaining: number
}

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
  const [pendingAdjustment, setPendingAdjustment] = useState<PendingAdjustment | null>(null)
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const employees = useEmployeeStore((s) => s.employees)
  const fetchEmployees = useEmployeeStore((s) => s.fetchEmployees)

  useEffect(() => {
    if (isOpen && employees.length === 0) {
      void fetchEmployees()
    }
  }, [isOpen, employees.length, fetchEmployees])

  const displayEmployeeId = useMemo(() => {
    const lookupId = employeeId ?? summary?.employeeId ?? ''
    if (!lookupId) return ''

    const employee = employees.find(
      (e) =>
        String(e.id) === String(lookupId) ||
        String(e.employeeId) === String(lookupId),
    )
    return employee?.employeeId || summary?.employeeId || lookupId
  }, [employeeId, employees, summary?.employeeId])

  const loadSummary = async (id: string) => {
    setLoading(true)
    try {
      const data = await leaveService.getEmployeeLeaveSummary(id)
      setSummary(data)
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
      setPendingAdjustment(null)
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

  const openAdjustmentConfirm = (type: string, delta: number) => {
    if (!summary) return
    const balance = summary.balances.find((b) => b.type === type)
    if (!balance) return

    const nextRemaining = balance.remaining + delta
    if (nextRemaining < 0) {
      toast.error('Remaining balance cannot go below zero')
      return
    }
    if (nextRemaining > balance.total) {
      toast.error('Remaining balance cannot exceed the total allotment')
      return
    }

    setPendingAdjustment({
      type,
      delta,
      used: balance.used,
      total: balance.total,
      remaining: balance.remaining,
    })
  }

  const handleConfirmAdjustment = async () => {
    if (!employeeId || !pendingAdjustment) return

    setSavingAdjustment(true)
    try {
      const updated = await leaveService.adjustEmployeeLeaveBalance(
        employeeId,
        pendingAdjustment.type as 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Compensation Leave',
        -pendingAdjustment.delta,
      )
      setSummary(updated)
      setPendingAdjustment(null)
      toast.success('Leave balance updated')
    } catch (error) {
      console.error('[EmployeeLeaveProfile] balance adjustment failed:', error)
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update leave balance'
      toast.error(message)
    } finally {
      setSavingAdjustment(false)
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
  const profileTitle = summary?.employeeId
    ? `Leave Profile - ${displayName} (${summary.employeeId})`
    : `Leave Profile - ${displayName}`

  const pendingNextUsed = pendingAdjustment
    ? pendingAdjustment.used - pendingAdjustment.delta
    : 0
  const pendingNextRemaining = pendingAdjustment
    ? pendingAdjustment.remaining + pendingAdjustment.delta
    : 0

  return (
    <>
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
                <span className="text-xs text-muted">Calendar year · resets every January</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {summary.balances
                  .filter((b) => ADJUSTABLE_TYPES.has(b.type))
                  .map((b) => {
                    const canDecrease = b.remaining > 0
                    const canIncrease = b.remaining < b.total

                    return (
                      <div
                        key={b.type}
                        className={cn(
                          'rounded-lg border p-3',
                          LEAVE_TYPE_COLORS[b.type] ?? 'border-border bg-surface/40',
                        )}
                      >
                        <p className="mb-2 text-xs font-semibold text-ink">{b.type}</p>
                        <div className="mb-2 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Remove one ${b.type} day`}
                            disabled={!canDecrease}
                            onClick={() => openAdjustmentConfirm(b.type, -1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[4.5rem] text-center text-lg font-extrabold tabular-nums text-ink">
                            {b.remaining}/{b.total}
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Add one ${b.type} day`}
                            disabled={!canIncrease}
                            onClick={() => openAdjustmentConfirm(b.type, 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <ul className="space-y-1 text-xs text-ink">
                          <li>
                            <span className="text-muted">Pending requests:</span>{' '}
                            <strong>{b.pending}</strong> {b.pending === 1 ? 'day' : 'days'}
                          </li>
                          <li>
                            <span className="text-muted">Remaining:</span>{' '}
                            <strong>{b.remaining}</strong>{' '}
                            {b.remaining === 1 ? 'day' : 'days'}
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

      <Modal
        isOpen={Boolean(pendingAdjustment)}
        title="Confirm balance change"
        onClose={() => {
          if (savingAdjustment) return
          setPendingAdjustment(null)
        }}
        size="sm"
      >
        {pendingAdjustment ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Adjust <strong className="text-ink">{pendingAdjustment.type}</strong> for{' '}
              <strong className="text-ink">{displayName}</strong>
              {displayEmployeeId ? ` (${displayEmployeeId})` : ''}?
            </p>
            <div className="rounded-lg border border-border bg-surface/40 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Balance (remaining / total)</span>
                <span className="font-semibold text-ink">
                  {pendingAdjustment.remaining}/{pendingAdjustment.total}
                  <span className="mx-1 text-muted">→</span>
                  {pendingNextRemaining}/{pendingAdjustment.total}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-3 border-t border-border/70 pt-2">
                <span className="text-muted">Used (approved)</span>
                <span className="font-semibold text-ink">
                  {pendingAdjustment.used}
                  <span className="mx-1 text-muted">→</span>
                  {pendingNextUsed} {pendingNextUsed === 1 ? 'day' : 'days'}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={savingAdjustment}
                onClick={() => setPendingAdjustment(null)}
              >
                Cancel
              </Button>
              <Button disabled={savingAdjustment} onClick={() => void handleConfirmAdjustment()}>
                {savingAdjustment ? 'Saving…' : 'Confirm change'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
