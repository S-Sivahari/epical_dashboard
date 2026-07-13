import { Types } from 'mongoose';
import { getDB } from '../config/db';
import { getEmployeeOfficialEmail } from '../utils/employeeAuth';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import { CellReviewModel } from '../models/CellReview';
import {
  notifyAllAdmins,
  createNotification,
  listAdminNotificationRecipients,
} from './notificationService';
import * as emailService from './emailService';

export type PendingReviewEntry = {
  reviewPoint: 'r1' | 'r2' | 'schematic';
  stageAtRequest: string;
};

type StageLike = { stageKey: string; status: string };

/** Detect layout review stages that newly entered pending_review. */
export function findNewlyPendingLayoutReviews(prev: StageLike[], next: StageLike[]): PendingReviewEntry[] {
  const map: Array<{ key: string; reviewPoint: 'r1' | 'r2'; stageAtRequest: string }> = [
    { key: 'review_1', reviewPoint: 'r1', stageAtRequest: 'drc_r1' },
    { key: 'review_2', reviewPoint: 'r2', stageAtRequest: 'lvs_r2' },
  ];
  const entries: PendingReviewEntry[] = [];
  for (const item of map) {
    const prevStatus = prev.find((s) => s.stageKey === item.key)?.status;
    const nextStatus = next.find((s) => s.stageKey === item.key)?.status;
    if (prevStatus !== 'pending_review' && nextStatus === 'pending_review') {
      entries.push({ reviewPoint: item.reviewPoint, stageAtRequest: item.stageAtRequest });
    }
  }
  return entries;
}

/** Detect schematic review stage newly entering pending_review. */
export function findNewlyPendingSchematicReview(
  prev: StageLike[],
  next: StageLike[],
): PendingReviewEntry | null {
  const prevStatus = prev.find((s) => s.stageKey === 'schematic_review')?.status;
  const nextStatus = next.find((s) => s.stageKey === 'schematic_review')?.status;
  if (prevStatus !== 'pending_review' && nextStatus === 'pending_review') {
    return { reviewPoint: 'schematic', stageAtRequest: 'schematic' };
  }
  return null;
}

/**
 * When a cell enters a review stage, ensure an open CellReview exists and notify admins
 * (in-app + email). Safe to call with an empty entries list.
 */
export async function ensurePendingReviewNotifications(params: {
  projectId: string;
  cellId: string;
  employeeName: string;
  initiatedBy: string;
  initiatedByName: string;
  assignedEmployeeId?: string | null;
  authorRole?: 'Admin' | 'Employee';
  entries: PendingReviewEntry[];
}): Promise<void> {
  if (!params.entries.length) return;

  for (const entry of params.entries) {
    try {
      let review =
        entry.reviewPoint === 'schematic'
          ? await CellReviewModel.findOne({
              cellId: params.cellId,
              status: 'open',
              stageAtRequest: 'schematic',
            })
          : await CellReviewModel.findOne({
              cellId: params.cellId,
              status: 'open',
              reviewPoint: entry.reviewPoint,
            });

      if (!review) {
        review = await CellReviewModel.create({
          projectId: new Types.ObjectId(params.projectId),
          cellId: new Types.ObjectId(params.cellId),
          stageAtRequest: entry.stageAtRequest,
          ...(entry.reviewPoint === 'r1' || entry.reviewPoint === 'r2'
            ? { reviewPoint: entry.reviewPoint }
            : {}),
          outcome: 'pending',
          status: 'open',
          initiatedBy: params.initiatedBy,
          initiatedByName: params.initiatedByName,
          assignedEmployeeId: params.assignedEmployeeId || undefined,
          messages: [
            {
              authorId: params.initiatedBy,
              authorName: params.initiatedByName,
              authorRole: params.authorRole || 'Employee',
              body: `${entry.reviewPoint.toUpperCase()} review pending`,
              at: new Date(),
            },
          ],
        });
      }

      await sendReviewNotificationsFromCell({
        projectId: params.projectId,
        cellId: params.cellId,
        reviewId: review._id.toString(),
        reviewPoint: entry.reviewPoint,
        stageAtRequest: entry.stageAtRequest,
        mode: 'requested',
        employeeName: params.employeeName,
      });
    } catch (err) {
      console.error(
        `[Cell Review] Failed to notify for pending ${entry.reviewPoint} on cell ${params.cellId}:`,
        err,
      );
    }
  }
}

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
  const employeeEmail = getEmployeeOfficialEmail(employee) || '';

  return {
    recipientId: String(employee.id || assigned),
    employeeName,
    employeeEmail,
  };
}

function formatReviewPointLabel(reviewPoint: string): string {
  const key = String(reviewPoint || '').trim().toLowerCase();
  if (key === 'r1' || key === 'review_1' || key === 'review1') return 'R1';
  if (key === 'r2' || key === 'review_2' || key === 'review2') return 'R2';
  if (key === 'schematic') return 'Schematic';
  return key ? key.toUpperCase() : 'Review';
}

function isLayoutR1OrR2(reviewPoint: string): boolean {
  const key = String(reviewPoint || '').trim().toLowerCase();
  return key === 'r1' || key === 'r2' || key === 'review_1' || key === 'review_2';
}

async function resolveTeamLeadEmailRecipient(
  projectId: string,
): Promise<{ recipientEmail: string; recipientName: string } | null> {
  const project = await ProjectModel.findById(projectId).lean();
  const leadToken = project?.teamLead?.trim();
  if (!leadToken) return null;

  const db = getDB();
  const employee = await db.collection('employees').findOne(
    { $or: [{ id: leadToken }, { employeeId: leadToken }] },
    { projection: { id: 1, employeeId: 1, firstName: 1, lastName: 1, email: 1, personalEmail: 1 } },
  );
  if (employee) {
    const email = getEmployeeOfficialEmail(employee);
    if (!email) return null;
    const name =
      [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || 'Team Lead';
    return { recipientEmail: email, recipientName: name };
  }

  const user = await db.collection('users').findOne({
    $or: [{ id: leadToken }, { email: leadToken }],
  });
  if (user?.email) {
    return {
      recipientEmail: String(user.email),
      recipientName: String(user.name || 'Team Lead'),
    };
  }
  return null;
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
  const reviewLabel = formatReviewPointLabel(params.reviewPoint);
  const stage = stageLabel(params.stageAtRequest);

  const title = `${reviewLabel} review requested`;
  const message = `${params.employeeName} requested ${reviewLabel} review for ${params.cellName} (${stage}) in ${params.projectName}.`;
  const relatedData = {
    projectId: params.projectId,
    cellId: params.cellId,
    reviewId: params.reviewId,
    projectName: params.projectName,
    cellName: params.cellName,
    reviewPoint: params.reviewPoint,
    stageAtRequest: params.stageAtRequest,
    employeeName: params.employeeName,
  };

  // In-app notification for every admin
  await notifyAllAdmins({
    type: 'CellReviewRequested',
    title,
    message,
    relatedId: params.reviewId,
    relatedData,
  });

  // Email only for layout R1 / R2 review requests
  if (!isLayoutR1OrR2(params.reviewPoint)) {
    return;
  }

  try {
    const admins = await listAdminNotificationRecipients();
    const recipients: Array<{ recipientEmail: string; recipientName: string }> = [];
    const seenEmails = new Set<string>();

    for (const admin of admins) {
      const email = admin.recipientEmail?.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seenEmails.has(key)) continue;
      seenEmails.add(key);
      recipients.push({
        recipientEmail: email,
        recipientName: admin.recipientName || 'Admin',
      });
    }

    const teamLead = await resolveTeamLeadEmailRecipient(params.projectId);
    if (teamLead) {
      const key = teamLead.recipientEmail.toLowerCase();
      if (!seenEmails.has(key)) {
        seenEmails.add(key);
        recipients.push(teamLead);
      }
    }

    if (!recipients.length) {
      console.warn(
        `[Cell Review] No email recipients found for ${reviewLabel} review on ${params.projectName}/${params.cellName}`,
      );
      return;
    }

    const results = await Promise.all(
      recipients.map((recipient) =>
        emailService.sendCellReviewRequestedEmail({
          recipientEmail: recipient.recipientEmail,
          recipientName: recipient.recipientName,
          employeeName: params.employeeName,
          projectId: params.projectId,
          cellId: params.cellId,
          projectName: params.projectName,
          cellName: params.cellName,
          reviewPoint: reviewLabel,
          stageLabel: stage,
        }),
      ),
    );
    const sent = results.filter(Boolean).length;
    console.log(
      `[Cell Review] Sent ${reviewLabel} review-request email to ${sent}/${recipients.length} recipient(s) for ${params.projectName}/${params.cellName}`,
    );
  } catch (error) {
    console.error(`[Cell Review] Failed to send ${reviewLabel} review-request emails:`, error);
  }
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

  const reviewLabel = formatReviewPointLabel(params.reviewPoint);
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
