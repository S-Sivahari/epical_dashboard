import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { PDKModuleModel } from '../models/PDKModule';
import { ProjectPDKAssignmentModel } from '../models/ProjectPDKAssignment';
import { ProjectModel } from '../models/Project';
import { MetalRoutingAnalysisModel } from '../models/MetalRoutingAnalysis';

export const metalRoutingController = {
  // ──────────────────────────────────────────────────────────────
  // PDK MODULE ENDPOINTS
  // ──────────────────────────────────────────────────────────────
  async listPDKModules(_req: Request, res: Response) {
    try {
      const modules = await PDKModuleModel.find().sort({ createdAt: -1 });
      res.json({ modules });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to list PDK modules' });
    }
  },

  async getPDKModule(req: Request, res: Response) {
    try {
      const module = await PDKModuleModel.findById(req.params.id);
      if (!module) {
        res.status(404).json({ error: 'PDK module not found' });
        return;
      }
      res.json({ module });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch PDK module' });
    }
  },

  async createPDKModule(req: Request, res: Response) {
    try {
      const { name, version, technologyNode, notes, metals } = req.body;

      if (!name?.trim()) {
        res.status(400).json({ error: 'PDK name is required' });
        return;
      }

      if (!Array.isArray(metals) || metals.length === 0) {
        res.status(400).json({ error: 'At least one metal layer is required' });
        return;
      }

      const module = await PDKModuleModel.create({
        name: name.trim(),
        version: version?.trim(),
        technologyNode: technologyNode?.trim(),
        notes: notes?.trim(),
        metals,
        createdBy: req.user?.email || 'Admin',
      });

      res.status(201).json({ module });
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(409).json({ error: 'A PDK module with this name already exists' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to create PDK module' });
    }
  },

  async updatePDKModule(req: Request, res: Response) {
    try {
      const { name, version, technologyNode, notes, metals } = req.body;

      const module = await PDKModuleModel.findById(req.params.id);
      if (!module) {
        res.status(404).json({ error: 'PDK module not found' });
        return;
      }

      if (name !== undefined) module.name = name.trim();
      if (version !== undefined) module.version = version.trim();
      if (technologyNode !== undefined) module.technologyNode = technologyNode.trim();
      if (notes !== undefined) module.notes = notes.trim();
      if (metals !== undefined) module.metals = metals;

      await module.save();
      res.json({ module });
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(409).json({ error: 'A PDK module with this name already exists' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to update PDK module' });
    }
  },

  async deletePDKModule(req: Request, res: Response) {
    try {
      const module = await PDKModuleModel.findById(req.params.id);
      if (!module) {
        res.status(404).json({ error: 'PDK module not found' });
        return;
      }

      // Check if any project is using this PDK
      const assignmentsCount = await ProjectPDKAssignmentModel.countDocuments({
        pdkModuleId: module._id,
      });

      if (assignmentsCount > 0) {
        res.status(400).json({
          error: `Cannot delete PDK module. It is currently assigned to ${assignmentsCount} project(s).`,
        });
        return;
      }

      await module.deleteOne();
      res.json({ message: 'PDK module deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete PDK module' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // PROJECT PDK ASSIGNMENT ENDPOINTS
  // ──────────────────────────────────────────────────────────────
  async assignPDKToProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { pdkModuleId, notes } = req.body;

      if (!pdkModuleId) {
        res.status(400).json({ error: 'PDK Module ID is required' });
        return;
      }

      // Ensure projectId is a string
      const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

      // Verify project exists
      const project = await ProjectModel.findById(projectIdStr);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Verify PDK module exists
      const pdkModule = await PDKModuleModel.findById(pdkModuleId);
      if (!pdkModule) {
        res.status(404).json({ error: 'PDK module not found' });
        return;
      }

      // Create or update assignment
      const assignment = await ProjectPDKAssignmentModel.findOneAndUpdate(
        { projectId: new Types.ObjectId(projectIdStr) },
        {
          projectId: new Types.ObjectId(projectIdStr),
          pdkModuleId: new Types.ObjectId(pdkModuleId),
          assignedBy: req.user?.email || 'Admin',
          assignedAt: new Date(),
          notes: notes?.trim(),
        },
        { upsert: true, new: true }
      );

      res.json({
        message: 'PDK assigned to project successfully',
        assignment,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to assign PDK to project' });
    }
  },

  async getProjectPDKAssignment(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

      const assignment = await ProjectPDKAssignmentModel.findOne({
        projectId: new Types.ObjectId(projectIdStr),
      }).populate('pdkModuleId');

      if (!assignment) {
        res.status(404).json({ error: 'No PDK assigned to this project' });
        return;
      }

      res.json({ assignment });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch PDK assignment' });
    }
  },

  async removeProjectPDKAssignment(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

      const assignment = await ProjectPDKAssignmentModel.findOneAndDelete({
        projectId: new Types.ObjectId(projectIdStr),
      });

      if (!assignment) {
        res.status(404).json({ error: 'No PDK assigned to this project' });
        return;
      }

      res.json({ message: 'PDK assignment removed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to remove PDK assignment' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // ROUTING ANALYSIS ENDPOINTS
  // ──────────────────────────────────────────────────────────────
  async getProjectRoutingData(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

      // Get project details
      const project = await ProjectModel.findById(projectIdStr);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Get PDK assignment
      const assignment = await ProjectPDKAssignmentModel.findOne({
        projectId: new Types.ObjectId(projectIdStr),
      }).populate('pdkModuleId');

      // Get all routing analyses for this project (filter by fromCell/toCell matching project cells)
      // For now, return all routes - can be filtered based on project cells later
      const routes = await MetalRoutingAnalysisModel.find().sort({ updatedAt: -1 });

      res.json({
        project,
        pdkAssignment: assignment,
        routes,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch project routing data' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // ENHANCED PROJECTS LIST WITH PDK INFO
  // ──────────────────────────────────────────────────────────────
  async getProjectsWithPDK(_req: Request, res: Response) {
    try {
      const projects = await ProjectModel.find({ status: { $ne: 'Archived' } }).lean();
      
      const projectsWithPDK = await Promise.all(
        projects.map(async (project) => {
          const assignment = await ProjectPDKAssignmentModel.findOne({
            projectId: project._id,
          }).populate('pdkModuleId');

          return {
            ...project,
            assignedPDK: assignment
              ? {
                  _id: (assignment.pdkModuleId as any)._id,
                  name: (assignment.pdkModuleId as any).name,
                  version: (assignment.pdkModuleId as any).version,
                  technologyNode: (assignment.pdkModuleId as any).technologyNode,
                }
              : null,
          };
        })
      );

      res.json(projectsWithPDK);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch projects' });
    }
  },
};
