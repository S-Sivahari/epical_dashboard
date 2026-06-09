import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import { notifyAllAdmins, createNotification } from './notificationService';

const STAGE_LABELS: Record<string, string> = {
  floor_plan: 'Floor Plan',
  drc_r1: 'DRC (R1)',
  routing: 'Routing',
  drc: 'DRC',
  lvs_r2: 'LVS (R2)',
};

function stageLabel(stage?: string | null) {
  if (!stage) return 'Layout';
  return STAGE_LABELS[stage] || String(stage).replace(/_/g, ' ');
}

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

export async function notifyAdminsCellReviewRequested(params: {
  projectId: string;
  cellId: string;
  reviewId: string;
  reviewPoint: string;
  stageAtRequest: string;
  employeeName: string;
  cellName: string;
  projectName: string;
}): Promise<void> {
  const reviewLabel = params.reviewPoint.toUpperCase();
  const stage = stageLabel(params.stageAtRequest);

  await notifyAllAdmins({
    type: 'CellReviewRequested',
    title: `${reviewLabel} review requested`,
    message: `${params.employeeName} requested ${reviewLabel} review for ${params.cellName} (${stage}) in ${params.projectName}.`,
    relatedId: params.reviewId,
    relatedData: {
      projectId: params.projectId,
      cellId: params.cellId,
      reviewId: params.reviewId,
      projectName: params.projectName,
      cellName: params.cellName,
      reviewPoint: params.reviewPoint,
      stageAtRequest: params.stageAtRequest,
      employeeName: params.employeeName,
    },
  });
}

export async function notifyEmployeeCellReviewResolved(params: {
  projectId: string;
  cellId: string;
  reviewId: string;
  reviewPoint: string;
  stageAtRequest: string;
  outcome: 'approved' | 'rejected';
  returnToStage?: string | null;
  resolvedByName?: string;
  assignedEmployeeId?: string | null;
  cellName: string;
  projectName: string;
}): Promise<void> {
  const recipient = await resolveEmployeeRecipient(params.assignedEmployeeId);
  if (!recipient) return;

  const reviewLabel = params.reviewPoint.toUpperCase();
  const stage = stageLabel(params.stageAtRequest);
  const approved = params.outcome === 'approved';
  const type = approved ? 'CellReviewApproved' : 'CellReviewRejected';

  const title = approved ? `${reviewLabel} review approved` : `${reviewLabel} review rejected`;
  const message = approved
    ? `Your ${reviewLabel} review for ${params.cellName} (${stage}) in ${params.projectName} was approved${params.resolvedByName ? ` by ${params.resolvedByName}` : ''}.`
    : `Your ${reviewLabel} review for ${params.cellName} (${stage}) in ${params.projectName} was rejected${params.resolvedByName ? ` by ${params.resolvedByName}` : ''}${
        params.returnToStage ? `. Returned to ${stageLabel(params.returnToStage)}` : ''
      }.`;

  await createNotification({
    recipientId: recipient.recipientId,
    recipientType: 'Employee',
    type,
    title,
    message,
    relatedId: params.reviewId,
    relatedData: {
      projectId: params.projectId,
      cellId: params.cellId,
      reviewId: params.reviewId,
      projectName: params.projectName,
      cellName: params.cellName,
      reviewPoint: params.reviewPoint,
      stageAtRequest: params.stageAtRequest,
      reviewOutcome: params.outcome,
      returnToStage: params.returnToStage || undefined,
      resolvedByName: params.resolvedByName,
      employeeId: recipient.recipientId,
      employeeName: recipient.employeeName,
      employeeEmail: recipient.employeeEmail,
    },
  });
}

export async function sendReviewNotificationsFromCell(params: {
  projectId: string;
  cellId: string;
  reviewId: string;
  reviewPoint: string;
  stageAtRequest: string;
  mode: 'requested' | 'resolved';
  outcome?: 'approved' | 'rejected';
  returnToStage?: string | null;
  resolvedByName?: string;
  employeeName?: string;
}): Promise<void> {
  const project = await ProjectModel.findById(params.projectId).lean();
  const cell = await ProjectCellModel.findOne({ _id: params.cellId, projectId: params.projectId }).lean();
  if (!project || !cell) return;

  const projectName = project.projectName || 'Project';
  const cellName = cell.name || 'Cell';

  if (params.mode === 'requested') {
    await notifyAdminsCellReviewRequested({
      projectId: params.projectId,
      cellId: params.cellId,
      reviewId: params.reviewId,
      reviewPoint: params.reviewPoint,
      stageAtRequest: params.stageAtRequest,
      employeeName: params.employeeName || cell.assignedEmployeeName || 'Engineer',
      cellName,
      projectName,
    });
    return;
  }

  if (!params.outcome) return;

  await notifyEmployeeCellReviewResolved({
    projectId: params.projectId,
    cellId: params.cellId,
    reviewId: params.reviewId,
    reviewPoint: params.reviewPoint,
    stageAtRequest: params.stageAtRequest,
    outcome: params.outcome,
    returnToStage: params.returnToStage,
    resolvedByName: params.resolvedByName,
    assignedEmployeeId: cell.assignedEmployeeId,
    cellName,
    projectName,
  });
}
