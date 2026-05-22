import { Types } from 'mongoose';
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
function isEntryCompletedAndApproved(entry: any): boolean {
  if (!entry.logoutTime) return false;
  if (entry.taskStatus !== 'Completed') return false;
  if (entry.status !== 'Approved') return false;
  if (entry.requestStatus === 'Pending Review' || entry.requestStatus === 'Rejected') return false;
  return true;
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
  projectId: Types.ObjectId | string
): Promise<any | null> {
  if (!projectId) return null;

  const objectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;

  const project = await ProjectModel.findById(objectId);
  if (!project) return null;

  // Rejected projects are manually managed — do not auto-derive their status
  if (project.status === 'Rejected') return project;

  // Match by ObjectId ref and by project name (legacy rows may lack projectId)
  const projectIdString = objectId.toString();
  const relatedEntries = await TimesheetModel.find({
    $or: [
      { projectId: objectId },
      { projectId: projectIdString },
      { project: project.projectName },
    ],
  });

  // Backfill projectId on name-only rows so future syncs stay consistent
  await TimesheetModel.updateMany(
    {
      project: project.projectName,
      $or: [
        { projectId: { $exists: false } },
        { projectId: null },
        { projectId: projectIdString },
      ],
    },
    { $set: { projectId: objectId } }
  );

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

  await project.save();
  return {
    project,
    totalTasks,
    completedTasks,
    completionPercentage,
    status: project.status,
  };
}

/**
 * Resolves a project reference (either as a string projectName, or an object
 * containing projectId and/or projectName) and recalculates its status.
 * Used by controllers and services (like ticketService and projectController) to sync statuses.
 */
export async function syncProjectStatus(
  arg: string | { projectId?: Types.ObjectId | string; projectName?: string }
): Promise<any | null> {
  let projectId: Types.ObjectId | string | undefined;

  if (typeof arg === 'string') {
    const project = await ProjectModel.findOne({ projectName: arg });
    if (project) {
      projectId = project._id as Types.ObjectId;
    }
  } else if (arg && typeof arg === 'object') {
    if (arg.projectId) {
      projectId = arg.projectId;
    } else if (arg.projectName) {
      const project = await ProjectModel.findOne({ projectName: arg.projectName });
      if (project) {
        projectId = project._id as Types.ObjectId;
      }
    }
  }

  if (projectId) {
    return await updateProjectCompletionStatus(projectId);
  }
  return null;
}

/** Sync project status after a timesheet change when projectId may be missing on the row. */
export async function syncProjectForTimesheet(timesheet: {
  projectId?: Types.ObjectId | string | null;
  project?: string;
}): Promise<any | null> {
  if (timesheet.projectId) {
    return updateProjectCompletionStatus(timesheet.projectId);
  }
  if (timesheet.project) {
    return syncProjectStatus({ projectName: timesheet.project });
  }
  return null;
}

