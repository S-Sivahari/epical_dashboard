import { getDB } from '../config/db'
import type { Company, Employee, SalaryStructure } from './payslipGenerator'
import { buildDeductionsData, buildEarningsData } from './payslipGenerator'
import { enrichPayrollEmployeeFromDb, enrichPayrollEmployeeLeaveBalances } from './payslipEmployeeEnrichment'

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
  /** Calendar year of April that starts this FY (Apr–Mar). YTD resets on the first April upload. */
  fiscalYearStart: number
}

const FY_START_MONTH = 4

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

/** Prefer the longest month token (e.g. "march" over "mar") to avoid mis-reading labels. */
function detectMonthFromText(text: string): number | null {
  let best: { month: number; len: number } | null = null
  for (const { re, month } of MONTH_PATTERNS) {
    const m = re.exec(text)
    if (!m) continue
    const len = m[0].length
    if (!best || len > best.len) best = { month, len }
  }
  return best?.month ?? null
}

function parseNumericMonthFromLabel(label: string): { year: number; month: number } | null {
  const mFirst = label.match(/\b(0?[1-9]|1[0-2])\D{0,4}(20\d{2})\b/)
  if (mFirst) {
    return { month: parseInt(mFirst[1], 10), year: parseInt(mFirst[2], 10) }
  }
  const yFirst = label.match(/\b(20\d{2})\D{0,4}(0?[1-9]|1[0-2])\b/)
  if (yFirst) {
    return { month: parseInt(yFirst[2], 10), year: parseInt(yFirst[1], 10) }
  }
  return null
}

export function getFiscalYearStart(year: number, month: number): number {
  return month >= FY_START_MONTH ? year : year - 1
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
    if (month === null) {
      const numeric = parseNumericMonthFromLabel(label)
      if (numeric) {
        year = numeric.year
        month = numeric.month
      }
    }
  }

  if (month === null && payDate) {
    const fromDate = parseYearMonthFromDateString(payDate)
    if (fromDate) {
      year = fromDate.year
      month = fromDate.month
    }
  }

  if (month === null) {
    throw new Error(
      'Could not determine pay month from the Excel company sheet. Set "Pay Month" (e.g. April 2026) or a valid "Pay Date".'
    )
  }

  const fiscalYearStart = getFiscalYearStart(year, month)

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
  let m = FY_START_MONTH
  const fyEndYear = period.fiscalYearStart + 1
  const fyEndMonth = 3

  for (let guard = 0; guard < 14; guard++) {
    out.push({ year: y, month: m })
    if (y === period.year && m === period.month) return out
    const n = nextCalendarMonth(y, m)
    y = n.year
    m = n.month
    if (y > fyEndYear || (y === fyEndYear && m > fyEndMonth)) return out
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

/** On April payroll, drop prior FY snapshots so YTD cannot carry into the new year. */
export async function purgePriorFiscalYearSnapshots(
  employeeId: string,
  period: PayPeriod
): Promise<void> {
  if (period.month !== FY_START_MONTH) return
  const empKey = employeeId.trim().toUpperCase()
  await monthlyCollection().deleteMany({
    employeeId: empKey,
    fiscalYearStart: { $lt: period.fiscalYearStart },
  })
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

/**
 * Sum component amounts for the financial year (April–March) through the pay month.
 * Example: June FY26-27 = April + May + June (each prior uploaded month + this upload).
 */
export async function computeCumulativeYtd(
  employeeId: string,
  period: PayPeriod,
  currentMonthComponents?: Record<string, number>
): Promise<Record<string, number>> {
  const col = monthlyCollection()
  const empKey = employeeId.trim().toUpperCase()
  const allowedMonths = fiscalMonthsThrough(period)
  const allowed = new Set(allowedMonths.map((m) => monthKey(m.year, m.month)))
  const currentKey = monthKey(period.year, period.month)

  const snapshots = await col
    .find({
      employeeId: empKey,
      fiscalYearStart: period.fiscalYearStart,
      payYear: { $in: [...new Set(allowedMonths.map((m) => m.year))] },
    })
    .toArray()

  const ytd: Record<string, number> = {}

  for (const snap of snapshots) {
    const key = monthKey(snap.payYear, snap.payMonth)
    if (!allowed.has(key)) continue
    // Current month comes from this upload's row (not a stale snapshot).
    if (key === currentKey && currentMonthComponents) continue
    for (const [comp, amt] of Object.entries(snap.components ?? {})) {
      ytd[comp] = round2((ytd[comp] ?? 0) + amt)
    }
  }

  if (currentMonthComponents) {
    for (const [comp, amt] of Object.entries(currentMonthComponents)) {
      ytd[comp] = round2((ytd[comp] ?? 0) + amt)
    }
  }

  return ytd
}

const FY_SNAPSHOT_RESET_KEY = 'payrollFySnapshotGlobalReset'

/** After March 31, purge all prior-FY payroll snapshots once April begins (YTD resets). */
export async function ensureFinancialYearSnapshotReset(refDate = new Date()): Promise<void> {
  const month = refDate.getMonth() + 1
  if (month !== FY_START_MONTH) return

  const fiscalYearStart = getFiscalYearStart(refDate.getFullYear(), month)
  const settings = getDB().collection('app_settings')
  const last = await settings.findOne({ key: FY_SNAPSHOT_RESET_KEY })
  if (last?.value === String(fiscalYearStart)) return

  const result = await monthlyCollection().deleteMany({
    fiscalYearStart: { $lt: fiscalYearStart },
  })

  await settings.updateOne(
    { key: FY_SNAPSHOT_RESET_KEY },
    { $set: { key: FY_SNAPSHOT_RESET_KEY, value: String(fiscalYearStart), updatedAt: new Date() } },
    { upsert: true },
  )

  if (result.deletedCount > 0) {
    console.log(
      `[PayrollYTD] New financial year ${fiscalYearStart}: purged ${result.deletedCount} prior-FY monthly snapshot(s)`,
    )
  }
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
  const enriched = await enrichPayrollEmployeeLeaveBalances(await enrichPayrollEmployeeFromDb(emp))
  const period = parsePayPeriodFromCompany(company)
  const components = collectComponentAmounts(enriched, structure)
  const employeeId = String(enriched['Emp ID'] || '').trim()

  if (employeeId) {
    await purgePriorFiscalYearSnapshots(employeeId, period)
  }

  await saveMonthlyPayrollSnapshot({
    employeeId,
    batchId,
    period,
    components,
  })

  const ytdMap = await computeCumulativeYtd(
    String(enriched['Emp ID'] || ''),
    period,
    components,
  )
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
