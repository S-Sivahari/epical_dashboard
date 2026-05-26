import { readFileSync } from 'fs'
import { join } from 'path'
import { PAYROLL_UPLOADS_ROOT } from '../config/paths'
import { readMasterExcelFromBuffer } from '../services/payslipGenerator'
import { savePayslipAsPdf } from '../services/payslipPdfGenerator'

const batchId = process.argv[2] || '71524b53-4453-4423-ad99-37760e746db4'
const excelPath = join(PAYROLL_UPLOADS_ROOT, batchId, 'payroll.xlsx')
const outPath = join(PAYROLL_UPLOADS_ROOT, batchId, 'payslips', 'Payslip_EPL78747373_REGEN.pdf')

async function main() {
  const buffer = readFileSync(excelPath)
  const { company, structure, employees } = await readMasterExcelFromBuffer(buffer)
  const emp = employees.find((e) => String(e['Emp ID']) === 'EPL78747373')
  if (!emp) throw new Error('Employee not found')
  console.log('structure keys', Object.keys(structure).length)
  await savePayslipAsPdf(company, structure, emp, outPath)
  console.log('Wrote', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
