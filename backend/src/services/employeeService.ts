import { Collection, ObjectId, Filter, Document } from 'mongodb';
import { getDB } from '../config/db';
import { Employee, CreateEmployeePayload, UpdateEmployeePayload } from '../models/Employee';
import * as emailService from './emailService';

let employeeCollection: Collection<any> | null = null;

function getEmployeeCollection(): Collection<any> {
  if (!employeeCollection) {
    const db = getDB();
    employeeCollection = db.collection('employees');
  }
  return employeeCollection;
}

export async function getAllEmployees(
  page: number = 1,
  pageSize: number = 10,
  filters: {
    q?: string;
    employmentType?: string;
    status?: string;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ data: Employee[]; total: number }> {
  const collection = getEmployeeCollection();

  // Build filter query
  const query: Filter<Document> = {};

  // Search query - search in firstName, lastName, email
  if (filters.q) {
    const trimmed = filters.q.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      const firstRegex = { $regex: parts[0], $options: 'i' };
      const lastRegex = { $regex: parts.slice(1).join(' '), $options: 'i' };
      query.$or = [
        { $and: [ { firstName: firstRegex }, { lastName: lastRegex } ] },
        { $and: [ { firstName: lastRegex }, { lastName: firstRegex } ] },
        { email: { $regex: trimmed, $options: 'i' } }
      ];
    } else {
      const searchRegex = { $regex: trimmed, $options: 'i' };
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }
  }

  // Filter by employment type
  if (filters.employmentType && filters.employmentType !== 'all') {
    query.employmentType = filters.employmentType;
  }

  // Filter by status
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  } else {
    // Default: keep deactivated accounts visible so they can be reactivated.
    query.status = { $ne: 'Archived' };
  }


  // Get total count
  const total = await collection.countDocuments(query);

  const sortDirectionVal = filters.sortDirection === 'desc' ? -1 : 1;
  let sortObj: any = { createdAt: -1 };
  if (filters.sortColumn) {
    sortObj = { [filters.sortColumn]: sortDirectionVal };
  }

  // Get paginated results
  const skip = (page - 1) * pageSize;
  const data = await collection
    .find(query)
    .skip(skip)
    .limit(pageSize)
    .sort(sortObj)
    .toArray();

  return {
    data: data as Employee[],
    total,
  };
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const collection = getEmployeeCollection();
  
  // Try finding by custom id first
  let employee = await collection.findOne({ id });
  if (employee) return employee as Employee;

  // Try finding by MongoDB ObjectId
  if (ObjectId.isValid(id)) {
    employee = await collection.findOne({ _id: new ObjectId(id) });
    return employee as Employee;
  }

  return null;
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
  const collection = getEmployeeCollection();

  // ==== Validation ==== //
  const requiredFields: (keyof CreateEmployeePayload)[] = ['firstName', 'lastName'];
  for (const field of requiredFields) {
    const value = (payload as any)[field];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      const err: any = new Error(`Missing or empty required field: ${field}`);
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
  }

  // At least one email must be provided
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const hasPersonalEmail = payload.personalEmail && emailRegex.test(payload.personalEmail.trim());
  const hasCompanyEmail = payload.email && emailRegex.test(payload.email.trim());
  if (!hasPersonalEmail && !hasCompanyEmail) {
    const err: any = new Error('At least one valid email (personal or company) is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (payload.email && !emailRegex.test(payload.email.trim())) {
    const err: any = new Error('Invalid company email format');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (payload.personalEmail && !emailRegex.test(payload.personalEmail.trim())) {
    const err: any = new Error('Invalid personal email format');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // ==== Duplicate checks ==== //
  // Check for duplicate company email (only if company email provided)
  if (payload.email) {
    const existing = await collection.findOne({ email: payload.email.trim().toLowerCase() });
    if (existing) {
      const err: any = new Error('An employee with this company email already exists.');
      err.code = 'DUPLICATE_EMAIL';
      throw err;
    }
  }

  // Check for duplicate employeeId
  if (payload.employeeId) {
    const existing = await collection.findOne({
      employeeId: payload.employeeId.trim().toUpperCase(),
    });
    if (existing) {
      const err: any = new Error('An employee with this Employee ID already exists.');
      err.code = 'DUPLICATE_EMPLOYEE_ID';
      throw err;
    }
  }

  // Normalise fields — strip designation and department from stored data
  const { designation: _omitDesignation, department: _omitDepartment, ...payloadWithoutDesignation } = payload as any;
  const id = `E-${Date.now()}`;
  const employee: any = {
    ...payloadWithoutDesignation,
    id,
    email: payload.email?.trim().toLowerCase() || undefined,
    personalEmail: payload.personalEmail?.trim().toLowerCase() || undefined,
    employeeId: payload.employeeId?.trim().toUpperCase() ?? id,
    status: payload.status ?? 'Active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(employee);

  // Send welcome email — personal email first, then company email if different
  const welcomeBase = {
    firstName: employee.firstName || 'Team Member',
    lastName: employee.lastName || '',
    employeeId: employee.employeeId,
    joinedAt: employee.joinedAt || new Date().toISOString().split('T')[0],
  };
  const emailsToNotify: string[] = [];
  if (employee.personalEmail) emailsToNotify.push(employee.personalEmail);
  if (employee.email && employee.email !== employee.personalEmail) emailsToNotify.push(employee.email);
  for (const recipientEmail of emailsToNotify) {
    emailService.sendWelcomeEmail({ ...welcomeBase, recipientEmail }).catch((err) => {
      console.error('[Employee Service] Failed to send welcome email:', err);
    });
  }

  return { ...employee, _id: result.insertedId };
}
export async function checkEmployeeIdExists(
  employeeId: string,
  excludeId?: string
): Promise<boolean> {
  const collection = getEmployeeCollection();
  const query: any = { employeeId: employeeId.trim().toUpperCase() };
  if (excludeId) {
    // Exclude the current employee (for edit checks)
    const existing = await getEmployeeById(excludeId);
    if (existing) {
      query._id = { $ne: existing._id };
    }
  }
  const found = await collection.findOne(query);
  return !!found;
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload
): Promise<Employee | null> {
  const collection = getEmployeeCollection();

  // Strip designation and department from update payload — not stored
  const { designation: _omitDesignation, department: _omitDepartment, ...cleanPayload } = payload as any;

  const existing = await getEmployeeById(id);

  // Company email, once set on the employee profile, cannot be cleared
  if (existing?.email && String(existing.email).trim() !== '') {
    const cleared =
      cleanPayload.email === '' ||
      (typeof cleanPayload.email === 'string' && cleanPayload.email.trim() === '');
    if (cleared) {
      const err: any = new Error(
        'Company email cannot be removed once it has been set. Use a valid company email address.'
      );
      err.code = 'COMPANY_EMAIL_REQUIRED';
      throw err;
    }
  }

  // Duplicate company email check on update
  if (cleanPayload.email && cleanPayload.email.trim() !== '') {
    const normalizedNewEmail = cleanPayload.email.trim().toLowerCase();
    // Only check if email is changing
    if (!existing || existing.email !== normalizedNewEmail) {
      const dup = await collection.findOne({ email: normalizedNewEmail });
      if (dup && dup.id !== id) {
        const err: any = new Error('An employee with this company email already exists.');
        err.code = 'DUPLICATE_EMAIL';
        throw err;
      }
    }
    cleanPayload.email = normalizedNewEmail;
  }

  // Detect newly added company email → send welcome email + migrate user record
  if (cleanPayload.email && existing && !existing.email) {
    const newCompanyEmail = cleanPayload.email;
    if (newCompanyEmail !== existing.personalEmail) {
      const welcomeBase = {
        firstName: existing.firstName || 'Team Member',
        lastName: existing.lastName || '',
        employeeId: existing.employeeId,
        joinedAt: existing.joinedAt || new Date().toISOString().split('T')[0],
      };
      emailService.sendWelcomeEmail({ ...welcomeBase, recipientEmail: newCompanyEmail }).catch((err) => {
        console.error('[Employee Service] Failed to send company email welcome:', err);
      });
    }

    // Migrate user record: update the existing user's email from personalEmail to company email
    if (existing.personalEmail) {
      try {
        const userCol = getDB().collection('users');
        const userRecord = await userCol.findOne({ email: existing.personalEmail });
        if (userRecord) {
          await userCol.updateOne(
            { email: existing.personalEmail },
            { $set: { email: newCompanyEmail, updatedAt: new Date() } }
          );
          console.log(`[Employee Service] Migrated user login email from ${existing.personalEmail} to ${newCompanyEmail}`);
        }
      } catch (err) {
        console.error('[Employee Service] Failed to migrate user record:', err);
      }
    }
  }

  const updateData = {
    ...cleanPayload,
    updatedAt: new Date(),
  };

  // Try updating by custom id first (MongoDB v6: returns document directly)
  let result = await collection.findOneAndUpdate(
    { id },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (result) return result as Employee;

  // Try updating by MongoDB ObjectId
  if (ObjectId.isValid(id)) {
    result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    if (result) return result as Employee;
  }

  return null;
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const collection = getEmployeeCollection();

  // Try deleting by custom id first
  let result = await collection.deleteOne({ id });
  if (result.deletedCount > 0) return true;

  // Try deleting by MongoDB ObjectId
  if (ObjectId.isValid(id)) {
    result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  return false;
}

export async function updateEmployeeStatus(id: string, status: Employee['status']): Promise<Employee | null> {
  return updateEmployee(id, { status } as any);
}


export async function searchEmployees(query: string): Promise<Employee[]> {
  const collection = getEmployeeCollection();

  const searchRegex = { $regex: query, $options: 'i' };
  const employees = await collection
    .find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { role: searchRegex },
      ],
    })
    .toArray();

  return employees as Employee[];
}

export async function bulkUpdateStatus(
  ids: string[],
  status: string
): Promise<{ updated: number }> {
  const collection = getEmployeeCollection();
  const result = await collection.updateMany(
    { id: { $in: ids } },
    { $set: { status, updatedAt: new Date() } }
  );
  return { updated: result.modifiedCount };
}

/** Remove deprecated department field from all employee and user documents. */
export async function removeDepartmentFromDatabase(): Promise<{ employees: number; users: number }> {
  const db = getDB();
  const [employeeResult, userResult] = await Promise.all([
    db.collection('employees').updateMany({}, { $unset: { department: '' } }),
    db.collection('users').updateMany({}, { $unset: { department: '' } }),
  ]);
  return {
    employees: employeeResult.modifiedCount,
    users: userResult.modifiedCount,
  };
}
