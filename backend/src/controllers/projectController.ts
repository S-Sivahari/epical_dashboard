import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { updateProjectCompletionStatus, getTimesheetWorkflowStatus } from '../utils/syncProject';
import {
  buildAssignmentIdentityTokens,
  ensureAssignedTasksForEmployee,
  syncAssignedTasksForProject,
} from '../utils/assignedTaskSync';
import { getUserById } from '../services/authService';

function computeTotalHours(loginTime: Date, logoutTime?: Date, overriddenHours?: number): number {
  if (overriddenHours !== undefined && overriddenHours !== null) {
    return Number(overriddenHours);
  }
  if (!logoutTime) return 0;
  const diffMs = logoutTime.getTime() - loginTime.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

function toFrontendTimesheet(t: any) {
  const dateOnly = t.loginTime ? new Date(t.loginTime).toISOString().split('T')[0] : '';
  return {
    id: t._id.toString(),
    employeeId: t.employeeId,
    employeeName: t.employee,
    projectId: t.projectId ? t.projectId.toString() : '',
    project: t.project,
    client: t.client || '',
    technologyNode: t.technologyNode || '',
    date: dateOnly,
    loginTime: t.loginTime ? t.loginTime.toISOString() : '',
    logoutTime: t.logoutTime ? t.logoutTime.toISOString() : undefined,
    correctionRequest: t.correctionRequest && t.correctionRequest.requestedLogin ? {
      requestedLogin: t.correctionRequest.requestedLogin.toISOString(),
      requestedLogout: t.correctionRequest.requestedLogout ? t.correctionRequest.requestedLogout.toISOString() : '',
      reason: t.correctionRequest.reason || '',
      message: t.correctionRequest.message || '',
    } : undefined,
    requestStatus: t.requestStatus || 'No Request',
    status: t.approvalStatus || t.status || 'Pending',
    approvalStatus: t.approvalStatus || t.status || 'Pending',
    billable: t.billable !== undefined ? t.billable : true,
    task: t.task || '',
    adminNotes: t.adminNotes,
    overriddenHours: t.overriddenHours,
    totalHours: t.totalHours,
    taskStatus: t.taskStatus || (t.logoutTime ? 'Pending' : 'Session Incomplete'),
    workflowStatus: getTimesheetWorkflowStatus(t),
  };
}

// Helper to map Mongoose project to frontend format
function toFrontendProject(p: any) {
  return {
    id: p._id.toString(),
    name: p.projectName,
    client: p.clientName,
    technologyNode: p.technologyNode,
    accessType: p.accessType,
    status: p.status,
    description: p.description,
    visibleUsers: p.allowedUsers || [],
    teamLead: p.teamLead || '',
    completedTasks: p.completedTasks ?? 0,
    totalTasks: p.totalTasks ?? 0,
    completionPercentage: p.completionPercentage ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function resolveTimesheetForProject(projectId: string, timesheetId: string) {
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(timesheetId)) {
    return null;
  }
  const projectObjectId = new Types.ObjectId(projectId);
  const project = await ProjectModel.findById(projectObjectId);
  const timesheet = await TimesheetModel.findById(timesheetId);
  if (!timesheet || !project) return null;

  const linkedById =
    timesheet.projectId && timesheet.projectId.toString() === projectObjectId.toString();
  const linkedByName = timesheet.project === project.projectName;

  if (!linkedById && !linkedByName) {
    return null;
  }

  if (!timesheet.projectId) {
    timesheet.projectId = projectObjectId;
    timesheet.project = project.projectName;
    await timesheet.save();
  }

  return { timesheet, projectObjectId };
}

export const projectController = {
  // GET /api/projects
  getAll: async (req: Request, res: Response): Promise<void> => {
    try {
      const { client, name, team, status, accessType, technologyNode, search } = req.query;
      const query: any = {};

      if (client && client !== 'all') query.clientName = client;
      if (name && name !== 'all') query.projectName = name;
      // Team filter is applied on the frontend using team lead department
      if (status && status !== 'all') query.status = status;
      if (accessType && accessType !== 'all') query.accessType = accessType;
      if (technologyNode && technologyNode !== 'all') query.technologyNode = technologyNode;

      if (search) {
        const searchRegex = new RegExp(search as string, 'i');
        query.$or = [
          { projectName: searchRegex },
          { clientName: searchRegex },
          { technologyNode: searchRegex },
          { description: searchRegex }
        ];
      }

      const refreshedProjects = await ProjectModel.find(query).sort({ createdAt: -1 });
      res.json(refreshedProjects.map(toFrontendProject));
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  },

  // GET /api/projects/assigned/me — projects visible to the logged-in employee
  getAssignedForCurrentUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await getUserById(userId);
      if (!user?.name) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const employeeRecord = user.email
        ? await getDB().collection('employees').findOne({ email: user.email.toLowerCase().trim() })
        : null;

      const employeeName = employeeRecord
        ? [employeeRecord.firstName, employeeRecord.middleName, employeeRecord.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || user.name
        : user.name;

      const assignmentTokens = buildAssignmentIdentityTokens(user, employeeRecord);

      await ensureAssignedTasksForEmployee({
        id: user.id,
        name: user.name,
        email: user.email,
        employeeId: employeeRecord?.employeeId,
        employeeName,
      });

      const assignedProjects = await ProjectModel.find({
        $or: [
          { accessType: 'public' },
          { allowedUsers: { $in: assignmentTokens } },
          { teamLead: { $in: assignmentTokens } },
        ],
      }).sort({ createdAt: -1 });

      const timesheets = await TimesheetModel.find({
        $or: [{ employeeId: userId }, { employee: employeeName }],
      });

      const hoursByProjectName: Record<string, number> = {};
      timesheets.forEach((t) => {
        const hours = computeTotalHours(t.loginTime, t.logoutTime, t.overriddenHours);
        const key = t.project || '';
        if (!key) return;
        hoursByProjectName[key] = (hoursByProjectName[key] || 0) + hours;
      });

      const payload = assignedProjects.map((p) => {
        const base = toFrontendProject(p);
        const allowed = p.allowedUsers || [];
        let assignmentRole: 'Team Lead' | 'Member' | 'Public' = 'Public';
        if (p.teamLead && assignmentTokens.includes(p.teamLead)) {
          assignmentRole = 'Team Lead';
        } else if (p.accessType === 'private' && allowed.some((allowedUser: string) => assignmentTokens.includes(allowedUser))) {
          assignmentRole = 'Member';
        }

        return {
          ...base,
          myHours: Math.round((hoursByProjectName[p.projectName] || 0) * 10) / 10,
          assignmentRole,
        };
      });

      res.json(payload);
    } catch (error) {
      console.error('Error fetching assigned projects:', error);
      res.status(500).json({ error: 'Failed to fetch assigned projects' });
    }
  },

  // GET /api/projects/:id/assigned-tasks
  getProjectAssignedTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const tasks = await AssignedTaskModel.find({ projectId: project._id }).sort({ createdAt: -1 });

      for (const task of tasks) {
        if (!task.timesheetId || task.status === 'completed' || task.status === 'pending_review') {
          continue;
        }
        const ts = await TimesheetModel.findById(task.timesheetId);
        if (!ts?.logoutTime) continue;
        if (ts.taskStatus === 'Completed' && (ts.approvalStatus === 'Pending' || ts.status === 'Pending')) {
          task.status = 'pending_review';
          await task.save();
        }
      }

      res.json(
        tasks.map((t) => ({
          id: t._id.toString(),
          employeeId: t.employeeId,
          employeeName: t.employeeName,
          title: t.title,
          description: t.description,
          status: t.status,
          timesheetId: t.timesheetId ? t.timesheetId.toString() : undefined,
        }))
      );
    } catch (error) {
      console.error('Error fetching project assigned tasks:', error);
      res.status(500).json({ error: 'Failed to fetch assigned tasks' });
    }
  },

  // GET /api/projects/:id
  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const refreshedProject = await ProjectModel.findById(project._id);
      res.json(toFrontendProject(refreshedProject || project));
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  },

  // POST /api/projects
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, client, technologyNode, accessType, description, visibleUsers, teamLead } = req.body;

      if (!name || !client || !technologyNode) {
        res.status(400).json({ error: 'Project Name, Client, and Technology Node are required' });
        return;
      }

      const username = (req as any).user?.username || (req as any).user?.name || 'Admin';

      const project = new ProjectModel({
        projectName: name.trim(),
        clientName: client.trim(),
        technologyNode: technologyNode.trim(),
        accessType: accessType || 'public',
        status: 'Active', // new projects always default to Active
        description: (description || '').trim(),
        allowedUsers: accessType === 'private' ? (visibleUsers || []) : [],
        teamLead: accessType === 'private' && teamLead ? String(teamLead).trim() : undefined,
        createdBy: username,
      });

      await project.save();
      await syncAssignedTasksForProject(project);
      res.status(201).json(toFrontendProject(project));
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  },

  // PUT /api/projects/:id
  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, client, technologyNode, accessType, description, visibleUsers, teamLead } = req.body;

      if (!name || !client || !technologyNode) {
        res.status(400).json({ error: 'Project Name, Client, and Technology Node are required' });
        return;
      }

      const project = await ProjectModel.findById(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const newProjectName = name.trim();

      project.projectName = newProjectName;
      project.clientName = client.trim();
      project.technologyNode = technologyNode.trim();
      project.accessType = accessType;
      project.description = (description || '').trim();
      project.allowedUsers = accessType === 'private' ? (visibleUsers || []) : [];
      project.teamLead = accessType === 'private' && teamLead ? String(teamLead).trim() : undefined;

      const session = await mongoose.startSession();
      try {
        let updatedProject = project;
        await session.withTransaction(async () => {
          await project.save({ session });

          await TimesheetModel.updateMany(
            { projectId: project._id },
            { $set: { project: newProjectName, client: client.trim(), technologyNode: technologyNode.trim() } },
            { session }
          );

          const syncResult = await updateProjectCompletionStatus(project._id, session);
          updatedProject = syncResult?.project ?? project;
        });

        await syncAssignedTasksForProject(updatedProject);

        res.json(toFrontendProject(updatedProject));
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  },

  // DELETE /api/projects/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await TimesheetModel.deleteMany({ projectId: project._id }, { session });
          await AssignedTaskModel.deleteMany({ projectId: project._id }, { session });
          await ProjectModel.findByIdAndDelete(req.params.id, { session });
        });
      } finally {
        session.endSession();
      }

      res.json({ message: 'Project and associated logs deleted successfully' });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  },

  // PATCH /api/projects/:id/sync-status
  syncStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const synced = await updateProjectCompletionStatus(project._id);
      res.json(toFrontendProject(synced?.project || project));
    } catch (error) {
      console.error('Error syncing project status:', error);
      res.status(500).json({ error: 'Failed to sync project status' });
    }
  },

  // PATCH /api/projects/:id/complete
  markCompleted: async (req: Request, res: Response): Promise<void> => {
    res.status(400).json({
      error: 'Manual completion of projects is disabled. Project status is derived from task completion and approval.'
    });
  },

  // PATCH /api/projects/:id/task-approve
  taskApprove: async (req: Request, res: Response): Promise<void> => {
    try {
      const { timesheetId, applyCorrection } = req.body;
      if (!timesheetId) {
        res.status(400).json({ error: 'timesheetId is required' });
        return;
      }

      const projectId = String(req.params.id);
      const resolved = await resolveTimesheetForProject(projectId, timesheetId);
      if (!resolved) {
        res.status(404).json({ error: 'Timesheet entry not found for this project' });
        return;
      }

      const { timesheet, projectObjectId } = resolved;
      const session = await mongoose.startSession();

      try {
        let project = await ProjectModel.findById(projectObjectId);
        await session.withTransaction(async () => {
          if (applyCorrection && timesheet.correctionRequest) {
            timesheet.loginTime = timesheet.correctionRequest.requestedLogin;
            timesheet.logoutTime = timesheet.correctionRequest.requestedLogout;
            timesheet.requestStatus = 'Approved';
          } else if (timesheet.requestStatus === 'Pending Review') {
            timesheet.requestStatus = 'Approved';
          }

          timesheet.approvalStatus = 'Approved';
          timesheet.status = 'Approved';
          timesheet.taskStatus = 'Completed';
          timesheet.totalHours = computeTotalHours(
            timesheet.loginTime,
            timesheet.logoutTime,
            timesheet.overriddenHours
          );

          await timesheet.save({ session });
          const syncResult = await updateProjectCompletionStatus(projectObjectId, session);
          project = syncResult?.project ?? project;
        });

        res.json({
          timesheet: toFrontendTimesheet(timesheet),
          project: project ? toFrontendProject(project) : null,
        });
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error approving project task:', error);
      res.status(500).json({ error: 'Failed to approve task' });
    }
  },

  // PATCH /api/projects/:id/assigned-tasks/:taskId/complete
  assignedTaskComplete: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = String(req.params.id);
      const assignedTaskId = String(req.params.taskId);

      if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(assignedTaskId)) {
        res.status(400).json({ error: 'Invalid project or task id' });
        return;
      }

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const assigned = await AssignedTaskModel.findOne({
        _id: assignedTaskId,
        projectId: project._id,
      });

      if (!assigned) {
        res.status(404).json({ error: 'Assigned task not found' });
        return;
      }

      if (assigned.status === 'completed') {
        const synced = await updateProjectCompletionStatus(project._id);
        res.json({
          assignedTask: {
            id: assigned._id.toString(),
            employeeId: assigned.employeeId,
            employeeName: assigned.employeeName,
            title: assigned.title,
            status: assigned.status,
            timesheetId: assigned.timesheetId ? assigned.timesheetId.toString() : undefined,
          },
          project: synced?.project ? toFrontendProject(synced.project) : toFrontendProject(project),
        });
        return;
      }

      const session = await mongoose.startSession();

      try {
        let updatedProject = project;
        await session.withTransaction(async () => {
          if (assigned.timesheetId) {
            const timesheet = await TimesheetModel.findById(assigned.timesheetId).session(session);
            if (timesheet) {
              const now = new Date();
              if (!timesheet.logoutTime) {
                timesheet.logoutTime = now;
              }
              timesheet.taskStatus = 'Completed';
              timesheet.approvalStatus = 'Approved';
              timesheet.status = 'Approved';
              if (timesheet.requestStatus !== 'Rejected') {
                timesheet.requestStatus = 'Approved';
              }
              timesheet.totalHours = computeTotalHours(
                timesheet.loginTime,
                timesheet.logoutTime,
                timesheet.overriddenHours
              );
              await timesheet.save({ session });
            }
          }

          assigned.status = 'completed';
          await assigned.save({ session });

          const syncResult = await updateProjectCompletionStatus(project._id, session);
          updatedProject = syncResult?.project ?? updatedProject;
        });

        res.json({
          assignedTask: {
            id: assigned._id.toString(),
            employeeId: assigned.employeeId,
            employeeName: assigned.employeeName,
            title: assigned.title,
            status: assigned.status,
            timesheetId: assigned.timesheetId ? assigned.timesheetId.toString() : undefined,
          },
          project: toFrontendProject(updatedProject),
        });
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error completing assigned task:', error);
      res.status(500).json({ error: 'Failed to complete assigned task' });
    }
  },

  // PATCH /api/projects/:id/task-complete
  taskComplete: async (req: Request, res: Response): Promise<void> => {
    try {
      const { timesheetId } = req.body;
      if (!timesheetId) {
        res.status(400).json({ error: 'timesheetId is required' });
        return;
      }

      const projectId = String(req.params.id);
      const resolved = await resolveTimesheetForProject(projectId, timesheetId);
      if (!resolved) {
        res.status(404).json({ error: 'Timesheet entry not found for this project' });
        return;
      }

      const { timesheet, projectObjectId } = resolved;
      const { applyCorrection } = req.body;
      const session = await mongoose.startSession();

      try {
        let project = await ProjectModel.findById(projectObjectId);
        await session.withTransaction(async () => {
          if (applyCorrection && timesheet.correctionRequest) {
            timesheet.loginTime = timesheet.correctionRequest.requestedLogin;
            timesheet.logoutTime = timesheet.correctionRequest.requestedLogout;
          }

          if (!timesheet.logoutTime) {
            timesheet.taskStatus = 'Session Incomplete';
            timesheet.approvalStatus = 'Pending';
            timesheet.status = 'Pending';
          } else {
            timesheet.taskStatus = 'Completed';
            timesheet.approvalStatus = 'Approved';
            timesheet.status = 'Approved';
            if (timesheet.requestStatus !== 'Rejected') {
              timesheet.requestStatus = 'Approved';
            }
          }

          timesheet.totalHours = computeTotalHours(
            timesheet.loginTime,
            timesheet.logoutTime,
            timesheet.overriddenHours
          );

          await timesheet.save({ session });

          if (timesheet.taskStatus === 'Completed') {
            await AssignedTaskModel.updateMany(
              {
                $or: [
                  { timesheetId: timesheet._id },
                  {
                    projectId: timesheet.projectId,
                    employeeId: timesheet.employeeId,
                    status: 'pending_review',
                  },
                ],
              },
              { $set: { status: 'completed' } },
              { session }
            );
          }

          const syncResult = await updateProjectCompletionStatus(projectObjectId, session);
          project = syncResult?.project ?? project;
        });

        res.json({
          timesheet: toFrontendTimesheet(timesheet),
          project: project ? toFrontendProject(project) : null,
        });
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error completing project task:', error);
      res.status(500).json({ error: 'Failed to mark task completed' });
    }
  },
};
