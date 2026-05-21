import { Request, Response } from 'express';
import { ProjectModel } from '../models/Project';
import { TimesheetModel } from '../models/Timesheet';

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
    assignedTeamName: p.assignedTeamName,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export const projectController = {
  // GET /api/projects
  getAll: async (req: Request, res: Response): Promise<void> => {
    try {
      const { client, name, team, status, accessType, technologyNode, search } = req.query;
      const query: any = {};

      if (client && client !== 'all') query.clientName = client;
      if (name && name !== 'all') query.projectName = name;
      if (team && team !== 'all') query.assignedTeamName = team;
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

      const projects = await ProjectModel.find(query).sort({ createdAt: -1 });
      res.json(projects.map(toFrontendProject));
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
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
      res.json(toFrontendProject(project));
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  },

  // POST /api/projects
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, client, technologyNode, accessType, description, visibleUsers, assignedTeamName } = req.body;

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
        assignedTeamName: accessType === 'private' ? assignedTeamName : undefined,
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
      const { name, client, technologyNode, accessType, description, status, visibleUsers, assignedTeamName } = req.body;

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
      project.status = status || project.status;
      project.description = (description || '').trim();
      project.allowedUsers = accessType === 'private' ? (visibleUsers || []) : [];
      project.assignedTeamName = accessType === 'private' ? assignedTeamName : undefined;

      await project.save();

      if (oldProjectName !== newProjectName) {
        await TimesheetModel.updateMany(
          { project: oldProjectName },
          { $set: { project: newProjectName, client: client.trim(), technologyNode: technologyNode.trim() } }
        );
      } else {
        // Even if name didn't change, client/techNode might have changed
        await TimesheetModel.updateMany(
          { project: oldProjectName },
          { $set: { client: client.trim(), technologyNode: technologyNode.trim() } }
        );
      }

      res.json(toFrontendProject(project));
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
      await TimesheetModel.deleteMany({ project: project.projectName });
      await ProjectModel.findByIdAndDelete(req.params.id);

      res.json({ message: 'Project and associated logs deleted successfully' });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  },

  // PATCH /api/projects/:id/complete
  markCompleted: async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await ProjectModel.findByIdAndUpdate(
        req.params.id,
        { $set: { status: 'Completed' } },
        { new: true }
      );

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json(toFrontendProject(project));
    } catch (error) {
      console.error('Error completing project:', error);
      res.status(500).json({ error: 'Failed to complete project' });
    }
  }
};
