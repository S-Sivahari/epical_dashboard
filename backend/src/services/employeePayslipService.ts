import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import { normalizeLoginEmail, resolveEmployeeForAuthUser } from '../utils/employeeAuth'
export interface EmployeePayslipRecord {
  id: string
  employeeId: string
  employeeEmail: string
  employeeDbId: string
  employeeName: string
  batchId: string
  fileName: string
  payMonth: string
  sentAt: Date
}

let indexesCreated = false;

function payslipsCollection() {
  const col = getDB().collection<EmployeePayslipRecord>('employee_payslips')
  // Create indexes on first access for better query performance
  if (!indexesCreated) {
    void createIndexes();
    indexesCreated = true;
  }
  return col
}

async function createIndexes(): Promise<void> {
  try {
    const collection = getDB().collection('employee_payslips');
    
    // Get all existing indexes
    const indexes = await collection.indexes();
    
    // Check if the problematic index exists and drop it if it's not unique
    const existingIndex = indexes.find(idx => idx.name === 'batchId_1_fileName_1');
    if (existingIndex && !existingIndex.unique) {
      try {
        await collection.dropIndex('batchId_1_fileName_1');
      } catch (dropError) {
        console.warn('Could not drop existing index batchId_1_fileName_1:', dropError);
      }
    }
    
    // Create indexes one by one to handle conflicts gracefully
    const indexesToCreate = [
      { spec: { id: 1 }, options: { unique: true, name: 'id_1' } },
      { spec: { employeeDbId: 1 }, options: { name: 'employeeDbId_1' } },
      { spec: { employeeEmail: 1 }, options: { name: 'employeeEmail_1' } },
      { spec: { batchId: 1 }, options: { name: 'batchId_1' } },
      { spec: { batchId: 1, fileName: 1 }, options: { unique: true, name: 'batchId_1_fileName_1' } },
      { spec: { sentAt: -1 }, options: { name: 'sentAt_-1' } },
      { spec: { employeeDbId: 1, sentAt: -1 }, options: { name: 'employeeDbId_1_sentAt_-1' } },
      { spec: { employeeEmail: 1, sentAt: -1 }, options: { name: 'employeeEmail_1_sentAt_-1' } },
    ];
    
    for (const { spec, options } of indexesToCreate) {
      try {
        await collection.createIndex(spec, options);
      } catch (error: any) {
        // Ignore if index already exists with same spec
        if (error.code !== 85 && error.code !== 86) {
          console.warn(`Failed to create index ${options.name}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Failed to create employee_payslips indexes:', error);
  }
}

function getEmployeeCollectionSync() {
  return getDB().collection('employees')
}

export async function findEmployeeByPayrollEmpId(empId: string) {
  const col = getEmployeeCollectionSync()
  const normalized = empId.trim().toUpperCase()
  return col.findOne({
    $or: [
      { employeeId: normalized },
      { employeeId: empId.trim() },
      { id: empId.trim() },
    ],
  }, { projection: { documents: 0, 'photo.data': 0 } })
}

export async function sendPayslipToEmployee(params: {
  batchId: string
  fileName: string
  empId: string
  payMonth?: string
  employeeDbId?: string
}): Promise<EmployeePayslipRecord> {
  const col = getEmployeeCollectionSync()
  let employee = null

  if (params.employeeDbId) {
    employee = await col.findOne({ id: params.employeeDbId }, { projection: { documents: 0, 'photo.data': 0 } })
  }
  if (!employee) {
    employee = await findEmployeeByPayrollEmpId(params.empId)
  }
  if (!employee) {
    throw new Error(
      `No employee found with ID "${params.empId}". Add this employee in HR first, or match Emp ID in the payroll file to their Employee ID.`
    )
  }

  const employeeEmail =
    String(employee.email || employee.personalEmail || '').toLowerCase() || ''
  if (!employeeEmail) {
    throw new Error('Employee has no email on file — cannot deliver payslip to dashboard')
  }

  const record: EmployeePayslipRecord = {
    id: randomUUID(),
    employeeId: String(employee.employeeId || params.empId),
    employeeEmail,
    employeeDbId: String(employee.id),
    employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    batchId: params.batchId,
    fileName: params.fileName,
    payMonth: params.payMonth || 'Payslip',
    sentAt: new Date(),
  }

  await payslipsCollection().updateOne(
    { batchId: params.batchId, fileName: params.fileName },
    { $set: record },
    { upsert: true }
  )

  return record
}

export async function isPayslipSent(batchId: string, fileName: string): Promise<boolean> {
  const doc = await payslipsCollection().findOne({ batchId, fileName })
  return !!doc
}

export async function listSentFlagsForBatch(
  batchId: string
): Promise<Record<string, boolean>> {
  const docs = await payslipsCollection().find({ batchId }).toArray()
  const flags: Record<string, boolean> = {}
  for (const d of docs) {
    if (d.fileName) flags[d.fileName] = true
  }
  return flags
}

export async function getPayslipsForEmployeeEmail(email: string): Promise<EmployeePayslipRecord[]> {
  const normalized = normalizeLoginEmail(email)
  return payslipsCollection()
    .find({ employeeEmail: normalized })
    .sort({ sentAt: -1 })
    .toArray()
}

export async function getPayslipsForAuthUser(userId: string, userEmail?: string): Promise<EmployeePayslipRecord[]> {
  const employee = await resolveEmployeeForAuthUser(userId, userEmail)
  const emails = employee
    ? [employee.email, employee.personalEmail].filter(Boolean).map((e) => normalizeLoginEmail(String(e)))
    : userEmail
      ? [normalizeLoginEmail(userEmail)]
      : []

  const uniqueEmails = [...new Set(emails)]
  const query =
    uniqueEmails.length > 0 && employee?.id
      ? { $or: [{ employeeDbId: employee.id }, { employeeEmail: { $in: uniqueEmails } }] }
      : employee?.id
        ? { employeeDbId: employee.id }
        : uniqueEmails.length > 0
          ? { employeeEmail: { $in: uniqueEmails } }
          : null

  if (!query) return []

  return payslipsCollection().find(query).sort({ sentAt: -1 }).toArray()
}

export async function getPayslipByIdForEmployee(
  payslipId: string,
  email: string
): Promise<EmployeePayslipRecord | null> {
  return payslipsCollection().findOne({
    id: payslipId,
    employeeEmail: normalizeLoginEmail(email),
  })
}

export async function getPayslipByIdForAuthUser(
  payslipId: string,
  userId: string,
  userEmail?: string,
): Promise<EmployeePayslipRecord | null> {
  const employee = await resolveEmployeeForAuthUser(userId, userEmail)
  const emails = employee
    ? [employee.email, employee.personalEmail].filter(Boolean).map((e) => normalizeLoginEmail(String(e)))
    : userEmail
      ? [normalizeLoginEmail(userEmail)]
      : []

  const uniqueEmails = [...new Set(emails)]
  const query: Record<string, unknown> = { id: payslipId }
  if (employee?.id && uniqueEmails.length > 0) {
    return payslipsCollection().findOne({
      id: payslipId,
      $or: [{ employeeDbId: employee.id }, { employeeEmail: { $in: uniqueEmails } }],
    })
  }
  if (employee?.id) {
    query.employeeDbId = employee.id
  } else if (uniqueEmails.length > 0) {
    query.employeeEmail = { $in: uniqueEmails }
  } else {
    return null
  }

  return payslipsCollection().findOne(query as any)
}

export async function removeSentPayslip(batchId: string, fileName: string): Promise<void> {
  await payslipsCollection().deleteOne({ batchId, fileName })
}

export async function getAllSentPayslips(limit = 100): Promise<EmployeePayslipRecord[]> {
  return payslipsCollection()
    .find({})
    .sort({ sentAt: -1 })
    .limit(limit)
    .toArray()
}

export async function getSentCountsByBatch(): Promise<Record<string, number>> {
  const docs = await payslipsCollection().find({}).toArray()
  const counts: Record<string, number> = {}
  for (const d of docs) {
    counts[d.batchId] = (counts[d.batchId] || 0) + 1
  }
  return counts
}
