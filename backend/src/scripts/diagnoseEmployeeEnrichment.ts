import { readFileSync } from 'fs'
import { join } from 'path'
import { connectDB, closeDB } from '../config/db'
import { PAYROLL_UPLOADS_ROOT } from '../config/paths'
import { readMasterExcelFromBuffer } from '../services/payslipGenerator'
import { findEmployeeByPayrollEmpId } from '../services/employeePayslipService'
import { enrichPayrollEmployeeFromDb } from '../services/payslipEmployeeEnrichment'

async function main() {
  await connectDB()

  const batchId = process.argv[2] || '71524b53-4453-4423-ad99-37760e746db4'
  const buffer = readFileSync(join(PAYROLL_UPLOADS_ROOT, batchId, 'payroll.xlsx'))
  const { employees } = await readMasterExcelFromBuffer(buffer)
  const excel = employees.find((e) => String(e['Emp ID']).includes('78747373')) ?? employees[0]

  const empId = String(excel['Emp ID'])
  console.log('Excel Emp ID:', empId, 'Name:', excel['Name'])

  const db = await findEmployeeByPayrollEmpId(empId)
  console.log('DB match by Emp ID:', db ? 'YES' : 'NO')
  if (db) {
    const keys = Object.keys(db).filter(
      (k) =>
        !['_id', 'documents', 'photo', 'emergencyContact'].includes(k) &&
        !k.toLowerCase().includes('password')
    )
    const snapshot: Record<string, unknown> = {}
    for (const k of keys) {
      const v = (db as Record<string, unknown>)[k]
      if (typeof v === 'string' && v.length > 80) snapshot[k] = v.slice(0, 40) + '…'
      else snapshot[k] = v
    }
    console.log('DB employee fields:', snapshot)
  } else {
    const col = (await import('../config/db')).getDB().collection('employees')
    const byName = await col
      .find({
        $or: [
          { firstName: /preethikha/i },
          { lastName: /preethikha/i },
        ],
      })
      .limit(3)
      .toArray()
    console.log(
      'Fuzzy name matches:',
      byName.map((e) => ({
        employeeId: e.employeeId,
        name: `${e.firstName} ${e.lastName}`,
        pan: e.pan,
      }))
    )
  }

  const enriched = await enrichPayrollEmployeeFromDb(excel)
  console.log('Enriched statutory:', {
    PAN: enriched['PAN'],
    Aadhaar: enriched['Aadhaar'],
    'A/C No': enriched['A/C No'],
    Bank: enriched['Bank'],
    IFSC: enriched['IFSC'],
  })

  await closeDB()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
