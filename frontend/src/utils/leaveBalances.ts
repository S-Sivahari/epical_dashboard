export type LeaveBalanceBucket = {
  total: number
  used: number
  remaining: number
  approved?: number
  pending?: number
}

export type FormattedLeaveBalance = {
  key: string
  type: string
  used: number
  total: number
  remaining: number
  pending?: number
  approved?: number
  color: string
  isLop?: boolean
}

export const LEAVE_BALANCE_COLORS: Record<string, string> = {
  'Casual Leave': '#3d7a6a',
  'Sick Leave': '#4a7a9a',
  'Earned Leave': '#6b5b8a',
  'Compensation Leave': '#c27803',
  'LOP Days': '#64748b',
}

/** All leave balance admin adjustments use half-day steps. */
export const LEAVE_BALANCE_STEP = 0.5

/** @deprecated Use LEAVE_BALANCE_STEP */
export const EARNED_LEAVE_BALANCE_STEP = LEAVE_BALANCE_STEP

export function getLeaveBalanceAdjustmentStep(_type?: string): number {
  return LEAVE_BALANCE_STEP
}

export function formatLeaveDayCount(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function isLeaveBalanceStepMultiple(value: number, step: number): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return false
  const ratio = value / step
  return Math.abs(ratio - Math.round(ratio)) < 1e-9
}

const DEFAULT_TOTALS: Record<string, number | undefined> = {
  'Casual Leave': 12,
  'Sick Leave': 6,
  'Earned Leave': 0,
  'Compensation Leave': 0,
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function readBucket(
  data: Record<string, LeaveBalanceBucket | undefined>,
  type: string,
): { total: number; used: number; remaining: number; pending?: number; approved?: number } {
  const bucket = data[type]
  const defaultTotal = DEFAULT_TOTALS[type] ?? 0
  const total = bucket?.total !== undefined ? toNumber(bucket.total, defaultTotal) : defaultTotal
  const used = toNumber(bucket?.used, 0)
  const remaining =
    bucket?.remaining !== undefined
      ? toNumber(bucket.remaining, Math.max(0, total - used))
      : Math.max(0, total - used)
  const pending = bucket?.pending !== undefined ? toNumber(bucket.pending, 0) : undefined
  const approved = bucket?.approved !== undefined ? toNumber(bucket.approved, 0) : undefined

  return { total, used, remaining, pending, approved }
}

/** Normalize API balance payload for UI tiles/cards. Compensation always defaults to 0 until admin credits. */
export function formatLeaveBalances(
  data: Record<string, LeaveBalanceBucket | undefined> = {},
  options: { includeLop?: boolean } = {},
): FormattedLeaveBalance[] {
  const { includeLop = false } = options

  const items: FormattedLeaveBalance[] = [
    {
      key: 'casual',
      type: 'Casual Leave',
      ...readBucket(data, 'Casual Leave'),
      color: LEAVE_BALANCE_COLORS['Casual Leave'],
    },
    {
      key: 'sick',
      type: 'Sick Leave',
      ...readBucket(data, 'Sick Leave'),
      color: LEAVE_BALANCE_COLORS['Sick Leave'],
    },
    {
      key: 'earned',
      type: 'Earned Leave',
      ...readBucket(data, 'Earned Leave'),
      color: LEAVE_BALANCE_COLORS['Earned Leave'],
    },
    {
      key: 'compensation',
      type: 'Compensation Leave',
      ...readBucket(data, 'Compensation Leave'),
      color: LEAVE_BALANCE_COLORS['Compensation Leave'],
    },
  ]

  if (includeLop) {
    const lopBucket = data['LOP Days']
    const lopUsed = toNumber(lopBucket?.used, 0)
    const lopApproved = toNumber(lopBucket?.approved, 0)
    const lopPending = toNumber(lopBucket?.pending, 0)
    items.push({
      key: 'lop',
      type: 'LOP Days',
      used: lopUsed,
      total: Math.max(lopUsed, 1),
      remaining: 0,
      approved: lopApproved,
      pending: lopPending,
      color: LEAVE_BALANCE_COLORS['LOP Days'],
      isLop: true,
    })
  }

  return items
}

export function findLeaveBalance(
  balances: FormattedLeaveBalance[],
  key: string,
): FormattedLeaveBalance | undefined {
  return balances.find((b) => b.key === key)
}

/** Map leave request type to `/leaves/balances` response key. */
export function resolveLeaveBalanceApiKey(leaveType: string): string {
  if (leaveType === 'LOP') return 'LOP Days'
  return leaveType
}

export function isLopLeaveType(leaveType: string): boolean {
  return leaveType === 'LOP'
}
