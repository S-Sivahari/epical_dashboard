import { Collection, ObjectId, Filter, Document } from 'mongodb';
import { getDB } from '../config/db';
import { Employee, CreateEmployeePayload, UpdateEmployeePayload } from '../models/Employee';

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
    department?: string;
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

  // Filter by department
  if (filters.department && filters.department !== 'all') {
    query.department = filters.department;
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

  // Check for duplicate company email
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

  // Normalise fields
  const id = `E-${Date.now()}`;
  const employee: any = {
    ...payload,
    id,
    email: payload.email?.trim().toLowerCase(),
    employeeId: payload.employeeId?.trim().toUpperCase() ?? id,
    status: payload.status ?? 'Active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(employee);

  return { ...employee, _id: result.insertedId };
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload
): Promise<Employee | null> {
  const collection = getEmployeeCollection();

  const updateData = {
    ...payload,
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
        { department: searchRegex },
        { role: searchRegex },
      ],
    })
    .toArray();

  return employees as Employee[];
}

export async function getEmployeesByDepartment(department: string): Promise<Employee[]> {
  const collection = getEmployeeCollection();
  const employees = await collection.find({ department }).toArray();
  return employees as Employee[];
}
