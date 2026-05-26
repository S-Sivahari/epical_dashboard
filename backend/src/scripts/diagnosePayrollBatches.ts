import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { PAYROLL_UPLOADS_ROOT } from '../config/paths'
import {
  buildDeductionsData,
  buildEarningsData,
  readMasterExcelFromBuffer,
} from '../services/payslipGenerator'
import { countBySection, resolveSalaryStructureSheetName } from '../services/salaryStructureParser'
import * as XLSX from 'xlsx'

function listBatchDirs(): { id: string; mtime: number }[] {
  const out: { id: string; mtime: number }[] = []
  for (const name of readdirSync(PAYROLL_UPLOADS_ROOT)) {
    if (name === 'template') continue
    const p = join(PAYROLL_UPLOADS_ROOT, name)
    try {
      if (statSync(p).isDirectory()) {
        out.push({ id: name, mtime: statSync(p).mtimeMs })
      }
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime)
}

async function diagnoseBatch(batchId: string) {
  const excelPath = join(PAYROLL_UPLOADS_ROOT, batchId, 'payroll.xlsx')
  const buffer = readFileSync(excelPath)
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const parsed = await readMasterExcelFromBuffer(buffer)
  const counts = countBySection(parsed.structure)

  console.log('\n=== Batch', batchId, '===')
  console.log('Sheets:', wb.SheetNames.join(' | '))
  console.log('Resolved salary sheet:', resolveSalaryStructureSheetName(wb.SheetNames))
  console.log('Pay Month:', parsed.company['Pay Month'], '| Pay Date:', parsed.company['Pay Date'])
  console.log('Components:', Object.keys(parsed.structure).length, counts)
  console.log('Structure keys:', Object.keys(parsed.structure).slice(0, 5).join(', '), '...')

  const emp = parsed.employees.find(
    (e) =>
      String(e['Emp ID'] || '').includes('78747373') ||
      String(e['Name'] || '').toLowerCase().includes('preethikha')
  )
  const target = emp ?? parsed.employees[0]
  if (!target) {
    console.log('No employees')
    return
  }
  console.log('Employee:', target['Emp ID'], target['Name'])
  const earn = buildEarningsData(target, parsed.structure)
  const ded = buildDeductionsData(target, parsed.structure)
  console.log('PDF earnings rows:', earn.earnings.length, earn.earnings.map((e) => e.name).join('; '))
  console.log('PDF deductions rows:', ded.deductions.length, ded.deductions.map((e) => e.name).join('; '))
}

async function main() {
  const batches = listBatchDirs().slice(0, 5)
  if (batches.length === 0) {
    console.log('No batches under', PAYROLL_UPLOADS_ROOT)
    return
  }
  for (const b of batches) {
    try {
      await diagnoseBatch(b.id)
    } catch (e) {
      console.log('\n=== Batch', b.id, 'FAILED ===', e instanceof Error ? e.message : e)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
