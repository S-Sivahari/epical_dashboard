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

const DEFAULT_TOTALS: Record<string, number | undefined> = {
  'Casual Leave': 12,
  'Sick Leave': 12,
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
): { total: number; used: number; remaining: number } {
  const bucket = data[type]
  const defaultTotal = DEFAULT_TOTALS[type] ?? 0
  const total = bucket?.total !== undefined ? toNumber(bucket.total, defaultTotal) : defaultTotal
  const used = toNumber(bucket?.used, 0)
  const remaining =
    bucket?.remaining !== undefined
      ? toNumber(bucket.remaining, Math.max(0, total - used))
      : Math.max(0, total - used)

  return { total, used, remaining }
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
    const lopUsed = toNumber(data['LOP Days']?.used, 0)
    items.push({
      key: 'lop',
      type: 'LOP Days',
      used: lopUsed,
      total: Math.max(lopUsed, 1),
      remaining: 0,
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
