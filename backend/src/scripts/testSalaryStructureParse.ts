import { generatePayrollTemplateBuffer } from '../services/payrollTemplate'
import {
  buildDeductionsData,
  buildEarningsData,
  readMasterExcelFromBuffer,
} from '../services/payslipGenerator'
import { countBySection, resolveSalaryStructureSheetName } from '../services/salaryStructureParser'
import { getWorksheetNames, loadExcelWorkbook } from '../utils/excelWorkbook'

async function main() {
  const buf = await generatePayrollTemplateBuffer()
  const wb = await loadExcelWorkbook(buf)
  const sheetNames = getWorksheetNames(wb)
  console.log('sheets:', sheetNames)
  console.log('resolved sheet:', resolveSalaryStructureSheetName(sheetNames))

  const p = await readMasterExcelFromBuffer(buf)
  console.log('components:', Object.keys(p.structure).length, countBySection(p.structure))
  console.log(
    'earnings:',
    buildEarningsData(p.employees[0], p.structure).earnings.map((e) => e.name),
  )
  console.log(
    'deductions:',
    buildDeductionsData(p.employees[0], p.structure).deductions.map((e) => e.name),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
