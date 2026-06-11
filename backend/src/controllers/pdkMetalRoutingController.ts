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

  async getDashboardMetrics(req: AuthRequest, res: Response) {
    try {
      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
      const metrics = await pdkService.getDashboardMetrics(
        req.user?.id ?? '',
        req.user?.role ?? 'employee',
        projectId,
      );
      res.json({ metrics });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load dashboard metrics' });
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
      const { projectId, signal, fromCell, toCell, fromSignal, toSignal, schematicCurrentDensity } =
        req.body;
      const resolvedSignal = signal ?? fromSignal;
      if (!projectId || !fromCell || !toCell || !resolvedSignal) {
        res.status(400).json({ error: 'projectId, signal, fromCell, and toCell are required' });
        return;
      }
      const schematic =
        schematicCurrentDensity != null && Number.isFinite(Number(schematicCurrentDensity))
          ? Number(schematicCurrentDensity)
          : undefined;
      if (schematic != null && schematic < 0) {
        res.status(400).json({ error: 'schematicCurrentDensity must be non-negative' });
        return;
      }
      const route = await pdkService.getOrCreateRoute(
        {
          projectId,
          signal: String(resolvedSignal),
          fromCell,
          toCell,
          fromSignal: fromSignal ? String(fromSignal) : undefined,
          toSignal: toSignal ? String(toSignal) : undefined,
        },
        req.user?.id,
        req.user?.email,
        schematic,
      );
      res.json({ route });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to resolve route' });
    }
  },

  async updateRoute(req: AuthRequest, res: Response) {
    try {
      const { signal, fromCell, toCell, schematicCurrentDensity } = req.body;
      if (!signal?.trim() || !fromCell?.trim() || !toCell?.trim()) {
        res.status(400).json({ error: 'signal, fromCell, and toCell are required' });
        return;
      }
      const schematic =
        schematicCurrentDensity != null && Number.isFinite(Number(schematicCurrentDensity))
          ? Number(schematicCurrentDensity)
          : undefined;
      if (schematic != null && schematic < 0) {
        res.status(400).json({ error: 'schematicCurrentDensity must be non-negative' });
        return;
      }
      const route = await pdkService.updateRouteIdentity(String(req.params.id), {
        signal: String(signal),
        fromCell: String(fromCell),
        toCell: String(toCell),
        schematicCurrentDensity: schematic,
      });
      if (!route) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }
      res.json({ route });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update route' });
    }
  },

  async lookupRoute(req: AuthRequest, res: Response) {
    try {
      const { projectId, signal, fromCell, toCell, fromSignal, toSignal } = req.query;
      const resolvedSignal = signal ?? fromSignal;
      if (!projectId || !fromCell || !toCell || !resolvedSignal) {
        res.status(400).json({ error: 'projectId, signal, fromCell, and toCell are required' });
        return;
      }
      const route = await pdkService.findRouteByKey({
        projectId: String(projectId),
        signal: String(resolvedSignal),
        fromCell: String(fromCell),
        toCell: String(toCell),
        fromSignal: fromSignal ? String(fromSignal) : undefined,
        toSignal: toSignal ? String(toSignal) : undefined,
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

  async downloadPdkTemplate(_req: AuthRequest, res: Response) {
    try {
      const buffer = await pdkService.getPdkTemplateExcel();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="PDK_Import_Template.xlsx"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate PDK template' });
    }
  },

  async importPdkModule(req: AuthRequest, res: Response) {
    try {
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'Excel file is required' });
        return;
      }

      const { name, technologyNode, notes } = req.body;
      const module = await pdkService.importPdkModuleFromExcel(req.file.buffer, {
        name: typeof name === 'string' ? name : undefined,
        technologyNode: typeof technologyNode === 'string' ? technologyNode : undefined,
        notes: typeof notes === 'string' ? notes : undefined,
      });
      res.status(201).json({ module });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import PDK module';
      if (message.includes('duplicate key')) {
        res.status(409).json({ error: 'A PDK module with this name already exists' });
        return;
      }
      res.status(400).json({ error: message });
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
      const { projectId, metalType, width, length, schematicCurrentDensity, connectionType } = req.body;
      if (!projectId || !metalType || width == null || length == null) {
        res.status(400).json({ error: 'projectId, metalType, width, and length are required' });
        return;
      }
      const metal = await pdkService.previewMetal({
        projectId,
        metalType,
        width: Number(width),
        length: Number(length),
        schematicCurrentDensity:
          schematicCurrentDensity != null ? Number(schematicCurrentDensity) : undefined,
        connectionType: connectionType === 'parallel' ? 'parallel' : 'series',
      });
      res.json({ metal });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to preview metal' });
    }
  },

  async addMetal(req: AuthRequest, res: Response) {
    try {
      const {
        projectId,
        signal,
        fromCell,
        toCell,
        fromSignal,
        toSignal,
        metalType,
        width,
        length,
        schematicCurrentDensity,
        connectionType,
      } = req.body;
      const resolvedSignal = signal ?? fromSignal;
      if (!projectId || !fromCell || !toCell || !resolvedSignal) {
        res.status(400).json({ error: 'projectId, signal, fromCell, and toCell are required' });
        return;
      }
      if (!metalType || width == null || length == null) {
        res.status(400).json({ error: 'metalType, width, and length are required' });
        return;
      }
      const result = await pdkService.addMetalToRoute(
        {
          projectId,
          signal: String(resolvedSignal),
          fromCell,
          toCell,
          fromSignal: fromSignal ? String(fromSignal) : undefined,
          toSignal: toSignal ? String(toSignal) : undefined,
        },
        {
          metalType,
          width: Number(width),
          length: Number(length),
          schematicCurrentDensity:
            schematicCurrentDensity != null ? Number(schematicCurrentDensity) : undefined,
          connectionType: connectionType === 'parallel' ? 'parallel' : 'series',
        },
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
      const { projectId, signal, fromCell, toCell, fromSignal, toSignal } = req.body;
      const resolvedSignal = signal ?? fromSignal;
      if (!projectId || !fromCell || !toCell || !resolvedSignal) {
        res.status(400).json({ error: 'projectId, signal, fromCell, and toCell are required' });
        return;
      }
      const route = await pdkService.removeMetalFromRoute(
        {
          projectId,
          signal: String(resolvedSignal),
          fromCell,
          toCell,
          fromSignal: fromSignal ? String(fromSignal) : undefined,
          toSignal: toSignal ? String(toSignal) : undefined,
        },
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

  async updateMetal(req: AuthRequest, res: Response) {
    try {
      const {
        projectId,
        signal,
        fromCell,
        toCell,
        fromSignal,
        toSignal,
        metalType,
        width,
        length,
        schematicCurrentDensity,
        connectionType,
      } = req.body;
      const resolvedSignal = signal ?? fromSignal;
      if (!projectId || !fromCell || !toCell || !resolvedSignal) {
        res.status(400).json({ error: 'projectId, signal, fromCell, and toCell are required' });
        return;
      }
      if (!metalType || width == null || length == null) {
        res.status(400).json({ error: 'metalType, width, and length are required' });
        return;
      }
      const route = await pdkService.updateMetalInRoute(
        {
          projectId,
          signal: String(resolvedSignal),
          fromCell,
          toCell,
          fromSignal: fromSignal ? String(fromSignal) : undefined,
          toSignal: toSignal ? String(toSignal) : undefined,
        },
        String(req.params.metalId),
        {
          metalType,
          width: Number(width),
          length: Number(length),
          schematicCurrentDensity:
            schematicCurrentDensity != null ? Number(schematicCurrentDensity) : undefined,
          connectionType: connectionType === 'parallel' ? 'parallel' : 'series',
        },
      );
      if (!route) {
        res.status(404).json({ error: 'Route or metal not found' });
        return;
      }
      res.json({ route });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update metal' });
    }
  },

  async exportRoute(req: AuthRequest, res: Response) {
    try {
      const result = await pdkService.exportRouteExcel(String(req.params.id));
      if (!result) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }
      const { buffer, filename } = result;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export route' });
    }
  },

  async downloadMetalRoutingTemplate(_req: AuthRequest, res: Response) {
    try {
      const buffer = await pdkService.getMetalRoutingTemplateExcel();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Metal_Routing_Import_Template.xlsx"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate template' });
    }
  },

  async downloadProjectMetalRoutingTemplate(req: AuthRequest, res: Response) {
    try {
      const result = await pdkService.getMetalRoutingTemplateExcelForProject(String(req.params.projectId));
      const safeName = result.pdkModuleName.replace(/[^\w.-]+/g, '_');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Metal_Routing_Template_${safeName}.xlsx"`,
      );
      res.send(result.buffer);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to generate project template' });
    }
  },

  async exportProjectRoutes(req: AuthRequest, res: Response) {
    try {
      const routeId = typeof req.query.routeId === 'string' ? req.query.routeId : undefined;
      const result = await pdkService.exportProjectRoutesExcel(String(req.params.projectId), routeId);
      if (!result) {
        res.status(404).json({ error: 'Project or route not found' });
        return;
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export routes' });
    }
  },

  async importProjectRoutes(req: AuthRequest, res: Response) {
    const projectId = String(req.params.projectId).trim();
    try {
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'Excel file is required' });
        return;
      }

      console.log('[metal-routing-import] API request', {
        projectId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        userId: req.user?.id,
      });

      const result = await pdkService.importProjectRoutesFromExcel(
        projectId,
        req.file.buffer,
        req.user?.id,
        req.user?.email,
      );

      if (!result.success) {
        res.status(400).json({
          error: 'Import did not produce any visible saved routes for this project.',
          ...result,
        });
        return;
      }

      console.log('[metal-routing-import] API success', {
        projectId,
        routesImported: result.routesImported,
        savedRoutesVisible: result.savedRoutes.length,
        routesFailed: result.routesFailed,
      });

      res.status(201).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import routes';
      console.error('[metal-routing-import] API error', { projectId, message });
      res.status(400).json({ error: message });
    }
  },
};
