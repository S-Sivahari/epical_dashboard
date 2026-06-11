/** Keep only digits and at most one decimal point (e.g. "12.5", ".5", "12."). */
export function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dotIndex = cleaned.indexOf('.')
  if (dotIndex === -1) return cleaned
  const before = cleaned.slice(0, dotIndex + 1)
  const after = cleaned.slice(dotIndex + 1).replace(/\./g, '')
  return before + after
}

export function isValidDecimalInput(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '.') return false
  if (!/^\d*\.?\d*$/.test(trimmed)) return false
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) && numeric >= 0
}
