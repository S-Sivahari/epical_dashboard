import * as XLSX from 'xlsx'
import { generatePayrollTemplateBuffer } from '../services/payrollTemplate'
import {
  buildDeductionsData,
  buildEarningsData,
  readMasterExcelFromBuffer,
} from '../services/payslipGenerator'
import { countBySection, resolveSalaryStructureSheetName } from '../services/salaryStructureParser'

async function main() {
  const buf = await generatePayrollTemplateBuffer()
  const wb = XLSX.read(buf, { type: 'buffer' })
  console.log('sheets:', wb.SheetNames)
  console.log('resolved sheet:', resolveSalaryStructureSheetName(wb.SheetNames))

  const p = await readMasterExcelFromBuffer(buf)
  console.log('components:', Object.keys(p.structure).length, countBySection(p.structure))
  console.log(
    'earnings:',
    buildEarningsData(p.employees[0], p.structure).earnings.map((e) => e.name)
  )
  console.log(
    'deductions:',
    buildDeductionsData(p.employees[0], p.structure).deductions.map((e) => e.name)
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
