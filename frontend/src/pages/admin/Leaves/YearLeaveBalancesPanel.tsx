import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { History, Minus, Plus, Search } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  formatLeaveDayCount,
  getLeaveBalanceAdjustmentStep,
} from '@/utils/leaveBalances'
import * as leaveService from '@services/leaveService'
import type { LeaveTypeBalanceSummary, YearLeaveBalanceRow } from '@/types'

const LEAVE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'Earned Leave',
  'Compensation Leave',
] as const

const LEAVE_CARD_CLASS: Record<string, string> = {
  'Casual Leave': 'admin-leaves-balance-card--casual',
  'Sick Leave': 'admin-leaves-balance-card--sick',
  'Earned Leave': 'admin-leaves-balance-card--earned',
  'Compensation Leave': 'admin-leaves-balance-card--comp',
  LOP: 'admin-leaves-balance-card--lop',
}

type YearLeaveBalancesPanelProps = {
  active: boolean
  onOpenLeaveHistory?: (employeeId: string, employeeName: string) => void
  onAllocationUpdated?: () => void
}

function draftKey(internalId: string, type: string) {
  return `${internalId}:${type}`
}

function LeaveBalanceCard({
  balance,
  canEditTotal,
  saving,
  totalDraftDelta,
  onAdjustTotal,
}: {
  balance: LeaveTypeBalanceSummary
  canEditTotal: boolean
  saving: boolean
  totalDraftDelta: number
  onAdjustTotal: (delta: number) => void
}) {
  const step = getLeaveBalanceAdjustmentStep(balance.type)
  const displayTotal = balance.total + totalDraftDelta
  const displayRemaining = displayTotal - balance.used
  const canDecrease = canEditTotal && displayTotal - step >= balance.used
  const canIncrease = canEditTotal && !saving

  return (
    <div
      className={cn(
        'admin-leaves-balance-card',
        LEAVE_CARD_CLASS[balance.type],
        totalDraftDelta !== 0 && 'ring-2 ring-amber-300/80',
      )}
    >
      <p className="admin-leaves-balance-card__title">{balance.type}</p>
      {canEditTotal ? (
        <div className="admin-leaves-balance-card__controls">
          <button
            type="button"
            className="admin-leaves-balance-card__btn"
            aria-label={`Decrease ${balance.type} total by ${step}`}
            disabled={!canDecrease || saving}
            onClick={() => onAdjustTotal(-step)}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="admin-leaves-balance-card__value">
            {formatLeaveDayCount(displayTotal)}
          </span>
          <button
            type="button"
            className="admin-leaves-balance-card__btn"
            aria-label={`Increase ${balance.type} total by ${step}`}
            disabled={!canIncrease}
            onClick={() => onAdjustTotal(step)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="admin-leaves-balance-card__controls admin-leaves-balance-card__controls--static">
          <span className="admin-leaves-balance-card__value">{formatLeaveDayCount(balance.total)}</span>
        </div>
      )}
      <ul className="admin-leaves-balance-card__meta">
        <li>
          <span>Used:</span> <strong>{formatLeaveDayCount(balance.used)}</strong> days
        </li>
        <li>
          <span>Remaining:</span> <strong>{formatLeaveDayCount(displayRemaining)}</strong> days
          {totalDraftDelta !== 0 ? (
            <span className="ml-1 text-amber-700">
              (was {formatLeaveDayCount(balance.remaining)})
            </span>
          ) : null}
        </li>
        <li className="admin-leaves-balance-card__meta-month">
          <span>Availed this month:</span>{' '}
          <strong>{formatLeaveDayCount(balance.usedThisMonth ?? 0)}</strong> days
        </li>
      </ul>
    </div>
  )
}

export function YearLeaveBalancesPanel({
  active,
  onOpenLeaveHistory,
  onAllocationUpdated,
}: YearLeaveBalancesPanelProps) {
  const currentYear = new Date().getFullYear()
  const [rows, setRows] = useState<YearLeaveBalanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [draftTotalDeltas, setDraftTotalDeltas] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')

  const loadBalances = useCallback(async (selectedYear: number) => {
    setLoading(true)
    try {
      const data = await leaveService.getYearLeaveBalances(selectedYear)
      setRows(data.employees)
      setDraftTotalDeltas({})
    } catch (error) {
      console.error('[YearLeaveBalances] load failed:', error)
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load yearly leave balances'
      toast.error(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    void loadBalances(currentYear)
  }, [active, currentYear, loadBalances])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.employeeName.toLowerCase().includes(q) ||
        row.employeeId.toLowerCase().includes(q) ||
        (row.department ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const canEditTotal = (type: string) => type !== 'Compensation Leave'

  const rowHasDraft = (internalId: string) =>
    LEAVE_TYPES.some((type) => (draftTotalDeltas[draftKey(internalId, type)] ?? 0) !== 0)

  const applyTotalDraftStep = (
    row: YearLeaveBalanceRow,
    type: (typeof LEAVE_TYPES)[number],
    delta: number,
  ) => {
    const balance = row.balances.find((item) => item.type === type)
    if (!balance || !canEditTotal(type)) return

    const key = draftKey(row.internalId, type)
    const currentDraft = draftTotalDeltas[key] ?? 0
    const nextTotal = balance.total + currentDraft + delta

    if (nextTotal < balance.used) {
      toast.error(`${type} total cannot be less than used days (${formatLeaveDayCount(balance.used)})`)
      return
    }
    if (nextTotal < 0) {
      toast.error('Total must be a non-negative number')
      return
    }

    const nextDraft = currentDraft + delta
    setDraftTotalDeltas((prev) => {
      const next = { ...prev }
      if (nextDraft === 0) {
        delete next[key]
      } else {
        next[key] = nextDraft
      }
      return next
    })
  }

  const discardRowDraft = (internalId: string) => {
    setDraftTotalDeltas((prev) => {
      const next = { ...prev }
      for (const type of LEAVE_TYPES) {
        delete next[draftKey(internalId, type)]
      }
      return next
    })
  }

  const handleSaveRow = async (row: YearLeaveBalanceRow) => {
    if (!rowHasDraft(row.internalId)) return

    const updates = LEAVE_TYPES.flatMap((type) => {
      if (!canEditTotal(type)) return []
      const key = draftKey(row.internalId, type)
      const delta = draftTotalDeltas[key] ?? 0
      if (delta === 0) return []
      const balance = row.balances.find((item) => item.type === type)
      if (!balance) return []
      return [{ type, total: balance.total + delta }]
    })

    if (updates.length === 0) return

    setSavingRowId(row.internalId)
    try {
      const updated = await leaveService.updateEmployeeYearLeaveBalances(
        row.internalId,
        currentYear,
        updates,
      )
      setRows((prev) =>
        prev.map((item) => (item.internalId === updated.internalId ? updated : item)),
      )
      discardRowDraft(row.internalId)
      onAllocationUpdated?.()
      toast.success(`Updated leave totals for ${row.employeeName}`)
    } catch (error) {
      console.error('[YearLeaveBalances] save failed:', error)
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update leave totals'
      toast.error(message)
    } finally {
      setSavingRowId(null)
    }
  }

  if (!active) return null

  return (
    <div className="admin-leaves-year-balances-panel">
      <div className="admin-leaves-year-balances-search-wrap">
        <div className="admin-leaves-year-balances-search-field">
          <Search className="admin-leaves-year-balances-search-icon" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or department..."
            className="admin-leaves-year-balances-search"
          />
        </div>
        {!loading ? (
          <span className="admin-leaves-year-balances-count" aria-live="polite">
            {filteredRows.length}
            {search.trim() ? ` of ${rows.length}` : ''} employee
            {(search.trim() ? filteredRows.length : rows.length) === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <div className="admin-leaves-year-balances-list admin-leaves-scroll">
        {loading ? (
          <div className="admin-leaves-year-balances-empty">Loading yearly balances...</div>
        ) : filteredRows.length === 0 ? (
          <div className="admin-leaves-year-balances-empty">No employees match your search.</div>
        ) : (
          filteredRows.map((row) => {
            const hasDraft = rowHasDraft(row.internalId)
            const saving = savingRowId === row.internalId

            return (
              <article key={row.internalId} className="admin-leaves-year-balances-row">
                <div className="admin-leaves-year-balances-employee">
                  <p className="admin-leaves-year-balances-employee-name">{row.employeeName}</p>
                  <p className="admin-leaves-year-balances-employee-id">{row.employeeId}</p>
                  {row.department ? (
                    <p className="admin-leaves-year-balances-employee-dept">{row.department}</p>
                  ) : null}
                </div>

                <div className="admin-leaves-year-balances-cards">
                  {LEAVE_TYPES.map((type) => {
                    const balance = row.balances.find((item) => item.type === type) ?? {
                      type,
                      total: 0,
                      used: 0,
                      pending: 0,
                      remaining: 0,
                    }
                    const key = draftKey(row.internalId, type)

                    return (
                      <LeaveBalanceCard
                        key={type}
                        balance={balance}
                        canEditTotal={canEditTotal(type)}
                        saving={saving}
                        totalDraftDelta={draftTotalDeltas[key] ?? 0}
                        onAdjustTotal={(delta) => applyTotalDraftStep(row, type, delta)}
                      />
                    )
                  })}

                  <div
                    className={cn('admin-leaves-balance-card', LEAVE_CARD_CLASS.LOP)}
                    aria-label="LOP days"
                  >
                    <p className="admin-leaves-balance-card__title">LOP</p>
                    <div className="admin-leaves-balance-card__controls admin-leaves-balance-card__controls--static">
                      <span className="admin-leaves-balance-card__value admin-leaves-balance-card__value--lop">
                        {formatLeaveDayCount(row.lopDays ?? 0)}
                      </span>
                    </div>
                    <ul className="admin-leaves-balance-card__meta">
                      <li className="admin-leaves-balance-card__meta-month">
                        <span>Availed this month:</span>{' '}
                        <strong>{formatLeaveDayCount(row.lopThisMonth ?? 0)}</strong> days
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="admin-leaves-year-balances-actions flex flex-col gap-2">
                  {hasDraft ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="admin-leaves-year-history-btn border-amber-300 bg-amber-50 text-amber-900"
                        disabled={saving}
                        onClick={() => void handleSaveRow(row)}
                      >
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        className="admin-leaves-year-history-btn"
                        disabled={saving}
                        onClick={() => discardRowDraft(row.internalId)}
                      >
                        Discard
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="admin-leaves-year-history-btn"
                    onClick={() => onOpenLeaveHistory?.(row.internalId, row.employeeName)}
                  >
                    <History className="h-4 w-4" />
                    Leave history
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
