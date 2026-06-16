import { getDB } from '../config/db';
import type { Employee } from '../models/Employee';
import {
  getEmployeeLoginEmails,
  normalizeLoginEmail,
  syncUserAccountFromEmployee,
} from '../utils/employeeAuth';

function buildDisplayName(employee: Pick<Employee, 'firstName' | 'middleName' | 'lastName'>): string {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim();
}

function nameChanged(before: Employee, after: Employee): boolean {
  return buildDisplayName(before) !== buildDisplayName(after);
}

function employeeIdChanged(before: Employee, after: Employee): boolean {
  return String(before.employeeId || '') !== String(after.employeeId || '');
}

function emailChanged(before: Employee, after: Employee): boolean {
  const beforeEmails = new Set(
    [before.email, before.personalEmail].filter(Boolean).map((e) => normalizeLoginEmail(String(e))),
  );
  const afterEmails = getEmployeeLoginEmails(after);
  if (beforeEmails.size !== afterEmails.length) return true;
  return afterEmails.some((e) => !beforeEmails.has(e));
}

/**
 * Keep denormalized employee name/email/id fields in sync after an admin profile edit.
 */
export async function propagateEmployeeProfileChanges(
  before: Employee,
  after: Employee,
): Promise<void> {
  const db = getDB();
  const dbId = String(after.id);
  const displayName = buildDisplayName(after);
  const nameDirty = nameChanged(before, after);
  const idDirty = employeeIdChanged(before, after);
  const emailDirty = emailChanged(before, after);

  if (!nameDirty && !idDirty && !emailDirty) {
    await syncUserAccountFromEmployee(after);
    return;
  }

  const nameUpdate = nameDirty ? { employeeName: displayName } : {};
  const idUpdate = idDirty ? { employeeId: String(after.employeeId || '') } : {};
  const emailUpdate =
    emailDirty && after.email
      ? { employeeEmail: normalizeLoginEmail(String(after.email)) }
      : emailDirty && after.personalEmail
        ? { employeeEmail: normalizeLoginEmail(String(after.personalEmail)) }
        : {};

  const payslipPatch = { ...nameUpdate, ...idUpdate, ...emailUpdate };
  if (Object.keys(payslipPatch).length > 0) {
    await db.collection('employee_payslips').updateMany({ employeeDbId: dbId }, { $set: payslipPatch });
  }

  if (nameDirty) {
    await Promise.all([
      db.collection('document_requests').updateMany(
        { $or: [{ employeeUserId: dbId }, { employeeId: dbId }] },
        { $set: { employeeName: displayName } },
      ),
      db.collection('leaves').updateMany({ employeeId: dbId }, { $set: { employeeName: displayName } }),
      db.collection('tickets').updateMany({ employeeId: dbId }, { $set: { employeeName: displayName } }),
      db.collection('compensation_entries').updateMany(
        { employeeId: dbId },
        { $set: { employeeName: displayName } },
      ),
      db.collection('course_enrollments').updateMany(
        { employeeId: dbId },
        { $set: { employeeName: displayName } },
      ),
    ]);

    const { AssignedTaskModel } = await import('../models/AssignedTask');
    const { TimesheetModel } = await import('../models/Timesheet');
    const { EmployeeAttendanceModel } = await import('../models/EmployeeAttendance');

    await Promise.all([
      AssignedTaskModel.updateMany({ employeeId: dbId }, { $set: { employeeName: displayName } }),
      TimesheetModel.updateMany({ employeeId: dbId }, { $set: { employee: displayName } }),
      EmployeeAttendanceModel.updateMany({ employeeId: dbId }, { $set: { employeeName: displayName } }),
    ]);
  }

  if (idDirty) {
    await db.collection('document_requests').updateMany(
      { employeeUserId: dbId },
      { $set: { employeeId: String(after.employeeId || dbId) } },
    );
  }

  await syncUserAccountFromEmployee(after);
}
