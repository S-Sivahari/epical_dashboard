import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { History, Minus, Plus, Search } from 'lucide-react'
import { cn } from '@/utils/cn'
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
}

type YearLeaveBalancesPanelProps = {
  active: boolean
  onOpenLeaveHistory?: (employeeId: string, employeeName: string) => void
  onAllocationUpdated?: () => void
}

function LeaveBalanceCard({
  balance,
  canEditTotal,
  saving,
  onAdjustTotal,
}: {
  balance: LeaveTypeBalanceSummary
  canEditTotal: boolean
  saving: boolean
  onAdjustTotal: (delta: number) => void
}) {
  const canDecrease = canEditTotal && balance.total > balance.used
  const canIncrease = canEditTotal && !saving

  return (
    <div
      className={cn(
        'admin-leaves-balance-card',
        LEAVE_CARD_CLASS[balance.type],
      )}
    >
      <p className="admin-leaves-balance-card__title">{balance.type}</p>
      <div className="admin-leaves-balance-card__controls">
        <button
          type="button"
          className="admin-leaves-balance-card__btn"
          aria-label={`Decrease ${balance.type} total`}
          disabled={!canDecrease || saving}
          onClick={() => onAdjustTotal(-1)}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="admin-leaves-balance-card__value">
          {balance.total}
        </span>
        <button
          type="button"
          className="admin-leaves-balance-card__btn"
          aria-label={`Increase ${balance.type} total`}
          disabled={!canIncrease}
          onClick={() => onAdjustTotal(1)}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="admin-leaves-balance-card__meta">
        <li>
          <span>Used:</span> <strong>{balance.used}</strong>{' '}
          {balance.used === 1 ? 'day' : 'days'}
        </li>
        <li>
          <span>Remaining:</span> <strong>{balance.remaining}</strong>{' '}
          {balance.remaining === 1 ? 'day' : 'days'}
        </li>
        <li className="admin-leaves-balance-card__meta-month">
          <span>Used this month:</span>{' '}
          <strong>{balance.usedThisMonth ?? 0}</strong>{' '}
          {(balance.usedThisMonth ?? 0) === 1 ? 'day' : 'days'}
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
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const loadBalances = useCallback(async (selectedYear: number) => {
    setLoading(true)
    try {
      const data = await leaveService.getYearLeaveBalances(selectedYear)
      setRows(data.employees)
    } catch (error) {
      console.error('[YearLeaveBalances] load failed:', error)
      toast.error('Failed to load yearly leave balances')
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

  const canEditTotal = (type: string) =>
    type !== 'Compensation Leave'

  const handleAdjustTotal = async (
    row: YearLeaveBalanceRow,
    type: (typeof LEAVE_TYPES)[number],
    delta: number,
  ) => {
    const balance = row.balances.find((item) => item.type === type)
    if (!balance || !canEditTotal(type)) return

    const nextTotal = balance.total + delta
    if (nextTotal < balance.used) {
      toast.error(`${type} total cannot be less than used days (${balance.used})`)
      return
    }
    if (nextTotal < 0) {
      toast.error('Total must be a non-negative number')
      return
    }
    if (nextTotal === balance.total) return

    const saveKey = `${row.internalId}:${type}`
    setSavingKey(saveKey)
    try {
      const updated = await leaveService.updateEmployeeYearLeaveBalances(row.internalId, currentYear, [
        { type, total: nextTotal },
      ])
      setRows((prev) =>
        prev.map((item) => (item.internalId === updated.internalId ? updated : item)),
      )
      onAllocationUpdated?.()
      toast.success(`Updated ${type} total for ${row.employeeName}`)
    } catch (error) {
      console.error('[YearLeaveBalances] save failed:', error)
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update leave total'
      toast.error(message)
    } finally {
      setSavingKey(null)
    }
  }

  if (!active) return null

  return (
    <div className="admin-leaves-year-balances-panel">
      <div className="admin-leaves-year-balances-toolbar">
        <h3 className="admin-leaves-year-balances-title">View Balance</h3>
      </div>

      <div className="admin-leaves-year-balances-search-wrap">
        <Search className="admin-leaves-year-balances-search-icon" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, or department..."
          className="admin-leaves-year-balances-search"
        />
      </div>

      <div className="admin-leaves-year-balances-list admin-leaves-scroll">
        {loading ? (
          <div className="admin-leaves-year-balances-empty">Loading yearly balances...</div>
        ) : filteredRows.length === 0 ? (
          <div className="admin-leaves-year-balances-empty">No employees match your search.</div>
        ) : (
          filteredRows.map((row) => (
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
                  const saving = savingKey === `${row.internalId}:${type}`

                  return (
                    <LeaveBalanceCard
                      key={type}
                      balance={balance}
                      canEditTotal={canEditTotal(type)}
                      saving={saving}
                      onAdjustTotal={(delta) => void handleAdjustTotal(row, type, delta)}
                    />
                  )
                })}
              </div>

              <div className="admin-leaves-year-balances-lop" aria-label="LOP days">
                <p className="admin-leaves-year-balances-lop__title">LOP days</p>
                <p className="admin-leaves-year-balances-lop__value">{row.lopDays ?? 0}</p>
                <ul className="admin-leaves-year-balances-lop__meta">
                  <li>
                    <span>Approved:</span> <strong>{row.lopApproved ?? 0}</strong>
                  </li>
                </ul>
              </div>

              <div className="admin-leaves-year-balances-actions">
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
          ))
        )}
      </div>
    </div>
  )
}
