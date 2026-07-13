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
import {
  formatLeaveDayCount,
  getLeaveBalanceAdjustmentStep,
} from '@/utils/leaveBalances'

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

type BalanceAdjustmentType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Earned Leave'
  | 'Compensation Leave'

type DraftRemainingDeltas = Partial<Record<BalanceAdjustmentType, number>>

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
  focusSection = 'balances',
  onClose,
}: {
  isOpen: boolean
  employeeId: string | null
  employeeName: string
  focusSection?: 'balances' | 'history'
  onClose: () => void
}) {
  const [summary, setSummary] = useState<EmployeeLeaveSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [draftDeltas, setDraftDeltas] = useState<DraftRemainingDeltas>({})
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const employees = useEmployeeStore((s) => s.employees)
  const fetchEmployees = useEmployeeStore((s) => s.fetchEmployees)

  const hasDraftChanges = Object.values(draftDeltas).some((value) => value !== 0)

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
      setDraftDeltas({})
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
      setDraftDeltas({})
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

  const applyDraftStep = (type: BalanceAdjustmentType, stepDelta: number) => {
    if (!summary) return
    const balance = summary.balances.find((b) => b.type === type)
    if (!balance) return

    const currentDraft = draftDeltas[type] ?? 0
    const nextRemaining = balance.remaining + currentDraft + stepDelta

    if (nextRemaining < 0) {
      toast.error('Remaining balance cannot go below zero')
      return
    }
    if (nextRemaining > balance.total) {
      toast.error('Remaining balance cannot exceed the total allotment')
      return
    }

    const nextDraft = currentDraft + stepDelta
    setDraftDeltas((prev) => {
      const next = { ...prev }
      if (nextDraft === 0) {
        delete next[type]
      } else {
        next[type] = nextDraft
      }
      return next
    })
  }

  const handleDiscardDraft = () => {
    setDraftDeltas({})
  }

  const handleSaveDraft = async () => {
    if (!employeeId || !hasDraftChanges) return

    setSavingAdjustment(true)
    try {
      const adjustments: Partial<Record<BalanceAdjustmentType, number>> = {}
      for (const [type, remainingDelta] of Object.entries(draftDeltas) as [
        BalanceAdjustmentType,
        number,
      ][]) {
        if (remainingDelta) {
          adjustments[type] = -remainingDelta
        }
      }

      const updated = await leaveService.adjustEmployeeLeaveBalances(employeeId, adjustments)
      setSummary(updated)
      setDraftDeltas({})
      toast.success('Leave balances updated')
    } catch (error) {
      console.error('[EmployeeLeaveProfile] balance adjustment failed:', error)
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update leave balances'
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
      className: 'whitespace-normal min-w-[8rem] max-w-[16rem]',
      render: (l) => (
        <span className="text-sm text-muted break-words">
          {l.reason}
        </span>
      ),
    },
  ]

  const displayName = summary?.employeeName ?? employeeName
  const profileTitle = summary?.employeeId
    ? `Leave Profile - ${displayName} (${summary.employeeId})`
    : `Leave Profile - ${displayName}`

  const handleClose = () => {
    if (savingAdjustment) return
    if (hasDraftChanges) {
      const discard = window.confirm('Discard unsaved balance changes?')
      if (!discard) return
    }
    setDraftDeltas({})
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      title={profileTitle}
      onClose={handleClose}
      size="xl"
      className="flex max-h-[min(90vh,44rem)] min-h-0 flex-col overflow-hidden"
    >
      {loading ? (
        <div className="flex min-h-[200px] flex-1 items-center justify-center">
          <span className="text-sm text-muted">Loading leave details...</span>
        </div>
      ) : summary ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
          {focusSection === 'balances' ? (
            <section className="shrink-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">Leave balances</h3>
                <span className="text-xs text-muted">
                  ±0.5 per click · save once to apply
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {summary.balances
                  .filter((b) => ADJUSTABLE_TYPES.has(b.type))
                  .map((b) => {
                    const type = b.type as BalanceAdjustmentType
                    const step = getLeaveBalanceAdjustmentStep(type)
                    const draft = draftDeltas[type] ?? 0
                    const displayRemaining = b.remaining + draft
                    const canDecrease = displayRemaining >= step
                    const canIncrease = displayRemaining + step <= b.total

                    return (
                      <div
                        key={b.type}
                        className={cn(
                          'rounded-lg border p-3',
                          LEAVE_TYPE_COLORS[b.type] ?? 'border-border bg-surface/40',
                          draft !== 0 && 'ring-2 ring-amber-300/80',
                        )}
                      >
                        <p className="mb-2 text-xs font-semibold text-ink">{b.type}</p>
                        <div className="mb-2 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Remove ${step} ${b.type} day`}
                            disabled={!canDecrease || savingAdjustment}
                            onClick={() => applyDraftStep(type, -step)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[4.5rem] text-center text-lg font-extrabold tabular-nums text-ink">
                            {formatLeaveDayCount(displayRemaining)}/{formatLeaveDayCount(b.total)}
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Add ${step} ${b.type} day`}
                            disabled={!canIncrease || savingAdjustment}
                            onClick={() => applyDraftStep(type, step)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <ul className="space-y-1 text-xs text-ink">
                          <li>
                            <span className="text-muted">Pending requests:</span>{' '}
                            <strong>{formatLeaveDayCount(b.pending)}</strong> days
                          </li>
                          <li>
                            <span className="text-muted">Remaining:</span>{' '}
                            <strong>{formatLeaveDayCount(displayRemaining)}</strong> days
                            {draft !== 0 ? (
                              <span className="ml-1 text-amber-700">
                                (was {formatLeaveDayCount(b.remaining)})
                              </span>
                            ) : null}
                          </li>
                        </ul>
                      </div>
                    )
                  })}
              </div>

              {hasDraftChanges ? (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <span className="mr-auto text-xs text-amber-900">
                    Unsaved changes — click Save to apply all adjustments at once.
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={savingAdjustment}
                    onClick={handleDiscardDraft}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingAdjustment}
                    onClick={() => void handleSaveDraft()}
                  >
                    {savingAdjustment ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

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
