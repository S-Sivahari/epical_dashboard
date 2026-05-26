import { generatePayrollTemplateBuffer } from '../services/payrollTemplate'
import { readMasterExcelFromBuffer } from '../services/payslipGenerator'
import { savePayslipAsPdf } from '../services/payslipPdfGenerator'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

async function main() {
  const buf = await generatePayrollTemplateBuffer()
  const { company, structure, employees } = await readMasterExcelFromBuffer(buf)
  console.log('Company:', company['Company Name'])
  console.log('Employees:', employees.length)

  const out = join(process.cwd(), 'uploads', 'test')
  if (!existsSync(out)) mkdirSync(out, { recursive: true })

  await savePayslipAsPdf(company, structure, employees[0], join(out, 'test.pdf'))
  console.log('PDF written to', join(out, 'test.pdf'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
