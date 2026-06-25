import ExcelJS from 'exceljs'
import type { SalaryStructure } from './payslipGenerator'

/** Light peach fill = Deductions only when Section column is blank. */
const PEACH_ARGB_SUFFIXES = ['FDE8D8', 'FFE5CC', 'FFDFC4', 'F5DEB3']

export function cellToString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val).trim()
  }
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return o.richText.map((t) => String((t as { text?: string }).text ?? '')).join('').trim()
    }
    if ('result' in o) return cellToString(o.result)
    if ('text' in o) return String(o.text).trim()
  }
  return String(val).trim()
}

/** Section column wins; peach fill is fallback when Section is empty. */
export function normalizeComponentSection(sectionText: string, isPeachRow = false): 'Earnings' | 'Deductions' {
  const s = sectionText.trim().toLowerCase()
  if (
    s.includes('deduction') ||
    s.includes('deduct') ||
    s === 'type 2' ||
    s === 'type2' ||
    s === 'd' ||
    s === 'ded'
  ) {
    return 'Deductions'
  }
  if (s.includes('earning') || s === 'type 1' || s === 'type1' || s === 'e') {
    return 'Earnings'
  }
  if (!sectionText.trim()) {
    return isPeachRow ? 'Deductions' : 'Earnings'
  }
  return 'Earnings'
}

function cellFillArgb(cell: ExcelJS.Cell): string {
  const fill = cell.fill
  if (!fill || fill.type !== 'pattern') return ''
  const fg = fill.fgColor
  if (!fg || typeof fg !== 'object' || !('argb' in fg)) return ''
  return String((fg as { argb?: string }).argb ?? '').toUpperCase()
}

export function isPeachFill(argb: string): boolean {
  if (!argb) return false
  const u = argb.toUpperCase()
  return PEACH_ARGB_SUFFIXES.some((suffix) => u.endsWith(suffix) || u.includes(suffix))
}

export function rowHasPeachFill(row: ExcelJS.Row, maxCol = 6): boolean {
  for (let c = 1; c <= maxCol; c++) {
    if (isPeachFill(cellFillArgb(row.getCell(c)))) return true
  }
  return false
}

interface StructureColumns {
  headerRow: number
  componentCol: number
  sectionCol: number
  amountCol: number
}

function detectStructureColumns(matrix: unknown[][]): StructureColumns {
  for (let r = 0; r < Math.min(20, matrix.length); r++) {
    const row = matrix[r]
    if (!row) continue
    let componentCol = -1
    let sectionCol = -1
    let amountCol = -1
    for (let c = 0; c < row.length; c++) {
      const v = cellToString(row[c]).toLowerCase()
      if (
        v === 'component' ||
        v === 'components' ||
        v === 'pay component' ||
        v === 'salary component' ||
        v === 'particulars' ||
        v === 'description'
      ) {
        componentCol = c
      }
      if (
        v === 'section' ||
        v === 'type' ||
        v === 'category' ||
        v === 'component type' ||
        /\bsection\b/.test(v) ||
        (v.includes('component') && v.includes('type'))
      ) {
        sectionCol = c
      }
      if (v.includes('default') || v === 'amount' || v.includes('amount')) {
        amountCol = c
      }
    }
    if (componentCol >= 0 && sectionCol >= 0) {
      return {
        headerRow: r,
        componentCol,
        sectionCol,
        amountCol: amountCol >= 0 ? amountCol : Math.max(componentCol, sectionCol) + 1,
      }
    }
  }
  return { headerRow: 0, componentCol: 0, sectionCol: 1, amountCol: 2 }
}

/** Parse salary_structure rows (header row with Component + Section). */
export function parseStructureMatrix(
  matrix: unknown[][],
  peachByMatrixRow?: (matrixRowIndex: number) => boolean
): SalaryStructure {
  const structure: SalaryStructure = {}
  if (matrix.length === 0) return structure

  const cols = detectStructureColumns(matrix)
  let order = 0

  for (let r = cols.headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row) continue

    const comp = cellToString(row[cols.componentCol])
    if (!comp || comp.toLowerCase() === 'component') continue
    const compLower = comp.toLowerCase()
    if (
      compLower === 'earnings' ||
      compLower === 'earning' ||
      compLower === 'deductions' ||
      compLower === 'deduction'
    ) {
      continue
    }

    const sectionText = cellToString(row[cols.sectionCol])
    const rawAmt = row[cols.amountCol]
    let amt = 0
    if (rawAmt !== '' && rawAmt !== null && rawAmt !== undefined) {
      const n = typeof rawAmt === 'number' ? rawAmt : parseFloat(cellToString(rawAmt))
      amt = Number.isNaN(n) ? 0 : n
    }

    const isPeach = peachByMatrixRow?.(r) ?? false
    const section = normalizeComponentSection(sectionText, isPeach)
    structure[comp] = { section, default: amt, order: order++ }
  }

  return structure
}

/** Normalize sheet tab name for comparison (collapse spaces, lowercase). */
export function normalizeSheetTabName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True when tab is the salary structure sheet (e.g. "salary structure", "Salary Structure"). */
export function isSalaryStructureSheetName(name: string): boolean {
  const n = normalizeSheetTabName(name)
  if (n === 'salary structure' || n === 'salarystructure') return true
  const underscored = n.replace(/ /g, '_')
  return underscored === 'salary_structure' || underscored === 'salarystructure'
}

export function sheetToMatrix(ws: ExcelJS.Worksheet, minCols = 4): unknown[][] {
  const matrix: unknown[][] = []
  const maxRow = ws.rowCount || 0
  let maxCol = minCols
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (_cell, colNumber) => {
      maxCol = Math.max(maxCol, colNumber)
    })
  })
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r)
    const arr: unknown[] = []
    for (let c = 1; c <= maxCol; c++) {
      arr[c - 1] = row.getCell(c).value
    }
    matrix.push(arr)
  }
  return matrix
}

function findSalaryStructureSheetWb(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  for (const ws of wb.worksheets) {
    if (isSalaryStructureSheetName(ws.name)) return ws
  }
  const names = ['salary_structure', 'salary structure', 'salarystructure']
  for (const n of names) {
    const ws = wb.getWorksheet(n)
    if (ws) return ws
  }
  for (const ws of wb.worksheets) {
    const lower = normalizeSheetTabName(ws.name).replace(/ /g, '_')
    if (lower.includes('salary') && lower.includes('struct')) return ws
  }
  return undefined
}

/** Prefer exact tab "salary structure"; fall back to fuzzy match. */
export function resolveSalaryStructureSheetName(sheetNames: string[]): string | undefined {
  for (const name of sheetNames) {
    if (isSalaryStructureSheetName(name)) return name
  }
  return findSalaryStructureSheetInWorkbook(sheetNames)
}

export function findSalaryStructureSheetInWorkbook(sheetNames: string[]): string | undefined {
  for (const name of sheetNames) {
    if (isSalaryStructureSheetName(name)) return name
  }
  const normalized = (n: string) => normalizeSheetTabName(n).replace(/ /g, '_')
  for (const name of sheetNames) {
    const n = normalized(name)
    if (
      n === 'salary_structure' ||
      n === 'salarystructure' ||
      (n.includes('salary') && n.includes('struct'))
    ) {
      return name
    }
  }
  for (const name of sheetNames) {
    const n = normalized(name)
    if (n.includes('salary') || n === 'structure') return name
  }
  return undefined
}

/** Parse salary structure sheet with ExcelJS (peach fallback when Section is blank). */
export async function parseSalaryStructureWithExcelJS(buffer: Buffer): Promise<SalaryStructure> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)

  const sheet = findSalaryStructureSheetWb(wb)
  if (!sheet) return {}

  const matrix = sheetToMatrix(sheet)
  return parseStructureMatrix(matrix, (matrixRowIndex) =>
    rowHasPeachFill(sheet.getRow(matrixRowIndex + 1))
  )
}

export function listComponentsBySection(
  structure: SalaryStructure,
  section: 'Earnings' | 'Deductions'
): string[] {
  return Object.entries(structure)
    .filter(([, meta]) => meta.section === section)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name]) => name)
}

function resolveMergedSection(
  baseMeta: SalaryStructure[string] | undefined,
  overlayMeta: SalaryStructure[string]
): 'Earnings' | 'Deductions' {
  if (baseMeta?.section === 'Deductions' || overlayMeta.section === 'Deductions') {
    return 'Deductions'
  }
  return 'Earnings'
}

/**
 * Merge matrix + ExcelJS parses. ExcelJS carries row fill (peach = deduction);
 * when either source classifies a component as Deductions, keep it as Deductions.
 */
export function mergeSalaryStructures(
  base: SalaryStructure,
  overlay: SalaryStructure
): SalaryStructure {
  const merged: SalaryStructure = { ...base }

  for (const [name, overlayMeta] of Object.entries(overlay)) {
    const baseMeta = merged[name]
    merged[name] = {
      section: resolveMergedSection(baseMeta, overlayMeta),
      order: baseMeta?.order ?? overlayMeta.order ?? 0,
      default: baseMeta?.default ?? overlayMeta.default ?? 0,
    }
  }

  return merged
}

/** Combine tabular matrix parse with ExcelJS style-aware parse. */
export function combineSalaryStructureSources(
  fromNamedSheet: SalaryStructure,
  fromStyles: SalaryStructure,
  ...others: SalaryStructure[]
): SalaryStructure {
  const base = preferNamedSalaryStructure(fromNamedSheet, ...others)
  if (Object.keys(fromStyles).length === 0) return base
  return mergeSalaryStructures(base, fromStyles)
}

/** Pick whichever parse produced the most components. */
export function pickBestSalaryStructure(...candidates: SalaryStructure[]): SalaryStructure {
  let best: SalaryStructure = {}
  for (const s of candidates) {
    if (Object.keys(s).length > Object.keys(best).length) {
      best = s
    }
  }
  return best
}

/** Use the named salary structure sheet when it has rows; otherwise best fallback. */
export function preferNamedSalaryStructure(
  fromNamedSheet: SalaryStructure,
  ...others: SalaryStructure[]
): SalaryStructure {
  if (Object.keys(fromNamedSheet).length > 0) return fromNamedSheet
  return pickBestSalaryStructure(...others)
}

/**
 * Fallback: find any cell equal to Earnings/Deductions; component is the adjacent cell.
 * Handles non-standard column order or extra title rows.
 */
export function parseStructureFallbackScan(matrix: unknown[][]): SalaryStructure {
  const structure: SalaryStructure = {}
  const sectionWords = new Set(['earnings', 'earning', 'deductions', 'deduction'])
  let order = 0

  for (const row of matrix) {
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const here = cellToString(row[c])
      const hereLower = here.toLowerCase()
      if (!sectionWords.has(hereLower)) continue

      const section = normalizeComponentSection(here, false)
      let comp = ''
      for (let k = c - 1; k >= 0; k--) {
        const v = cellToString(row[k])
        if (v && !sectionWords.has(v.toLowerCase()) && v.toLowerCase() !== 'component') {
          comp = v
          break
        }
      }
      if (!comp) {
        for (let k = c + 1; k < row.length; k++) {
          const v = cellToString(row[k])
          if (v && !sectionWords.has(v.toLowerCase()) && v.toLowerCase() !== 'component') {
            comp = v
            break
          }
        }
      }
      if (comp && !structure[comp]) {
        let amt = 0
        for (let k = c + 1; k < row.length; k++) {
          const v = row[k]
          if (typeof v === 'number') {
            amt = v
            break
          }
          const n = parseFloat(cellToString(v))
          if (!Number.isNaN(n) && cellToString(v) !== '' && !sectionWords.has(cellToString(v).toLowerCase())) {
            amt = n
            break
          }
        }
        structure[comp] = { section, default: amt, order: order++ }
      }
    }
  }

  return structure
}

export function countBySection(structure: SalaryStructure): { earnings: number; deductions: number } {
  let earnings = 0
  let deductions = 0
  for (const meta of Object.values(structure)) {
    if (meta.section === 'Deductions') deductions++
    else earnings++
  }
  return { earnings, deductions }
}
