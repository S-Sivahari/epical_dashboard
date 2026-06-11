import { getDB } from '../config/db';
import { createNotification, notifyAllAdmins } from './notificationService';
import { resolveUserIdForDisplayName } from '../utils/assignedTaskSync';

async function resolveEmployeeRecipient(assignedEmployeeId?: string | null) {
  const assigned = assignedEmployeeId?.trim();
  if (!assigned) return null;

  const db = getDB();
  const employee = await db.collection('employees').findOne(
    { $or: [{ id: assigned }, { employeeId: assigned }] },
    { projection: { id: 1, employeeId: 1, firstName: 1, lastName: 1, email: 1, personalEmail: 1 } },
  );
  if (!employee) return { recipientId: assigned, employeeName: 'Engineer', employeeEmail: '' };

  const employeeName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || 'Engineer';
  const employeeEmail =
    (employee.email && String(employee.email).trim()) ||
    (employee.personalEmail && String(employee.personalEmail).trim()) ||
    '';

  return {
    recipientId: String(employee.id || assigned),
    employeeName,
    employeeEmail,
  };
}

async function resolveTeamLeadRecipient(teamLeadName?: string | null) {
  const name = teamLeadName?.trim();
  if (!name) return null;

  const recipientId = await resolveUserIdForDisplayName(name);
  if (!recipientId) return null;

  const db = getDB();
  const employee = await db.collection('employees').findOne(
    { $or: [{ id: recipientId }, { employeeId: recipientId }] },
    { projection: { id: 1, employeeId: 1, firstName: 1, lastName: 1 } },
  );

  return {
    recipientId: String(employee?.id || recipientId),
    employeeName: employee
      ? [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || name
      : name,
  };
}

export async function notifyCellCreatedUnassigned(params: {
  projectId: string;
  cellId: string;
  projectName: string;
  cellName: string;
  libraryName?: string;
  createdByName: string;
  teamLeadName?: string;
}): Promise<void> {
  const libraryPart = params.libraryName ? ` in ${params.libraryName}` : '';
  const message = `${params.createdByName} created ${params.cellName}${libraryPart} in ${params.projectName}. Assign an engineer to begin work.`;

  await notifyAllAdmins({
    type: 'CellCreatedUnassigned',
    title: 'New cell awaiting assignment',
    message,
    relatedId: params.cellId,
    relatedData: {
      projectId: params.projectId,
      cellId: params.cellId,
      projectName: params.projectName,
      cellName: params.cellName,
      libraryName: params.libraryName,
      createdByName: params.createdByName,
    },
  });

  const teamLead = await resolveTeamLeadRecipient(params.teamLeadName);
  if (!teamLead) return;

  await createNotification({
    recipientId: teamLead.recipientId,
    recipientType: 'Employee',
    type: 'CellCreatedUnassigned',
    title: 'New cell awaiting assignment',
    message,
    relatedId: params.cellId,
    relatedData: {
      projectId: params.projectId,
      cellId: params.cellId,
      projectName: params.projectName,
      cellName: params.cellName,
      libraryName: params.libraryName,
      createdByName: params.createdByName,
      employeeName: teamLead.employeeName,
    },
  });
}

export async function notifyEmployeeCellAssigned(params: {
  projectId: string;
  cellId: string;
  projectName: string;
  cellName: string;
  assignedEmployeeId: string;
  assignedEmployeeName?: string;
  assignedByName?: string;
}): Promise<void> {
  const recipient = await resolveEmployeeRecipient(params.assignedEmployeeId);
  if (!recipient) return;

  const assignerPart = params.assignedByName ? ` by ${params.assignedByName}` : '';
  const message = `You were assigned to ${params.cellName} in ${params.projectName}${assignerPart}. Open the cell to start workflow.`;

  await createNotification({
    recipientId: recipient.recipientId,
    recipientType: 'Employee',
    type: 'CellAssigned',
    title: 'Cell assigned to you',
    message,
    relatedId: params.cellId,
    relatedData: {
      projectId: params.projectId,
      cellId: params.cellId,
      projectName: params.projectName,
      cellName: params.cellName,
      employeeId: recipient.recipientId,
      employeeName: params.assignedEmployeeName?.trim() || recipient.employeeName,
      employeeEmail: recipient.employeeEmail,
      assignedByName: params.assignedByName,
    },
  });
}
