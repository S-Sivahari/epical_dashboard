import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ProjectModel } from '../models/Project';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { syncProjectStatus, updateProjectCompletionStatus } from '../utils/syncProject';
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
    status: t.status || 'Pending',
    billable: t.billable !== undefined ? t.billable : true,
    task: t.task || '',
    adminNotes: t.adminNotes,
    overriddenHours: t.overriddenHours,
    totalHours: t.totalHours,
    taskStatus: t.taskStatus || (t.logoutTime ? 'Pending' : 'Session Incomplete'),
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
  const timesheet = await TimesheetModel.findById(timesheetId);
  if (!timesheet) return null;
  if (!timesheet.projectId || timesheet.projectId.toString() !== projectObjectId.toString()) {
    return null;
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
      // Team filter is applied on the frontend using team lead team
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

      const allProjects = await ProjectModel.find({}).sort({ createdAt: -1 });
      await Promise.all(allProjects.map((project) => syncProjectStatus({ projectId: project._id.toString(), projectName: project.projectName })));
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

      const employeeName = user.name;

      const allProjects = await ProjectModel.find({}).sort({ createdAt: -1 });
      await Promise.all(
        allProjects.map((project) =>
          syncProjectStatus({ projectId: project._id.toString(), projectName: project.projectName })
        )
      );

      const assignedProjects = await ProjectModel.find({
        $or: [
          { accessType: 'public' },
          { allowedUsers: employeeName },
          { teamLead: employeeName },
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
        if (p.teamLead === employeeName) {
          assignmentRole = 'Team Lead';
        } else if (p.accessType === 'private' && allowed.includes(employeeName)) {
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

  // GET /api/projects/:id
  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await ProjectModel.findById(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      await syncProjectStatus({ projectId: project._id.toString(), projectName: project.projectName });
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

      // If project name changes, we need to update related timesheets project name too
      const oldProjectName = project.projectName;
      const newProjectName = name.trim();

      project.projectName = newProjectName;
      project.clientName = client.trim();
      project.technologyNode = technologyNode.trim();
      project.accessType = accessType;
      project.description = (description || '').trim();
      project.allowedUsers = accessType === 'private' ? (visibleUsers || []) : [];
      project.teamLead = accessType === 'private' && teamLead ? String(teamLead).trim() : undefined;

      await project.save();

      const projectObjectId = project._id as Types.ObjectId;
      if (oldProjectName !== newProjectName) {
        await TimesheetModel.updateMany(
          { $or: [{ project: oldProjectName }, { projectId: projectObjectId }, { projectId: projectObjectId.toString() }] },
          { $set: { projectId: projectObjectId, project: newProjectName, client: client.trim(), technologyNode: technologyNode.trim() } }
        );
      } else {
        await TimesheetModel.updateMany(
          { $or: [{ project: oldProjectName }, { projectId: projectObjectId }, { projectId: projectObjectId.toString() }] },
          { $set: { projectId: projectObjectId, client: client.trim(), technologyNode: technologyNode.trim() } }
        );
      }

      // Sync project status dynamically from related timesheets
      await syncProjectStatus({ projectId: project._id.toString(), projectName: newProjectName });

      // Re-fetch project to return updated status
      const updatedProject = await ProjectModel.findById(project._id);
      res.json(toFrontendProject(updatedProject || project));
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

      // Cascade delete timesheet logs for this project
      await TimesheetModel.deleteMany({
        $or: [
          { project: project.projectName },
          { projectId: project._id },
          { projectId: project._id.toString() },
        ],
      });
      await ProjectModel.findByIdAndDelete(req.params.id);

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

      // Recalculate and update project status based on task completion
      await syncProjectStatus({ projectId: project._id.toString(), projectName: project.projectName });

      // Re-fetch project to return updated status
      const updatedProject = await ProjectModel.findById(project._id);
      res.json(toFrontendProject(updatedProject || project));
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

      if (applyCorrection && timesheet.correctionRequest) {
        timesheet.loginTime = timesheet.correctionRequest.requestedLogin;
        timesheet.logoutTime = timesheet.correctionRequest.requestedLogout;
        timesheet.requestStatus = 'Approved';
      } else if (timesheet.requestStatus === 'Pending Review') {
        timesheet.requestStatus = 'Approved';
      }

      timesheet.status = 'Approved';
      timesheet.taskStatus = 'Completed';
      timesheet.totalHours = computeTotalHours(
        timesheet.loginTime,
        timesheet.logoutTime,
        timesheet.overriddenHours
      );

      await timesheet.save();
      const syncResult = await updateProjectCompletionStatus(projectObjectId);
      const project = syncResult?.project ?? (await ProjectModel.findById(projectObjectId));

      res.json({
        timesheet: toFrontendTimesheet(timesheet),
        project: project ? toFrontendProject(project) : null,
      });
    } catch (error) {
      console.error('Error approving project task:', error);
      res.status(500).json({ error: 'Failed to approve task' });
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

      if (applyCorrection && timesheet.correctionRequest) {
        timesheet.loginTime = timesheet.correctionRequest.requestedLogin;
        timesheet.logoutTime = timesheet.correctionRequest.requestedLogout;
      }

      if (!timesheet.logoutTime) {
        timesheet.taskStatus = 'Session Incomplete';
      } else {
        timesheet.taskStatus = 'Completed';
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

      await timesheet.save();

      if (timesheet.taskStatus === 'Completed') {
        await AssignedTaskModel.updateOne(
          { timesheetId: timesheet._id },
          { $set: { status: 'completed' } }
        );
      }

      const syncResult = await updateProjectCompletionStatus(projectObjectId);
      const project = syncResult?.project ?? (await ProjectModel.findById(projectObjectId));

      res.json({
        timesheet: toFrontendTimesheet(timesheet),
        project: project ? toFrontendProject(project) : null,
      });
    } catch (error) {
      console.error('Error completing project task:', error);
      res.status(500).json({ error: 'Failed to mark task completed' });
    }
  },
};
