import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ProjectModel } from '../models/Project';
import { ProjectLibraryModel } from '../models/ProjectLibrary';
import { ProjectCellModel, CELL_STATUSES, CELL_TYPES, type CellStatus } from '../models/ProjectCell';
import { CellReviewModel } from '../models/CellReview';

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function actorFromReq(req: Request) {
  const user = (req as any).user;
  return {
    userId: user?.id || user?._id?.toString() || 'admin',
    userName: user?.name || user?.email || 'Admin',
    role: (user?.role === 'Admin' ? 'Admin' : 'Employee') as 'Admin' | 'Employee',
  };
}

async function assertProject(projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) return null;
  return ProjectModel.findById(projectId);
}

function normalizeCellType(value: string): string {
  if ((CELL_TYPES as readonly string[]).includes(value)) return value;
  return 'block';
}

function normalizeStatus(value: string): CellStatus {
  if (value === 'in_progress' || value === 'drc' || value === 'lvs' || value === 'review') return 'in_progress';
  if (value === 'completed') return 'completed';
  if ((CELL_STATUSES as readonly string[]).includes(value)) return value as CellStatus;
  return 'ready';
}

function toLibrary(doc: any) {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    name: doc.name,
    description: doc.description || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toCell(doc: any, dependencyMeta?: { isBlocked: boolean; isReady: boolean }) {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    libraryId: doc.libraryId.toString(),
    name: doc.name,
    description: doc.description || '',
    cellType: normalizeCellType(doc.cellType || 'block'),
    technologyNode: doc.technologyNode || '',
    complexity: doc.complexity,
    estimatedEffort: doc.estimatedEffort ?? 0,
    assignedEmployeeId: doc.assignedEmployeeId || '',
    assignedEmployeeName: doc.assignedEmployeeName || '',
    dependencyCellIds: (doc.dependencyCellIds || []).map((id: Types.ObjectId) => id.toString()),
    status: normalizeStatus(doc.status || 'ready'),
    views: doc.views || { layout: '', symbol: '', schematic: '' },
    activityLog: doc.activityLog || [],
    isBlocked: dependencyMeta?.isBlocked ?? false,
    isReady: dependencyMeta?.isReady ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toReview(doc: any) {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    cellId: doc.cellId.toString(),
    stageAtRequest: doc.stageAtRequest,
    status: doc.status,
    initiatedBy: doc.initiatedBy,
    initiatedByName: doc.initiatedByName,
    assignedEmployeeId: doc.assignedEmployeeId || '',
    messages: doc.messages || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function syncProjectProgress(projectId: Types.ObjectId) {
  const cells = await ProjectCellModel.find({ projectId });
  const total = cells.length;
  const completed = cells.filter((c) => c.status === 'completed').length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  await ProjectModel.findByIdAndUpdate(projectId, {
    totalTasks: total,
    completedTasks: completed,
    completionPercentage: pct,
  });
  return { total, completed, pct };
}

async function computeDependencyMeta(projectId: Types.ObjectId, cell: any) {
  const allCells = await ProjectCellModel.find({ projectId });
  const completedIds = new Set(
    allCells.filter((c) => c.status === 'completed').map((c) => c._id.toString()),
  );
  const deps = (cell.dependencyCellIds || []).map((id: Types.ObjectId) => id.toString());
  const isBlocked = deps.length > 0 && deps.some((depId: string) => !completedIds.has(depId));
  const status = normalizeStatus(cell.status || 'ready');
  const isReady = !isBlocked && status === 'ready';
  return { isBlocked, isReady };
}

async function refreshBlockedStatuses(_projectId: Types.ObjectId) {
  /* Dependency blocking is derived at read time via computeDependencyMeta */
}

export const projectWorkspaceController = {
  getWorkspaceSummary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const project = await assertProject(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const [libraries, cells, reviews] = await Promise.all([
        ProjectLibraryModel.find({ projectId }).sort({ name: 1 }),
        ProjectCellModel.find({ projectId }),
        CellReviewModel.find({ projectId, status: 'open' }),
      ]);

      const cellsWithMeta = await Promise.all(
        cells.map(async (cell) => {
          const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
          return toCell(cell, meta);
        }),
      );

      res.json({
        project: {
          id: project._id.toString(),
          name: project.projectName,
          client: project.clientName,
          accessType: project.accessType,
          teamLead: project.teamLead || '',
          technologyNode: project.technologyNode,
          description: project.description,
          status: project.status,
          completionPercentage: project.completionPercentage ?? 0,
        },
        libraries: libraries.map(toLibrary),
        cells: cellsWithMeta,
        stats: {
          libraryCount: libraries.length,
          cellCount: cells.length,
          completedCells: cells.filter((c) => c.status === 'completed').length,
          blockedCells: cellsWithMeta.filter((c) => c.isBlocked).length,
          readyCells: cellsWithMeta.filter((c) => c.isReady).length,
          unassignedCells: cells.filter((c) => !c.assignedEmployeeId).length,
          openReviews: reviews.length,
        },
      });
    } catch (err) {
      console.error('[workspace] summary', err);
      res.status(500).json({ error: 'Failed to load workspace' });
    }
  },

  listLibraries: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      if (!(await assertProject(projectId))) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      const libraries = await ProjectLibraryModel.find({ projectId }).sort({ name: 1 });
      res.json(libraries.map(toLibrary));
    } catch (err) {
      res.status(500).json({ error: 'Failed to list libraries' });
    }
  },

  createLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const project = await assertProject(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      const { name, description } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ error: 'Library name is required' });
        return;
      }
      const actor = actorFromReq(req);
      const library = await ProjectLibraryModel.create({
        projectId: project._id,
        name: name.trim(),
        description: description?.trim() || '',
        createdBy: actor.userId,
      });
      res.status(201).json(toLibrary(library));
    } catch (err) {
      res.status(500).json({ error: 'Failed to create library' });
    }
  },

  updateLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      if (!Types.ObjectId.isValid(libraryId)) {
        res.status(400).json({ error: 'Invalid library id' });
        return;
      }
      const library = await ProjectLibraryModel.findOne({ _id: libraryId, projectId });
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }
      const { name, description } = req.body;
      if (name !== undefined) library.name = String(name).trim();
      if (description !== undefined) library.description = String(description).trim();
      await library.save();
      res.json(toLibrary(library));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update library' });
    }
  },

  deleteLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      const library = await ProjectLibraryModel.findOneAndDelete({ _id: libraryId, projectId });
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }
      const cellIds = await ProjectCellModel.find({ libraryId }).distinct('_id');
      await CellReviewModel.deleteMany({ cellId: { $in: cellIds } });
      await ProjectCellModel.deleteMany({ libraryId });
      await syncProjectProgress(new Types.ObjectId(projectId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete library' });
    }
  },

  listCells: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      const cells = await ProjectCellModel.find({ projectId, libraryId }).sort({ name: 1 });
      const result = await Promise.all(
        cells.map(async (cell) => toCell(cell, await computeDependencyMeta(new Types.ObjectId(projectId), cell))),
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list cells' });
    }
  },

  createCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      const project = await assertProject(projectId);
      const library = await ProjectLibraryModel.findOne({ _id: libraryId, projectId });
      if (!project || !library) {
        res.status(404).json({ error: 'Project or library not found' });
        return;
      }

      const {
        name,
        description,
        cellType,
        technologyNode,
        complexity,
        estimatedEffort,
        assignedEmployeeId,
        assignedEmployeeName,
        dependencyCellIds,
        views,
      } = req.body;

      if (!name?.trim()) {
        res.status(400).json({ error: 'Cell name is required' });
        return;
      }

      const actor = actorFromReq(req);
      const deps = Array.isArray(dependencyCellIds)
        ? dependencyCellIds.filter((id: string) => Types.ObjectId.isValid(id)).map((id: string) => new Types.ObjectId(id))
        : [];

      const cell = await ProjectCellModel.create({
        projectId: project._id,
        libraryId: library._id,
        name: name.trim(),
        description: description?.trim() || '',
        cellType: CELL_TYPES.includes(cellType) ? cellType : 'block',
        technologyNode: technologyNode?.trim() || project.technologyNode || '',
        complexity: ['Low', 'Medium', 'High'].includes(complexity) ? complexity : 'Medium',
        estimatedEffort: Number(estimatedEffort) || 0,
        assignedEmployeeId: assignedEmployeeId || undefined,
        assignedEmployeeName: assignedEmployeeName || undefined,
        dependencyCellIds: deps,
        status: 'ready',
        views: views || { layout: '', symbol: '', schematic: '' },
        activityLog: [
          {
            action: 'created',
            detail: `Cell "${name.trim()}" created`,
            userId: actor.userId,
            userName: actor.userName,
            at: new Date(),
          },
        ],
        createdBy: actor.userId,
      });

      await syncProjectProgress(project._id);
      const meta = await computeDependencyMeta(project._id, cell);
      res.status(201).json(toCell(cell, meta));
    } catch (err) {
      console.error('[workspace] createCell', err);
      res.status(500).json({ error: 'Failed to create cell' });
    }
  },

  updateCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const actor = actorFromReq(req);
      const fields = [
        'name', 'description', 'cellType', 'technologyNode', 'complexity',
        'estimatedEffort', 'assignedEmployeeId', 'assignedEmployeeName', 'views',
      ] as const;

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          (cell as any)[field] = req.body[field];
        }
      }

      if (Array.isArray(req.body.dependencyCellIds)) {
        cell.dependencyCellIds = req.body.dependencyCellIds
          .filter((id: string) => Types.ObjectId.isValid(id) && id !== cellId)
          .map((id: string) => new Types.ObjectId(id));
      }

      if (req.body.libraryId !== undefined) {
        if (!Types.ObjectId.isValid(req.body.libraryId)) {
          res.status(400).json({ error: 'Invalid library id' });
          return;
        }
        const library = await ProjectLibraryModel.findOne({ _id: req.body.libraryId, projectId });
        if (!library) {
          res.status(400).json({ error: 'Library not found in this project' });
          return;
        }
        cell.libraryId = library._id;
      }

      cell.activityLog.push({
        action: 'updated',
        detail: 'Cell details updated',
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });

      await cell.save();
      await refreshBlockedStatuses(new Types.ObjectId(projectId));
      const refreshed = await ProjectCellModel.findById(cellId);
      const meta = refreshed ? await computeDependencyMeta(new Types.ObjectId(projectId), refreshed) : { isBlocked: false, isReady: false };
      res.json(toCell(refreshed, meta));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update cell' });
    }
  },

  updateCellStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const { status } = req.body;
      const nextStatus = normalizeStatus(status);
      if (!CELL_STATUSES.includes(nextStatus) || nextStatus === 'completed') {
        res.status(400).json({ error: 'Invalid status. Use complete endpoint for completed.' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      if (meta.isBlocked && nextStatus === 'in_progress') {
        res.status(400).json({ error: 'Cell is blocked by incomplete dependencies' });
        return;
      }

      const actor = actorFromReq(req);
      const prev = normalizeStatus(cell.status);
      cell.status = nextStatus;
      cell.activityLog.push({
        action: 'status_change',
        detail: `${prev} → ${nextStatus}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();
      res.json(toCell(cell, await computeDependencyMeta(new Types.ObjectId(projectId), cell)));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update status' });
    }
  },

  completeCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const actor = actorFromReq(req);
      if (actor.role !== 'Admin') {
        res.status(403).json({ error: 'Only admins can mark cells as completed' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const prev = cell.status;
      cell.status = 'completed';
      cell.activityLog.push({
        action: 'completed',
        detail: `Marked completed by ${actor.userName}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();

      await refreshBlockedStatuses(new Types.ObjectId(projectId));
      await syncProjectProgress(new Types.ObjectId(projectId));

      const openReviews = await CellReviewModel.find({ cellId, status: 'open' });
      for (const review of openReviews) {
        review.status = 'resolved';
        await review.save();
      }

      res.json(toCell(cell, { isBlocked: false, isReady: false }));
    } catch (err) {
      res.status(500).json({ error: 'Failed to complete cell' });
    }
  },

  getDependencyGraph: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cells = await ProjectCellModel.find({ projectId });
      const nodes = await Promise.all(
        cells.map(async (cell) => {
          const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
          return {
            id: cell._id.toString(),
            name: cell.name,
            status: cell.status,
            libraryId: cell.libraryId.toString(),
            ...meta,
          };
        }),
      );
      const edges = cells.flatMap((cell) =>
        (cell.dependencyCellIds || []).map((depId) => ({
          from: depId.toString(),
          to: cell._id.toString(),
        })),
      );
      res.json({ nodes, edges });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load dependency graph' });
    }
  },

  listCellReviews: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const reviews = await CellReviewModel.find({ projectId, cellId }).sort({ createdAt: -1 });
      res.json(reviews.map(toReview));
    } catch (err) {
      res.status(500).json({ error: 'Failed to list reviews' });
    }
  },

  createCellReview: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const { comment } = req.body;
      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const actor = actorFromReq(req);
      const review = await CellReviewModel.create({
        projectId: new Types.ObjectId(projectId),
        cellId: cell._id,
        stageAtRequest: cell.status,
        initiatedBy: actor.userId,
        initiatedByName: actor.userName,
        assignedEmployeeId: cell.assignedEmployeeId,
        messages: [
          {
            authorId: actor.userId,
            authorName: actor.userName,
            authorRole: actor.role,
            body: comment?.trim() || 'Review requested',
            at: new Date(),
          },
        ],
      });

      cell.activityLog.push({
        action: 'review_requested',
        detail: `Review requested at stage ${cell.status}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();

      res.status(201).json(toReview(review));
    } catch (err) {
      res.status(500).json({ error: 'Failed to create review' });
    }
  },

  deleteCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      if (!Types.ObjectId.isValid(cellId)) {
        res.status(400).json({ error: 'Invalid cell id' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const cellObjectId = new Types.ObjectId(cellId);
      const projectObjectId = new Types.ObjectId(projectId);

      await ProjectCellModel.updateMany(
        { projectId: projectObjectId, dependencyCellIds: cellObjectId },
        { $pull: { dependencyCellIds: cellObjectId } },
      );
      await CellReviewModel.deleteMany({ cellId: cellObjectId });
      await ProjectCellModel.findByIdAndDelete(cellObjectId);

      await refreshBlockedStatuses(projectObjectId);
      await syncProjectProgress(projectObjectId);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete cell' });
    }
  },

  addReviewMessage: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const reviewId = paramId(req.params.reviewId);
      const { body } = req.body;
      if (!body?.trim()) {
        res.status(400).json({ error: 'Message body is required' });
        return;
      }

      const review = await CellReviewModel.findOne({ _id: reviewId, projectId, cellId });
      if (!review) {
        res.status(404).json({ error: 'Review not found' });
        return;
      }

      const actor = actorFromReq(req);
      review.messages.push({
        authorId: actor.userId,
        authorName: actor.userName,
        authorRole: actor.role,
        body: body.trim(),
        at: new Date(),
      });
      await review.save();
      res.json(toReview(review));
    } catch (err) {
      res.status(500).json({ error: 'Failed to add message' });
    }
  },
};
