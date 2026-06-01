import { Collection, ObjectId, Filter, Document } from 'mongodb';
import { getDB } from '../config/db';
import { Employee, CreateEmployeePayload, UpdateEmployeePayload, EmployeeActivityEntry } from '../models/Employee';
import * as emailService from './emailService';
import { ensureUserAccountForEmployee } from '../utils/employeeAuth';
import { sanitizeEmployeeForDetail, sanitizeEmployeeForList } from '../utils/sanitizeEmployee';

let employeeCollection: Collection<any> | null = null;

/** List queries — exclude binary blobs at the DB layer (not just in JSON). */
const EMPLOYEE_LIST_PROJECTION = {
  id: 1,
  employeeId: 1,
  firstName: 1,
  lastName: 1,
  email: 1,
  personalEmail: 1,
  employmentType: 1,
  joinedAt: 1,
  status: 1,
  role: 1,
  createdAt: 1,
  updatedAt: 1,
  'photo.filename': 1,
};

function buildEmployeeIdFilter(trimmed: string): Filter<Document> {
  const or: Filter<Document>[] = [
    { id: trimmed },
    { employeeId: trimmed.toUpperCase() },
    { employeeId: trimmed },
  ];
  if (ObjectId.isValid(trimmed)) {
    or.push({ _id: new ObjectId(trimmed) });
  }
  return { $or: or };
}

const ACTIVITY_HISTORY_LIMIT = 50;

const PROFILE_TRACKED_FIELDS = [
  'employeeId',
  'firstName',
  'middleName',
  'lastName',
  'email',
  'personalEmail',
  'phone',
  'permanentAddress',
  'communicationAddress',
  'dob',
  'gender',
  'role',
  'employmentType',
  'joinedAt',
  'ctc',
  'bankName',
  'accountNumber',
  'ifsc',
  'uan',
  'pfEsi',
  'aadhaar',
  'pan',
  'passport',
] as const;

const FIELD_LABELS: Record<string, string> = {
  employeeId: 'Employee ID',
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  email: 'Company email',
  personalEmail: 'Personal email',
  phone: 'Phone',
  permanentAddress: 'Permanent address',
  communicationAddress: 'Communication address',
  dob: 'Date of birth',
  gender: 'Gender',
  role: 'Role',
  employmentType: 'Employment type',
  joinedAt: 'Joined date',
  ctc: 'CTC',
  bankName: 'Bank name',
  accountNumber: 'Account number',
  ifsc: 'IFSC',
  uan: 'UAN',
  pfEsi: 'PF / ESI',
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  passport: 'Passport',
};

function normalizeCompareValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

function getChangedProfileFields(
  existing: Employee,
  payload: Record<string, unknown>,
): string[] {
  const changed: string[] = [];

  for (const field of PROFILE_TRACKED_FIELDS) {
    if (payload[field] === undefined) continue;
    if (normalizeCompareValue(payload[field]) !== normalizeCompareValue((existing as any)[field])) {
      changed.push(field);
    }
  }

  if (payload.emergencyContact !== undefined) {
    const prev = normalizeCompareValue(existing.emergencyContact);
    const next = normalizeCompareValue(payload.emergencyContact);
    if (prev !== next) changed.push('emergencyContact');
  }

  return changed;
}

function buildProfileEditSummary(fields: string[]): string {
  const labels = fields.map((field) =>
    field === 'emergencyContact' ? 'Emergency contact' : FIELD_LABELS[field] || field,
  );
  if (labels.length === 0) return 'Profile updated';
  if (labels.length <= 3) return `Updated ${labels.join(', ')}`;
  return `Updated ${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`;
}

function buildActivityHistoryUpdate(entries: EmployeeActivityEntry[]): Record<string, unknown> {
  if (entries.length === 0) return {};
  return {
    $push: {
      activityHistory: {
        $each: entries,
        $slice: -ACTIVITY_HISTORY_LIMIT,
      },
    },
  };
}

/** Strip base64 from photo/documents while keeping metadata for profile UI. */
const STRIP_EMPLOYEE_BLOBS_STAGE = {
  $addFields: {
    photo: {
      $cond: [
        {
          $and: [
            { $ne: [{ $type: '$photo' }, 'missing'] },
            { $ne: ['$photo', null] },
          ],
        },
        {
          filename: '$photo.filename',
          contentType: '$photo.contentType',
          uploadedAt: '$photo.uploadedAt',
        },
        '$$REMOVE',
      ],
    },
    documents: {
      $arrayToObject: {
        $map: {
          input: { $objectToArray: { $ifNull: ['$documents', {}] } },
          as: 'doc',
          in: {
            k: '$$doc.k',
            v: {
              filename: '$$doc.v.filename',
              contentType: '$$doc.v.contentType',
              uploadedAt: '$$doc.v.uploadedAt',
            },
          },
        },
      },
    },
  },
};

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
        { personalEmail: searchRegex },
        { employeeId: searchRegex },
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

  const statusRankSwitch = {
    $switch: {
      branches: [
        { case: { $eq: ['$status', 'Active'] }, then: 0 },
        { case: { $eq: ['$status', 'Notice Period'] }, then: 1 },
        { case: { $eq: ['$status', 'Deactivated'] }, then: 2 },
        { case: { $eq: ['$status', 'Inactive'] }, then: 3 },
      ],
      default: 99,
    },
  };

  const sortDirectionVal = filters.sortDirection === 'desc' ? -1 : 1;
  const sortObj: Record<string, 1 | -1> = { statusRank: 1 };
  if (filters.sortColumn) {
    sortObj[filters.sortColumn] = sortDirectionVal;
  } else {
    sortObj.firstName = 1;
    sortObj.lastName = 1;
  }

  // Get total count and page in parallel — projection skips photo/doc blobs
  const skip = (page - 1) * pageSize;
  const [total, data] = await Promise.all([
    collection.countDocuments(query),
    collection
      .aggregate([
        { $match: query },
        { $addFields: { statusRank: statusRankSwitch } },
        { $sort: sortObj },
        { $skip: skip },
        { $limit: pageSize },
        { $project: EMPLOYEE_LIST_PROJECTION },
      ])
      .toArray(),
  ]);

  return {
    data: data.map((row) => sanitizeEmployeeForList(row as any)) as unknown as Employee[],
    total,
  };
}

export async function getEmployeeById(
  id: string,
  options?: { includeBlobs?: boolean }
): Promise<Employee | null> {
  const collection = getEmployeeCollection();
  const trimmed = id.trim();
  if (!trimmed) return null;

  const findOptions = options?.includeBlobs ? {} : { projection: { documents: 0, 'photo.data': 0 } };

  let employee = await collection.findOne({ id: trimmed }, findOptions);
  if (employee) return employee as Employee;

  employee = await collection.findOne({
    $or: [{ employeeId: trimmed.toUpperCase() }, { employeeId: trimmed }],
  }, findOptions);
  if (employee) return employee as Employee;

  if (ObjectId.isValid(trimmed)) {
    employee = await collection.findOne({ _id: new ObjectId(trimmed) }, findOptions);
    if (employee) return employee as Employee;
  }

  return null;
}

/** Profile/detail API — metadata only, no base64 payloads (aggregation-safe). */
export async function getEmployeeProfileById(id: string): Promise<Employee | null> {
  const collection = getEmployeeCollection();
  const trimmed = id.trim();
  if (!trimmed) return null;

  const rows = await collection
    .aggregate([
      { $match: buildEmployeeIdFilter(trimmed) },
      { $limit: 1 },
      STRIP_EMPLOYEE_BLOBS_STAGE,
    ])
    .toArray();

  if (!rows[0]) return null;
  return rows[0] as Employee;
}

type StoredDocument = { filename: string; contentType: string; data: string };

/** Fetch one document blob without loading the full employee record. */
export async function getEmployeeDocumentBlob(
  id: string,
  docType: string,
): Promise<StoredDocument | null> {
  const collection = getEmployeeCollection();
  const trimmed = id.trim();
  const key = docType.trim();
  if (!trimmed || !key) return null;

  const projection = {
    [`documents.${key}.filename`]: 1,
    [`documents.${key}.contentType`]: 1,
    [`documents.${key}.data`]: 1,
  };

  const row = await collection.findOne(buildEmployeeIdFilter(trimmed), { projection });
  const doc = row?.documents?.[key] as StoredDocument | undefined;
  if (!doc?.data) return null;
  return doc;
}

/** Remove one document without replacing the entire documents object. */
export async function deleteEmployeeDocument(id: string, docType: string): Promise<boolean> {
  const collection = getEmployeeCollection();
  const trimmed = id.trim();
  const key = docType.trim();
  if (!trimmed || !key) return false;

  const existing = await collection.findOne(buildEmployeeIdFilter(trimmed), {
    projection: { [`documents.${key}`]: 1 },
  });
  if (!existing?.documents?.[key]) return false;

  const result = await collection.updateOne(buildEmployeeIdFilter(trimmed), {
    $unset: { [`documents.${key}`]: '' },
    $set: { updatedAt: new Date() },
  });
  return result.modifiedCount > 0;
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

  await ensureUserAccountForEmployee(employee).catch((err) => {
    console.error('[Employee Service] Failed to ensure login account for employee:', err);
  });

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
  payload: UpdateEmployeePayload & { statusChangeReason?: string; changedBy?: string },
  meta?: { changedBy?: string },
): Promise<Employee | null> {
  const collection = getEmployeeCollection();

  const statusChangeReason = payload.statusChangeReason?.trim() || '';
  const changedBy = payload.changedBy?.trim() || meta?.changedBy?.trim() || 'Admin';

  // Strip designation and department from update payload — not stored
  const {
    designation: _omitDesignation,
    department: _omitDepartment,
    statusChangeReason: _omitReason,
    changedBy: _omitChangedBy,
    ...cleanPayload
  } = payload as any;

  const existing = await getEmployeeById(id);
  if (!existing) return null;

  // Company email, once set on the employee profile, cannot be cleared
  if (existing.email && String(existing.email).trim() !== '') {
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
    if (existing.email !== normalizedNewEmail) {
      const dup = await collection.findOne({ email: normalizedNewEmail });
      if (dup && dup.id !== id) {
        const err: any = new Error('An employee with this company email already exists.');
        err.code = 'DUPLICATE_EMAIL';
        throw err;
      }
    }
    cleanPayload.email = normalizedNewEmail;
  }

  // Detect newly added company email → send welcome email (login works with personal or company email)
  if (cleanPayload.email && !existing.email) {
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

    try {
      await ensureUserAccountForEmployee({
        ...existing,
        email: newCompanyEmail,
        personalEmail: existing.personalEmail,
      });
    } catch (err) {
      console.error('[Employee Service] Failed to sync user account after company email update:', err);
    }
  }

  const now = new Date();
  const historyEntries: EmployeeActivityEntry[] = [];

  if (cleanPayload.status !== undefined && existing.status !== cleanPayload.status) {
    historyEntries.push({
      type: 'status_change',
      at: now,
      by: changedBy,
      reason: statusChangeReason || undefined,
      fromStatus: existing.status,
      toStatus: cleanPayload.status,
      summary: `Status changed from ${existing.status} to ${cleanPayload.status}`,
    });
  }

  const changedFields = getChangedProfileFields(existing, cleanPayload);
  if (changedFields.length > 0) {
    historyEntries.push({
      type: 'profile_edit',
      at: now,
      by: changedBy,
      changedFields,
      summary: buildProfileEditSummary(changedFields),
    });
  }

  const updateData = {
    ...cleanPayload,
    updatedAt: now,
  };

  const historyUpdate = buildActivityHistoryUpdate(historyEntries);
  const updateDoc = {
    $set: updateData,
    ...historyUpdate,
  };

  // Try updating by custom id first (MongoDB v6: returns document directly)
  let result = await collection.findOneAndUpdate({ id }, updateDoc as any, { returnDocument: 'after' });

  if (result) return result as Employee;

  // Try updating by MongoDB ObjectId
  if (ObjectId.isValid(id)) {
    result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateDoc as any,
      { returnDocument: 'after' },
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

export async function updateEmployeeStatus(
  id: string,
  status: Employee['status'],
  options?: { reason?: string; changedBy?: string },
): Promise<Employee | null> {
  return updateEmployee(id, {
    status,
    statusChangeReason: options?.reason,
    changedBy: options?.changedBy,
  } as UpdateEmployeePayload & { statusChangeReason?: string; changedBy?: string });
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
        { personalEmail: searchRegex },
        { role: searchRegex },
      ],
    })
    .project(EMPLOYEE_LIST_PROJECTION)
    .limit(50)
    .toArray();

  return employees.map((row) => sanitizeEmployeeForList(row as any)) as unknown as Employee[];
}

export async function bulkUpdateStatus(
  ids: string[],
  status: string,
  options?: { reason?: string; changedBy?: string },
): Promise<{ updated: number }> {
  const collection = getEmployeeCollection();
  const trimmedIds = ids.map((id) => id.trim()).filter(Boolean);
  if (trimmedIds.length === 0) return { updated: 0 };

  const employees = await collection
    .find({ id: { $in: trimmedIds } })
    .project({ id: 1, status: 1 })
    .toArray();

  const now = new Date();
  const changedBy = options?.changedBy?.trim() || 'Admin';
  const reason = options?.reason?.trim() || '';

  const ops = employees
    .filter((emp) => emp.status !== status)
    .map((emp) => {
      const entry: EmployeeActivityEntry = {
        type: 'status_change',
        at: now,
        by: changedBy,
        reason: reason || undefined,
        fromStatus: emp.status,
        toStatus: status as Employee['status'],
        summary: `Status changed from ${emp.status} to ${status}`,
      };

      return {
        updateOne: {
          filter: { id: emp.id },
          update: {
            $set: { status, updatedAt: now },
            ...buildActivityHistoryUpdate([entry]),
          } as any,
        },
      };
    });

  if (ops.length === 0) return { updated: 0 };

  const result = await collection.bulkWrite(ops);
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
