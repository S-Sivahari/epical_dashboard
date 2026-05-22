import { ClientSession, Types } from 'mongoose';
import { ProjectModel } from '../models/Project';
import { TimesheetModel } from '../models/Timesheet';

/**
 * Determines whether a single timesheet entry is fully completed and approved.
 *
 * A task is considered complete when:
 *   - It has a logout time (session is not incomplete)
 *   - taskStatus is 'Completed'
 *   - Approval status is 'Approved'
 *   - requestStatus is NOT 'Pending Review' or 'Rejected'
 */
function getApprovalStatus(entry: any): 'Approved' | 'Pending' | 'Rejected' {
  return entry.approvalStatus || entry.status || 'Pending';
}

function isEntryCompletedAndApproved(entry: any): boolean {
  if (!entry.projectId) return false;
  if (entry.taskStatus !== 'Completed') return false;
  return getApprovalStatus(entry) === 'Approved';
}

export function getTimesheetWorkflowStatus(entry: any): 'Pending' | 'In Progress' | 'Completed' | 'Rejected' | 'Session Incomplete' | 'Pending Review' {
  const approvalStatus = getApprovalStatus(entry);

  if (approvalStatus === 'Rejected') return 'Rejected';
  if (entry.taskStatus === 'Session Incomplete') return 'Session Incomplete';
  if (entry.requestStatus === 'Pending Review') return 'Pending Review';
  if (entry.taskStatus === 'Completed' && approvalStatus === 'Approved') return 'Completed';
  if (entry.taskStatus === 'Completed') return 'Pending Review';
  if (entry.taskStatus === 'In Progress') return 'In Progress';
  return 'Pending';
}

/**
 * Centralized backend helper that recalculates and persists a project's
 * completion state based on its related timesheet/task entries.
 *
 * This function MUST be called after every timesheet mutation:
 *   - task completion
 *   - approval update
 *   - override update
 *   - task rejection
 *   - correction handling
 *   - task deletion
 *
 * It queries timesheets by the relational `projectId` ObjectId reference,
 * NOT by project name strings.
 *
 * @param projectId - Mongoose ObjectId (or string) of the project to update.
 * @returns The updated project document, or null if the project was not found.
 */
export async function updateProjectCompletionStatus(
  projectId: Types.ObjectId | string,
  session?: ClientSession
): Promise<any | null> {
  if (!projectId) return null;

  if (typeof projectId === 'string' && !Types.ObjectId.isValid(projectId)) {
    return null;
  }

  const objectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;

  const projectQuery = ProjectModel.findById(objectId);
  if (session) projectQuery.session(session);
  const project = await projectQuery;
  if (!project) return null;

  // Rejected projects are manually managed — do not auto-derive their status
  if (project.status === 'Rejected') return project;

  const timesheetQuery = TimesheetModel.find({ projectId: objectId });
  if (session) timesheetQuery.session(session);
  const relatedEntries = await timesheetQuery;

  const totalTasks = relatedEntries.length;
  const completedTasks = relatedEntries.filter(isEntryCompletedAndApproved).length;
  const completionPercentage = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // A project is Completed only when there are tasks AND all of them are done
  const nextStatus = (totalTasks > 0 && completedTasks === totalTasks)
    ? 'Completed'
    : 'Active';

  // Persist calculated state on the project document
  project.completedTasks = completedTasks;
  project.totalTasks = totalTasks;
  project.completionPercentage = completionPercentage;

  if (project.status !== nextStatus) {
    project.status = nextStatus;
  }

  await project.save(session ? { session } : undefined);
  return {
    project,
    totalTasks,
    completedTasks,
    completionPercentage,
    status: project.status,
  };
}

/**
 * Resolves a project reference by ObjectId and recalculates its status.
 * Used by controllers and services to keep project completion synchronized.
 */
export async function syncProjectStatus(
  arg: string | { projectId?: Types.ObjectId | string }
): Promise<any | null> {
  const projectId = typeof arg === 'string' ? arg : arg?.projectId;

  if (projectId) {
    return await updateProjectCompletionStatus(projectId);
  }
  return null;
}

/** Sync project status after a timesheet change using the relational projectId reference. */
export async function syncProjectForTimesheet(timesheet: {
  projectId?: Types.ObjectId | string | null;
}, session?: ClientSession): Promise<any | null> {
  if (timesheet.projectId) {
    return updateProjectCompletionStatus(timesheet.projectId, session);
  }
  return null;
}

