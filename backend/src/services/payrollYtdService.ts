import { getDB } from '../config/db'
import type { Company, Employee, SalaryStructure } from './payslipGenerator'
import { buildDeductionsData, buildEarningsData } from './payslipGenerator'
import { enrichPayrollEmployeeFromDb } from './payslipEmployeeEnrichment'

const MONTH_PATTERNS: { re: RegExp; month: number }[] = [
  { re: /\bjanuary\b/i, month: 1 },
  { re: /\bfebruary\b/i, month: 2 },
  { re: /\bmarch\b/i, month: 3 },
  { re: /\bapril\b/i, month: 4 },
  { re: /\bmay\b/i, month: 5 },
  { re: /\bjune\b/i, month: 6 },
  { re: /\bjuly\b/i, month: 7 },
  { re: /\baugust\b/i, month: 8 },
  { re: /\bseptember\b/i, month: 9 },
  { re: /\boctober\b/i, month: 10 },
  { re: /\bnovember\b/i, month: 11 },
  { re: /\bdecember\b/i, month: 12 },
  { re: /\bjan\b/i, month: 1 },
  { re: /\bfeb\b/i, month: 2 },
  { re: /\bmar\b/i, month: 3 },
  { re: /\bapr\b/i, month: 4 },
  { re: /\bjun\b/i, month: 6 },
  { re: /\bjul\b/i, month: 7 },
  { re: /\baug\b/i, month: 8 },
  { re: /\bsep\b/i, month: 9 },
  { re: /\boct\b/i, month: 10 },
  { re: /\bnov\b/i, month: 11 },
  { re: /\bdec\b/i, month: 12 },
]

export interface PayPeriod {
  year: number
  month: number
  label: string
  /** Calendar year when FY starts (April of this year). Resets after each March. */
  fiscalYearStart: number
}

export interface PayrollMonthlySnapshot {
  id: string
  employeeId: string
  fiscalYearStart: number
  payYear: number
  payMonth: number
  payMonthLabel: string
  batchId: string
  components: Record<string, number>
  uploadedAt: Date
}

function monthlyCollection() {
  return getDB().collection<PayrollMonthlySnapshot>('payroll_monthly_snapshots')
}

function detectMonthFromText(text: string): number | null {
  for (const { re, month } of MONTH_PATTERNS) {
    if (re.test(text)) return month
  }
  return null
}

function parseYearMonthFromDateString(text: string): { year: number; month: number } | null {
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  const m = text.match(/(\d{1,2})[-/](\w{3,9})[-/](\d{2,4})/i)
  if (m) {
    const month = detectMonthFromText(m[2])
    if (month) {
      let year = parseInt(m[3], 10)
      if (year < 100) year += 2000
      return { year, month }
    }
  }
  return null
}

/** Parse Pay Month / Pay Date from company sheet into calendar year + month. */
export function parsePayPeriodFromCompany(company: Company): PayPeriod {
  const label = String(company['Pay Month'] ?? '').trim()
  const payDate = String(company['Pay Date'] ?? '').trim()

  let year = new Date().getFullYear()
  let month: number | null = null

  if (label) {
    const yMatch = label.match(/\b(20\d{2})\b/)
    if (yMatch) year = parseInt(yMatch[1], 10)
    month = detectMonthFromText(label)
  }

  if (month === null && payDate) {
    const fromDate = parseYearMonthFromDateString(payDate)
    if (fromDate) {
      year = fromDate.year
      month = fromDate.month
    }
  }

  if (month === null) {
    month = new Date().getMonth() + 1
  }

  const fiscalYearStart = month >= 4 ? year : year - 1

  return {
    year,
    month,
    label: label || `${MONTH_PATTERNS.find((p) => p.month === month)?.re.source ?? 'Month'} ${year}`,
    fiscalYearStart,
  }
}

function nextCalendarMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

/** FY runs Apr → Mar. Returns all FY months from April through payMonth (inclusive). */
export function fiscalMonthsThrough(period: PayPeriod): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = []
  let y = period.fiscalYearStart
  let m = 4

  for (;;) {
    out.push({ year: y, month: m })
    if (y === period.year && m === period.month) break
    const n = nextCalendarMonth(y, m)
    y = n.year
    m = n.month
    if (y === period.fiscalYearStart + 1 && m === 4) break
  }

  return out
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function collectComponentAmounts(
  emp: Employee,
  structure: SalaryStructure
): Record<string, number> {
  const { earnings } = buildEarningsData(emp, structure)
  const { deductions } = buildDeductionsData(emp, structure)
  const map: Record<string, number> = {}

  for (const e of earnings) {
    map[e.name] = round2((map[e.name] ?? 0) + e.amount)
  }
  for (const d of deductions) {
    if (d.name === 'Loss of Pay') continue
    map[d.name] = round2((map[d.name] ?? 0) + d.amount)
  }

  const lopDays = parseFloat(String(emp['LOP Days'] ?? 0)) || 0
  const lopAmt = parseFloat(String(emp['Loss of Pay'] ?? 0)) || 0
  if (lopAmt > 0 || lopDays > 0) {
    map['Loss of Pay'] = round2(lopAmt)
  }

  return map
}

/** Persist this month's component amounts (re-upload replaces same month). */
export async function saveMonthlyPayrollSnapshot(params: {
  employeeId: string
  batchId: string
  period: PayPeriod
  components: Record<string, number>
}): Promise<void> {
  const col = monthlyCollection()
  const employeeId = params.employeeId.trim().toUpperCase()
  const filter = {
    employeeId,
    payYear: params.period.year,
    payMonth: params.period.month,
  }

  const doc: PayrollMonthlySnapshot = {
    id: `${employeeId}_${monthKey(params.period.year, params.period.month)}`,
    employeeId,
    fiscalYearStart: params.period.fiscalYearStart,
    payYear: params.period.year,
    payMonth: params.period.month,
    payMonthLabel: params.period.label,
    batchId: params.batchId,
    components: params.components,
    uploadedAt: new Date(),
  }

  await col.updateOne(filter, { $set: doc }, { upsert: true })
}

/** Sum stored monthly amounts for current FY through pay month (Apr–Mar, resets each April). */
export async function computeCumulativeYtd(
  employeeId: string,
  period: PayPeriod
): Promise<Record<string, number>> {
  const col = monthlyCollection()
  const empKey = employeeId.trim().toUpperCase()
  const allowed = new Set(
    fiscalMonthsThrough(period).map((m) => monthKey(m.year, m.month))
  )

  const snapshots = await col
    .find({
      employeeId: empKey,
      fiscalYearStart: period.fiscalYearStart,
    })
    .toArray()

  const ytd: Record<string, number> = {}

  for (const snap of snapshots) {
    const key = monthKey(snap.payYear, snap.payMonth)
    if (!allowed.has(key)) continue
    for (const [comp, amt] of Object.entries(snap.components ?? {})) {
      ytd[comp] = round2((ytd[comp] ?? 0) + amt)
    }
  }

  return ytd
}

/**
 * Enrich employee from HR DB, save this month's payroll snapshot, attach cumulative YTD map for PDF.
 */
export async function prepareEmployeeForPayslip(
  company: Company,
  structure: SalaryStructure,
  emp: Employee,
  batchId: string
): Promise<Employee> {
  const enriched = await enrichPayrollEmployeeFromDb(emp)
  const period = parsePayPeriodFromCompany(company)
  const components = collectComponentAmounts(enriched, structure)

  await saveMonthlyPayrollSnapshot({
    employeeId: String(enriched['Emp ID'] || ''),
    batchId,
    period,
    components,
  })

  const ytdMap = await computeCumulativeYtd(String(enriched['Emp ID'] || ''), period)
  enriched['_componentYtd'] = ytdMap
  enriched['_payPeriod'] = period

  return enriched
}

export function getStoredYtd(emp: Employee, componentName: string, currentMonthAmount: number): number {
  const ytdMap = emp['_componentYtd'] as Record<string, number> | undefined
  if (ytdMap && componentName in ytdMap) {
    return ytdMap[componentName]
  }
  return round2(currentMonthAmount)
}
