import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as pkaService from '../services/pkaMetalRoutingService';

export const pkaMetalRoutingController = {
  async getContext(_req: AuthRequest, res: Response) {
    try {
      const context = await pkaService.listCellsContext();
      res.json(context);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load context' });
    }
  },

  async resolveRoute(req: AuthRequest, res: Response) {
    try {
      const { fromCell, toCell, fromSignal, toSignal } = req.body;
      if (!fromCell || !toCell || !fromSignal || !toSignal) {
        res.status(400).json({ error: 'fromCell, toCell, fromSignal, and toSignal are required' });
        return;
      }
      const route = await pkaService.getOrCreateRoute(
        { fromCell, toCell, fromSignal, toSignal },
        req.user?.id,
        req.user?.email,
      );
      res.json({ route });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve route';
      if (message.includes('duplicate key')) {
        res.status(409).json({ error: 'Route already exists for this combination' });
        return;
      }
      res.status(400).json({ error: message });
    }
  },

  async lookupRoute(req: AuthRequest, res: Response) {
    try {
      const { fromCell, toCell, fromSignal, toSignal } = req.query;
      if (!fromCell || !toCell || !fromSignal || !toSignal) {
        res.status(400).json({ error: 'fromCell, toCell, fromSignal, and toSignal are required' });
        return;
      }
      const route = await pkaService.findRouteByKey({
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

  async listPkaModules(_req: AuthRequest, res: Response) {
    try {
      const modules = await pkaService.listPkaModules();
      res.json({ modules });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list PKA modules' });
    }
  },

  async getPkaModule(req: AuthRequest, res: Response) {
    try {
      const module = await pkaService.getPkaModuleById(String(req.params.id));
      if (!module) {
        res.status(404).json({ error: 'PKA module not found' });
        return;
      }
      res.json({ module });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch PKA module' });
    }
  },

  async createPkaModule(req: AuthRequest, res: Response) {
    try {
      const { name, technologyNode, notes, metals } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ error: 'Module name is required' });
        return;
      }
      if (!Array.isArray(metals) || metals.length === 0) {
        res.status(400).json({ error: 'At least one metal row is required in the module' });
        return;
      }
      const module = await pkaService.createPkaModule({ name, technologyNode, notes, metals });
      res.status(201).json({ module });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create PKA module';
      if (message.includes('duplicate key')) {
        res.status(409).json({ error: 'A PKA module with this name already exists' });
        return;
      }
      res.status(500).json({ error: message });
    }
  },

  async updatePkaModule(req: AuthRequest, res: Response) {
    try {
      const module = await pkaService.updatePkaModule(String(req.params.id), req.body);
      if (!module) {
        res.status(404).json({ error: 'PKA module not found' });
        return;
      }
      res.json({ module });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update PKA module';
      if (message.includes('duplicate key')) {
        res.status(409).json({ error: 'A PKA module with this name already exists' });
        return;
      }
      res.status(500).json({ error: message });
    }
  },

  async deletePkaModule(req: AuthRequest, res: Response) {
    try {
      const module = await pkaService.deletePkaModule(String(req.params.id));
      if (!module) {
        res.status(404).json({ error: 'PKA module not found' });
        return;
      }
      res.json({ message: 'PKA module deleted' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete PKA module' });
    }
  },

  async previewMetal(req: AuthRequest, res: Response) {
    try {
      const { metalType, width, length, pkaModuleId } = req.body;
      if (!metalType || pkaModuleId == null || width == null || length == null) {
        res.status(400).json({ error: 'metalType, width, length, and pkaModuleId are required' });
        return;
      }
      const metal = await pkaService.previewMetal({
        metalType,
        width: Number(width),
        length: Number(length),
        pkaModuleId,
      });
      res.json({ metal });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to preview metal' });
    }
  },

  async addMetal(req: AuthRequest, res: Response) {
    try {
      const { fromCell, toCell, fromSignal, toSignal, metalType, width, length, pkaModuleId } = req.body;
      if (!fromCell || !toCell || !fromSignal || !toSignal) {
        res.status(400).json({ error: 'All four routing values are required' });
        return;
      }
      if (!metalType || pkaModuleId == null || width == null || length == null) {
        res.status(400).json({ error: 'metalType, width, length, and pkaModuleId are required' });
        return;
      }

      const result = await pkaService.addMetalToRoute(
        { fromCell, toCell, fromSignal, toSignal },
        {
          metalType,
          width: Number(width),
          length: Number(length),
          pkaModuleId,
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
      const { fromCell, toCell, fromSignal, toSignal } = req.body;
      if (!fromCell || !toCell || !fromSignal || !toSignal) {
        res.status(400).json({ error: 'All four routing values are required' });
        return;
      }
      const route = await pkaService.removeMetalFromRoute(
        { fromCell, toCell, fromSignal, toSignal },
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

  async listRoutes(_req: AuthRequest, res: Response) {
    try {
      const routes = await pkaService.listRoutes();
      res.json({ routes });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list routes' });
    }
  },

  async getRoute(req: AuthRequest, res: Response) {
    try {
      const route = await pkaService.getRouteById(String(req.params.id));
      if (!route) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }
      res.json({ route });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch route' });
    }
  },

  async deleteRoute(req: AuthRequest, res: Response) {
    try {
      const route = await pkaService.deleteRoute(String(req.params.id));
      if (!route) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }
      res.json({ message: 'Route deleted' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete route' });
    }
  },

  async exportRoute(req: AuthRequest, res: Response) {
    try {
      const result = await pkaService.exportRouteExcel(String(req.params.id));
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
