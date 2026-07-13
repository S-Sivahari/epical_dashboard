function titleCaseWords(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

/** Title-case each word in a person name for payslip display and export file names. */
export function formatPayslipPersonName(value: unknown): string {
  return titleCaseWords(String(value ?? ''))
}

/** Title-case each word, then slugify for payslip PDF file names (employee name segment). */
export function sanitizeExportPersonName(value: string, fallback = 'employee'): string {
  const titled = titleCaseWords(value)
  const cleaned = titled
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return (cleaned || fallback).slice(0, 72)
}
