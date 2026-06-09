import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as pdkService from '../services/pdkMetalRoutingService';

export const pdkMetalRoutingController = {
  async listDashboardProjects(req: AuthRequest, res: Response) {
    try {
      const projects = await pdkService.listDashboardProjects(
        req.user?.id ?? '',
        req.user?.role ?? 'employee',
      );
      res.json({ projects });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list projects' });
    }
  },

  async assignPdkToProject(req: AuthRequest, res: Response) {
    try {
      const { pdkModuleId } = req.body;
      const project = await pdkService.assignPdkToProject(
        String(req.params.projectId),
        pdkModuleId ?? null,
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json({ project });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to assign PDK' });
    }
  },

  async getProjectContext(req: AuthRequest, res: Response) {
    try {
      const context = await pdkService.getProjectContext(String(req.params.projectId));
      res.json(context);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load project context' });
    }
  },

  async resolveRoute(req: AuthRequest, res: Response) {
    try {
      const { projectId, fromCell, toCell, fromSignal, toSignal } = req.body;
      if (!projectId || !fromCell || !toCell || !fromSignal || !toSignal) {
        res.status(400).json({ error: 'projectId and all four routing values are required' });
        return;
      }
      const route = await pdkService.getOrCreateRoute(
        { projectId, fromCell, toCell, fromSignal, toSignal },
        req.user?.id,
        req.user?.email,
      );
      res.json({ route });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to resolve route' });
    }
  },

  async lookupRoute(req: AuthRequest, res: Response) {
    try {
      const { projectId, fromCell, toCell, fromSignal, toSignal } = req.query;
      if (!projectId || !fromCell || !toCell || !fromSignal || !toSignal) {
        res.status(400).json({ error: 'projectId and all four routing values are required' });
        return;
      }
      const route = await pdkService.findRouteByKey({
        projectId: String(projectId),
        fromCell: String(fromCell),
        toCell: String(toCell),
        fromSignal: String(fromSignal),
        toSignal: String(toSignal),
      });
      res.json({ route: route ?? null });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to lookup route' });
    }
  },

  async listPdkModules(_req: AuthRequest, res: Response) {
    try {
      const modules = await pdkService.listPdkModules();
      res.json({ modules });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list PDK modules' });
    }
  },

  async getPdkModule(req: AuthRequest, res: Response) {
    try {
      const module = await pdkService.getPdkModuleById(String(req.params.id));
      if (!module) {
        res.status(404).json({ error: 'PDK module not found' });
        return;
      }
      res.json({ module });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch PDK module' });
    }
  },

  async createPdkModule(req: AuthRequest, res: Response) {
    try {
      const { name, technologyNode, notes, metals } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ error: 'Module name is required' });
        return;
      }
      if (!Array.isArray(metals) || metals.length === 0) {
        res.status(400).json({ error: 'At least one metal row is required' });
        return;
      }
      const module = await pdkService.createPdkModule({ name, technologyNode, notes, metals });
      res.status(201).json({ module });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create PDK module';
      if (message.includes('duplicate key')) {
        res.status(409).json({ error: 'A PDK module with this name already exists' });
        return;
      }
      res.status(500).json({ error: message });
    }
  },

  async updatePdkModule(req: AuthRequest, res: Response) {
    try {
      const module = await pdkService.updatePdkModule(String(req.params.id), req.body);
      if (!module) {
        res.status(404).json({ error: 'PDK module not found' });
        return;
      }
      res.json({ module });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update PDK module';
      if (message.includes('duplicate key')) {
        res.status(409).json({ error: 'A PDK module with this name already exists' });
        return;
      }
      res.status(500).json({ error: message });
    }
  },

  async deletePdkModule(req: AuthRequest, res: Response) {
    try {
      const module = await pdkService.deletePdkModule(String(req.params.id));
      if (!module) {
        res.status(404).json({ error: 'PDK module not found' });
        return;
      }
      res.json({ message: 'PDK module deleted' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete PDK module' });
    }
  },

  async previewMetal(req: AuthRequest, res: Response) {
    try {
      const { projectId, metalType, width, length } = req.body;
      if (!projectId || !metalType || width == null || length == null) {
        res.status(400).json({ error: 'projectId, metalType, width, and length are required' });
        return;
      }
      const metal = await pdkService.previewMetal({
        projectId,
        metalType,
        width: Number(width),
        length: Number(length),
      });
      res.json({ metal });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to preview metal' });
    }
  },

  async addMetal(req: AuthRequest, res: Response) {
    try {
      const { projectId, fromCell, toCell, fromSignal, toSignal, metalType, width, length } = req.body;
      if (!projectId || !fromCell || !toCell || !fromSignal || !toSignal) {
        res.status(400).json({ error: 'projectId and all four routing values are required' });
        return;
      }
      if (!metalType || width == null || length == null) {
        res.status(400).json({ error: 'metalType, width, and length are required' });
        return;
      }
      const result = await pdkService.addMetalToRoute(
        { projectId, fromCell, toCell, fromSignal, toSignal },
        { metalType, width: Number(width), length: Number(length) },
        req.user?.id,
        req.user?.email,
      );
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to add metal' });
    }
  },

  async removeMetal(req: AuthRequest, res: Response) {
    try {
      const { projectId, fromCell, toCell, fromSignal, toSignal } = req.body;
      if (!projectId || !fromCell || !toCell || !fromSignal || !toSignal) {
        res.status(400).json({ error: 'projectId and all four routing values are required' });
        return;
      }
      const route = await pdkService.removeMetalFromRoute(
        { projectId, fromCell, toCell, fromSignal, toSignal },
        String(req.params.metalId),
      );
      if (!route) {
        res.status(404).json({ error: 'Route or metal not found' });
        return;
      }
      res.json({ route });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove metal' });
    }
  },

  async exportRoute(req: AuthRequest, res: Response) {
    try {
      const result = await pdkService.exportRouteExcel(String(req.params.id));
      if (!result) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }
      const { route, buffer } = result;
      const filename = `metal-routing_${route.fromCell}_${route.toCell}.xlsx`.replace(/\s+/g, '_');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export route' });
    }
  },
};
