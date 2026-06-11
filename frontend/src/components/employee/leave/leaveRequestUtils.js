export function balanceTileLabel(balance) {
  if (balance.isLop || balance.key === 'lop') return 'LOP'
  return String(balance.type || '')
    .replace(' Leave', '')
    .replace(' Days', '')
    .trim()
}

export function getVisiblePageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
}

export function formatAppliedDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

export function formatLeaveDayCount(row) {
  if (typeof row.days === 'string' && String(row.days).startsWith('+')) return row.days
  if (row.leaveDuration === 'Half Day') return 0.5
  const days = Number(row.days)
  return Number.isNaN(days) ? row.days : days
}

export function isBalanceActive(balance) {
  if (balance.isLop) return balance.used > 0
  return balance.remaining > 0
}

export function formatBalanceAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n
}

export function getBalanceRemainingTone(remaining) {
  const n = Number(remaining)
  if (!Number.isFinite(n) || n < 2) return 'low'
  if (n <= 9) return 'mid'
  return 'high'
}
