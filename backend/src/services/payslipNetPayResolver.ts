import { readBatchExcel, getPayrollBatch } from './payrollBatchService'
import { readMasterExcelFromBuffer, computeNetPay } from './payslipGenerator'

/**
 * Resolve net pay for an employee in a specific payroll batch.
 * This parses the batch's uploaded Excel file and calculates net pay
 * using the exact same formula as the PDF generator.
 */
export async function resolveNetPayForBatchPayslip(
  batchId: string,
  empId: string
): Promise<number | null> {
  try {
    const batch = await getPayrollBatch(batchId)
    if (!batch) return null

    const excelBuffer = readBatchExcel(batchId)
    if (!excelBuffer || excelBuffer.length === 0) return null

    const { company, structure, employees } = await readMasterExcelFromBuffer(excelBuffer)
    
    // Find matching employee row from Excel sheet
    const normalizedEmpId = String(empId).trim().toUpperCase()
    const emp = employees.find((e) => {
      const currentId = String(e['Emp ID'] || e['Employee ID'] || '').trim().toUpperCase()
      return currentId === normalizedEmpId
    })

    if (!emp) return null

    // Compute net pay using the canonical formula from payslipGenerator
    const netPay = computeNetPay(emp, structure, company)
    return typeof netPay === 'number' && !Number.isNaN(netPay) ? netPay : null
  } catch (error) {
    console.error(`[payslipNetPayResolver] Failed to resolve net pay for batch ${batchId}, employee ${empId}:`, error)
    return null
  }
}
