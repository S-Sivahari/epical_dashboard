import { getDB } from '../config/db'
import {
  readMasterExcelFromBuffer,
  computeNetPay,
  type SalaryStructure,
} from './payslipGenerator'
import { readBatchExcel } from './payrollBatchService'

function normalizeEmpId(empId: string): string {
  return String(empId || '').trim().toUpperCase()
}

/** Net pay for an employee in a batch — same formula as payslip PDF/DOCX. */
export async function resolveNetPayForBatchPayslip(
  batchId: string,
  empId: string
): Promise<number | null> {
  try {
    const buffer = readBatchExcel(batchId)
    const parsed = await readMasterExcelFromBuffer(buffer)

    const rawBatch = await getDB().collection('payroll_batches').findOne({ id: batchId })

    let structure: SalaryStructure = parsed.structure
    if (Object.keys(structure).length === 0 && rawBatch?.salaryStructure) {
      structure = rawBatch.salaryStructure as SalaryStructure
    }

    const targetId = normalizeEmpId(empId)
    const emp = parsed.employees.find(
      (e) => normalizeEmpId(String(e['Emp ID'] || '')) === targetId
    )
    if (!emp) return null

    return computeNetPay(emp, structure, parsed.company)
  } catch {
    return null
  }
}
