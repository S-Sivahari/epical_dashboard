import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { ProjectModel } from '../models/Project';
import { LibraryModel } from '../models/Library';
import { CellModel, type Cell } from '../models/Cell';
import { CellStageHistoryModel } from '../models/CellStageHistory';
import { CellTypeChecklistModel } from '../models/CellTypeChecklist';
import type { CellStage } from '../models/Cell';
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth';
import { isAdminRole } from '../utils/generateToken';

/** Helper to safely extract a string param from req.params */
function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? '');
}

type ViewType = 'schematic' | 'symbol' | 'layout';
const VIEW_TYPES: ViewType[] = ['schematic', 'symbol', 'layout'];

function stripViewFileData(views: Cell['views'] = {}) {
  const result: Record<string, unknown> = {};
  for (const key of VIEW_TYPES) {
    const view = views[key];
    if (!view) continue;
    result[key] = {
      fileName: view.fileName,
      mimeType: view.mimeType,
      uploadedAt: view.uploadedAt,
      uploadedBy: view.uploadedBy,
      uploadedByName: view.uploadedByName,
      hasFile: Boolean(view.fileData?.length),
    };
  }
  return result;
}

async function getAssignmentIds(req: Request): Promise<string[]> {
  const userId = req.user?.id || '';
  const userEmail = req.user?.email;
  const ids = new Set<string>();
  if (userId) ids.add(userId);

  const employee = await resolveEmployeeForAuthUser(userId, userEmail);
  if (employee?.id) ids.add(String(employee.id));
  if (employee?.employeeId) {
    ids.add(String(employee.employeeId));
    ids.add(String(employee.employeeId).toUpperCase());
  }
  return Array.from(ids);
}

function isUserAssignedToCell(cell: Cell, assignmentIds: string[]): boolean {
  return cell.assignedTo.some((a) => assignmentIds.includes(a.employeeId));
}

async function assertCellAccess(req: Request, cell: Cell, requireAssignment = false): Promise<void> {
  if (isAdminRole(req.user?.role || '')) return;

  const assignmentIds = await getAssignmentIds(req);
  if (!isUserAssignedToCell(cell, assignmentIds)) {
    const err = new Error('You are not assigned to this cell');
    (err as any).status = 403;
    throw err;
  }

  if (requireAssignment && !isUserAssignedToCell(cell, assignmentIds)) {
    const err = new Error('Only assigned employees can perform this action');
    (err as any).status = 403;
    throw err;
  }
}

const STAGES_ORDER: CellStage[] = ['floor_plan', 'drc_1', 'routing', 'drc_2', 'lvs'];

function getNextStage(current: CellStage): CellStage | null {
  const idx = STAGES_ORDER.indexOf(current);
  return idx < STAGES_ORDER.length - 1 ? STAGES_ORDER[idx + 1] : null;
}

function isReviewStage(stage: CellStage): boolean {
  return stage === 'drc_1' || stage === 'lvs';
}

function serializeChecklistItems(items: Cell['checklistItems'] = []) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    required: item.required,
    checked: item.checked,
    checkedBy: item.checkedBy,
    checkedByName: item.checkedByName,
    checkedAt: item.checkedAt,
  }));
}

function allRequiredChecklistComplete(cell: Cell): boolean {
  const required = (cell.checklistItems || []).filter((i) => i.required);
  if (required.length === 0) return true;
  return required.every((i) => i.checked);
}

function mapCellSummary(c: {
  _id: Types.ObjectId;
  name: string;
  libraryId: Types.ObjectId;
  type: string;
  assignedTo: Cell['assignedTo'];
  currentStage: CellStage;
  stageStatus: Cell['stageStatus'];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c._id.toString(),
    name: c.name,
    libraryId: c.libraryId.toString(),
    type: c.type,
    assignedTo: c.assignedTo,
    currentStage: c.currentStage,
    stageStatus: c.stageStatus,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/* ================================================================
   PROJECT CRUD
   ================================================================ */

/** GET /api/project-mgmt/projects — list all projects */
async function getAllProjects(_req: Request, res: Response) {
  try {
    const projects = await ProjectModel.find().sort({ createdAt: -1 }).lean();
    const result = await Promise.all(
      projects.map(async (p) => {
        const libraries = await LibraryModel.find({ projectId: p._id }).select('_id').lean();
        const libraryIds = libraries.map((l) => l._id);
        const cellCount = libraryIds.length
          ? await CellModel.countDocuments({ libraryId: { $in: libraryIds } })
          : 0;
        const forReviewCount = libraryIds.length
          ? await CellModel.countDocuments({ libraryId: { $in: libraryIds }, stageStatus: 'for_review' })
          : 0;
        const completedCount = libraryIds.length
          ? await CellModel.countDocuments({ libraryId: { $in: libraryIds }, stageStatus: 'approved' })
          : 0;
        return {
          id: p._id.toString(),
          name: p.projectName,
          client: p.clientName,
          technologyNode: p.technologyNode,
          status: p.status,
          description: p.description,
          libraryCount: libraries.length,
          cellCount,
          forReviewCount,
          completedCount,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

/** GET /api/project-mgmt/projects/:projectId/overview — project with libraries + cells + stats */
async function getProjectOverview(req: Request, res: Response) {
  try {
    const projectId = param(req, 'projectId');
    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }
    const project = await ProjectModel.findById(projectId).lean();
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const libraries = await LibraryModel.find({ projectId }).sort({ createdAt: -1 }).lean();
    const libraryData = await Promise.all(
      libraries.map(async (lib) => {
        const cells = await CellModel.find({ libraryId: lib._id }).sort({ name: 1 }).lean();
        return {
          id: lib._id.toString(),
          name: lib.name,
          description: lib.description,
          projectId: lib.projectId.toString(),
          cellCount: cells.length,
          cells: cells.map(mapCellSummary),
          createdAt: lib.createdAt,
          updatedAt: lib.updatedAt,
        };
      })
    );

    const allCells = libraryData.flatMap((l) => l.cells);
    const stats = {
      libraryCount: libraryData.length,
      cellCount: allCells.length,
      inProgress: allCells.filter((c) => c.stageStatus === 'in_progress').length,
      forReview: allCells.filter((c) => c.stageStatus === 'for_review').length,
      completed: allCells.filter((c) => c.stageStatus === 'approved').length,
      byStage: {
        floor_plan: allCells.filter((c) => c.currentStage === 'floor_plan').length,
        drc_1: allCells.filter((c) => c.currentStage === 'drc_1').length,
        routing: allCells.filter((c) => c.currentStage === 'routing').length,
        drc_2: allCells.filter((c) => c.currentStage === 'drc_2').length,
        lvs: allCells.filter((c) => c.currentStage === 'lvs').length,
      },
      byType: {
        Block: allCells.filter((c) => c.type === 'Block').length,
        IO: allCells.filter((c) => c.type === 'IO').length,
        ESD: allCells.filter((c) => c.type === 'ESD').length,
        TOP: allCells.filter((c) => c.type === 'TOP').length,
      },
    };

    res.json({
      project: {
        id: project._id.toString(),
        name: project.projectName,
        client: project.clientName,
        technologyNode: project.technologyNode,
        status: project.status,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      stats,
      libraries: libraryData,
    });
  } catch (error) {
    console.error('Error fetching project overview:', error);
    res.status(500).json({ error: 'Failed to fetch project overview' });
  }
}

/** POST /api/project-mgmt/projects — create a project */
async function createProject(req: Request, res: Response) {
  try {
    const { name, client, technologyNode, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }
    const project = await ProjectModel.create({
      projectName: name.trim(),
      clientName: (client || '').trim(),
      technologyNode: (technologyNode || '').trim(),
      description: (description || '').trim(),
      accessType: 'public',
      allowedUsers: [],
      status: 'Active',
    });
    res.status(201).json({
      id: project._id.toString(),
      name: project.projectName,
      client: project.clientName,
      technologyNode: project.technologyNode,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
}

/* ================================================================
   LIBRARY CRUD
   ================================================================ */

/** GET /api/project-mgmt/projects/:projectId/libraries */
async function getLibraries(req: Request, res: Response) {
  try {
    const projectId = param(req, 'projectId');
    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }
    const libraries = await LibraryModel.find({ projectId }).sort({ createdAt: -1 }).lean();
    const result = await Promise.all(
      libraries.map(async (lib) => {
        const cellCount = await CellModel.countDocuments({ libraryId: lib._id });
        return {
          id: lib._id.toString(),
          name: lib.name,
          description: lib.description,
          projectId: lib.projectId.toString(),
          cellCount,
          createdAt: lib.createdAt,
          updatedAt: lib.updatedAt,
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching libraries:', error);
    res.status(500).json({ error: 'Failed to fetch libraries' });
  }
}

/** POST /api/project-mgmt/projects/:projectId/libraries */
async function createLibrary(req: Request, res: Response) {
  try {
    const projectId = param(req, 'projectId');
    const { name, description } = req.body;
    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }
    if (!name?.trim()) {
      res.status(400).json({ error: 'Library name is required' });
      return;
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const library = await LibraryModel.create({
      name: name.trim(),
      projectId,
      description: (description || '').trim(),
    });
    res.status(201).json({
      id: library._id.toString(),
      name: library.name,
      description: library.description,
      projectId: library.projectId.toString(),
      createdAt: library.createdAt,
    });
  } catch (error) {
    console.error('Error creating library:', error);
    res.status(500).json({ error: 'Failed to create library' });
  }
}

/* ================================================================
   CELL CRUD
   ================================================================ */

/** GET /api/project-mgmt/libraries/:libraryId/cells */
async function getCells(req: Request, res: Response) {
  try {
    const libraryId = param(req, 'libraryId');
    if (!Types.ObjectId.isValid(libraryId)) {
      res.status(400).json({ error: 'Invalid library ID' });
      return;
    }
    const cells = await CellModel.find({ libraryId }).sort({ createdAt: -1 }).lean();
    res.json(
      cells.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        libraryId: c.libraryId.toString(),
        type: c.type,
        assignedTo: c.assignedTo,
        currentStage: c.currentStage,
        stageStatus: c.stageStatus,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
    );
  } catch (error) {
    console.error('Error fetching cells:', error);
    res.status(500).json({ error: 'Failed to fetch cells' });
  }
}

/** POST /api/project-mgmt/libraries/:libraryId/cells */
async function createCell(req: Request, res: Response) {
  try {
    const libraryId = param(req, 'libraryId');
    const { name, type } = req.body;
    if (!Types.ObjectId.isValid(libraryId)) {
      res.status(400).json({ error: 'Invalid library ID' });
      return;
    }
    if (!name?.trim()) {
      res.status(400).json({ error: 'Cell name is required' });
      return;
    }
    if (!['Block', 'IO', 'ESD', 'TOP'].includes(type)) {
      res.status(400).json({ error: 'Invalid cell type. Must be Block, IO, ESD, or TOP' });
      return;
    }
    const library = await LibraryModel.findById(libraryId);
    if (!library) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    const cell = await CellModel.create({
      name: name.trim(),
      libraryId,
      type,
      assignedTo: [],
      currentStage: 'floor_plan',
      stageStatus: 'in_progress',
      views: {},
      feedbacks: [],
    });
    res.status(201).json({
      id: cell._id.toString(),
      name: cell.name,
      libraryId: cell.libraryId.toString(),
      type: cell.type,
      currentStage: cell.currentStage,
      stageStatus: cell.stageStatus,
      createdAt: cell.createdAt,
    });
  } catch (error) {
    console.error('Error creating cell:', error);
    res.status(500).json({ error: 'Failed to create cell' });
  }
}

/** GET /api/project-mgmt/cells/:cellId */
async function getCellDetail(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    try {
      await assertCellAccess(req, cell);
    } catch (err: any) {
      res.status(err.status || 403).json({ error: err.message });
      return;
    }

    const library = await LibraryModel.findById(cell.libraryId).lean();
    const project = library ? await ProjectModel.findById(library.projectId).lean() : null;
    const history = await CellStageHistoryModel.find({ cellId }).sort({ changedAt: -1 }).lean();

    res.json({
      id: cell._id.toString(),
      name: cell.name,
      libraryId: cell.libraryId.toString(),
      libraryName: library?.name || '',
      projectId: library?.projectId?.toString() || '',
      projectName: project?.projectName || '',
      type: cell.type,
      assignedTo: cell.assignedTo,
      currentStage: cell.currentStage,
      stageStatus: cell.stageStatus,
      views: stripViewFileData(cell.views),
      feedbacks: cell.feedbacks,
      checklistItems: serializeChecklistItems(cell.checklistItems || []),
      history: history.map((h) => ({
        id: h._id.toString(),
        fromStage: h.fromStage,
        toStage: h.toStage,
        changedBy: h.changedBy,
        changedByName: h.changedByName,
        reason: h.reason,
        changedAt: h.changedAt,
      })),
      createdAt: cell.createdAt,
      updatedAt: cell.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching cell detail:', error);
    res.status(500).json({ error: 'Failed to fetch cell detail' });
  }
}

/** PUT /api/project-mgmt/cells/:cellId — update cell (assign employees, change type) */
async function updateCell(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }
    const { name, type, assignedTo } = req.body;
    if (name?.trim()) cell.name = name.trim();
    if (type && ['Block', 'IO', 'ESD', 'TOP'].includes(type)) cell.type = type;
    if (Array.isArray(assignedTo)) {
      cell.assignedTo = assignedTo.map((a: { employeeId: string; employeeName: string }) => ({
        employeeId: String(a.employeeId),
        employeeName: String(a.employeeName),
      }));
    }
    await cell.save();
    res.json({
      id: cell._id.toString(),
      name: cell.name,
      type: cell.type,
      assignedTo: cell.assignedTo,
      currentStage: cell.currentStage,
      stageStatus: cell.stageStatus,
    });
  } catch (error) {
    console.error('Error updating cell:', error);
    res.status(500).json({ error: 'Failed to update cell' });
  }
}

/* ================================================================
   STAGE WORKFLOW
   ================================================================ */

/** PATCH /api/project-mgmt/cells/:cellId/advance — employee advances to next stage */
async function advanceCellStage(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    const userId = req.user?.id || '';
    const userName = (req as any).user?.name || userId;

    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    if (isAdminRole(req.user?.role || '')) {
      res.status(403).json({ error: 'Only assigned employees can advance stages' });
      return;
    }

    try {
      await assertCellAccess(req, cell, true);
    } catch (err: any) {
      res.status(err.status || 403).json({ error: err.message });
      return;
    }

    if (cell.stageStatus === 'for_review') {
      res.status(400).json({ error: 'Cell is under admin review. Wait for approval before continuing.' });
      return;
    }

    if (cell.stageStatus === 'approved') {
      res.status(400).json({ error: 'Cell is already completed.' });
      return;
    }

    if (isReviewStage(cell.currentStage)) {
      res.status(400).json({
        error: 'At a review gate. Submit for admin review instead of advancing.',
      });
      return;
    }

    const nextStage = getNextStage(cell.currentStage);
    if (!nextStage) {
      res.status(400).json({ error: 'Cell is already at the final stage (LVS)' });
      return;
    }

    // If next stage is a review stage, just advance and set in_progress
    // The employee will need to submit for review separately
    const fromStage = cell.currentStage;
    cell.currentStage = nextStage;
    cell.stageStatus = 'in_progress';
    await cell.save();

    await CellStageHistoryModel.create({
      cellId: cell._id,
      fromStage,
      toStage: nextStage,
      changedBy: userId,
      changedByName: userName,
      reason: 'Advanced to next stage',
    });

    res.json({
      id: cell._id.toString(),
      currentStage: cell.currentStage,
      stageStatus: cell.stageStatus,
    });
  } catch (error) {
    console.error('Error advancing cell stage:', error);
    res.status(500).json({ error: 'Failed to advance cell stage' });
  }
}

/** PATCH /api/project-mgmt/cells/:cellId/submit-review — employee submits for review */
async function submitForReview(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    const userId = req.user?.id || '';
    const userName = (req as any).user?.name || userId;

    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    if (isAdminRole(req.user?.role || '')) {
      res.status(403).json({ error: 'Only assigned employees can submit for review' });
      return;
    }

    try {
      await assertCellAccess(req, cell, true);
    } catch (err: any) {
      res.status(err.status || 403).json({ error: err.message });
      return;
    }

    if (!isReviewStage(cell.currentStage)) {
      res.status(400).json({ error: 'Current stage does not require review' });
      return;
    }

    if (cell.stageStatus === 'for_review') {
      res.status(400).json({ error: 'Cell is already submitted for review' });
      return;
    }

    cell.stageStatus = 'for_review';
    await cell.save();

    await CellStageHistoryModel.create({
      cellId: cell._id,
      fromStage: cell.currentStage,
      toStage: cell.currentStage,
      changedBy: userId,
      changedByName: userName,
      reason: 'Submitted for review',
    });

    res.json({
      id: cell._id.toString(),
      currentStage: cell.currentStage,
      stageStatus: cell.stageStatus,
    });
  } catch (error) {
    console.error('Error submitting cell for review:', error);
    res.status(500).json({ error: 'Failed to submit for review' });
  }
}

/** PATCH /api/project-mgmt/cells/:cellId/review — admin approves or rejects */
async function reviewCell(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    const { action, rejectTo, feedback } = req.body;
    const userId = req.user?.id || '';
    const userName = (req as any).user?.name || userId;

    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'Action must be "approve" or "reject"' });
      return;
    }

    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    if (cell.stageStatus !== 'for_review') {
      res.status(400).json({ error: 'Cell is not pending review' });
      return;
    }

    const fromStage = cell.currentStage;

    if (action === 'approve') {
      if (cell.currentStage === 'lvs' && !allRequiredChecklistComplete(cell)) {
        res.status(400).json({
          error: 'Complete all required checklist items before approving LVS completion.',
        });
        return;
      }

      const nextStage = getNextStage(cell.currentStage);
      if (nextStage) {
        cell.currentStage = nextStage;
        cell.stageStatus = 'in_progress';
      } else {
        cell.stageStatus = 'approved';
      }

      const reviewMsg = feedback?.trim()
        ? feedback.trim()
        : action === 'approve'
          ? nextStage
            ? `Approved — advanced to ${nextStage.replace('_', ' ')}`
            : 'Approved — cell completed'
          : '';

      if (reviewMsg) {
        cell.feedbacks.push({
          authorId: userId,
          authorName: userName,
          authorRole: 'Admin' as const,
          message: reviewMsg,
          createdAt: new Date(),
        });
      }

      await cell.save();

      await CellStageHistoryModel.create({
        cellId: cell._id,
        fromStage,
        toStage: cell.currentStage,
        changedBy: userId,
        changedByName: userName,
        reason: feedback?.trim() || 'Approved by admin',
      });

      res.json({
        id: cell._id.toString(),
        currentStage: cell.currentStage,
        stageStatus: cell.stageStatus,
        message: nextStage ? 'Approved and advanced to next stage' : 'Approved — cell completed',
      });
    } else {
      // Reject
      let targetStage: CellStage = 'floor_plan';

      if (cell.currentStage === 'lvs') {
        // LVS reject: can go to floor_plan or routing
        if (rejectTo === 'routing') {
          targetStage = 'routing';
        } else {
          targetStage = 'floor_plan';
        }
      } else if (cell.currentStage === 'drc_1') {
        // 1st DRC reject: goes to floor_plan
        targetStage = 'floor_plan';
      }

      cell.currentStage = targetStage;
      cell.stageStatus = 'in_progress';

      const rejectMsg = feedback?.trim()
        ? feedback.trim()
        : `Rejected — moved back to ${targetStage.replace('_', ' ')}`;

      cell.feedbacks.push({
        authorId: userId,
        authorName: userName,
        authorRole: 'Admin' as const,
        message: rejectMsg,
        createdAt: new Date(),
      });

      await cell.save();

      await CellStageHistoryModel.create({
        cellId: cell._id,
        fromStage,
        toStage: targetStage,
        changedBy: userId,
        changedByName: userName,
        reason: rejectMsg,
      });

      res.json({
        id: cell._id.toString(),
        currentStage: cell.currentStage,
        stageStatus: cell.stageStatus,
        message: `Rejected — moved back to ${targetStage.replace('_', ' ')}`,
      });
    }
  } catch (error) {
    console.error('Error reviewing cell:', error);
    res.status(500).json({ error: 'Failed to review cell' });
  }
}

/** GET /api/project-mgmt/cells/for-review — admin: all cells awaiting review */
async function getCellsForReview(_req: Request, res: Response) {
  try {
    const cells = await CellModel.find({ stageStatus: 'for_review' }).sort({ updatedAt: 1 }).lean();
    const result = await Promise.all(
      cells.map(async (c) => {
        const library = await LibraryModel.findById(c.libraryId).lean();
        const project = library ? await ProjectModel.findById(library.projectId).lean() : null;
        return {
          id: c._id.toString(),
          name: c.name,
          type: c.type,
          currentStage: c.currentStage,
          stageStatus: c.stageStatus,
          assignedTo: c.assignedTo,
          libraryId: c.libraryId.toString(),
          libraryName: library?.name || '',
          projectId: library?.projectId?.toString() || '',
          projectName: project?.projectName || '',
          updatedAt: c.updatedAt,
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching cells for review:', error);
    res.status(500).json({ error: 'Failed to fetch cells for review' });
  }
}

/* ================================================================
   FEEDBACK
   ================================================================ */

/** POST /api/project-mgmt/cells/:cellId/feedback */
async function addFeedback(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    const { message } = req.body;
    const userId = req.user?.id || '';
    const userName = (req as any).user?.name || userId;
    const userRole = (req as any).user?.role || 'Employee';

    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    if (!message?.trim()) {
      res.status(400).json({ error: 'Feedback message is required' });
      return;
    }

    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    cell.feedbacks.push({
      authorId: userId,
      authorName: userName,
      authorRole: userRole === 'Admin' ? 'Admin' as const : 'Employee' as const,
      message: message.trim(),
      createdAt: new Date(),
    });
    await cell.save();

    res.status(201).json({
      cellId: cell._id.toString(),
      feedbacks: cell.feedbacks,
    });
  } catch (error) {
    console.error('Error adding feedback:', error);
    res.status(500).json({ error: 'Failed to add feedback' });
  }
}

/** GET /api/project-mgmt/cells/:cellId/feedbacks */
async function getFeedbacks(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    const cell = await CellModel.findById(cellId).select('feedbacks').lean();
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }
    res.json(cell.feedbacks);
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).json({ error: 'Failed to fetch feedbacks' });
  }
}

/* ================================================================
   EMPLOYEE: GET MY ASSIGNED CELLS
   ================================================================ */

/** GET /api/project-mgmt/cells/my-cells — employee: cells assigned to current user */
async function getMyAssignedCells(req: Request, res: Response) {
  try {
    const assignmentIds = await getAssignmentIds(req);
    if (assignmentIds.length === 0) {
      res.json([]);
      return;
    }

    const cells = await CellModel.find({
      'assignedTo.employeeId': { $in: assignmentIds },
    })
      .sort({ updatedAt: -1 })
      .lean();

    const result = await Promise.all(
      cells.map(async (c) => {
        const library = await LibraryModel.findById(c.libraryId).lean();
        const project = library ? await ProjectModel.findById(library.projectId).lean() : null;
        return {
          id: c._id.toString(),
          name: c.name,
          libraryId: c.libraryId.toString(),
          libraryName: library?.name || '',
          projectId: library?.projectId?.toString() || '',
          projectName: project?.projectName || '',
          type: c.type,
          assignedTo: c.assignedTo,
          currentStage: c.currentStage,
          stageStatus: c.stageStatus,
          feedbacks: c.feedbacks,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching my cells:', error);
    res.status(500).json({ error: 'Failed to fetch assigned cells' });
  }
}

/* ================================================================
   CHECKLIST UPLOAD / DOWNLOAD
   ================================================================ */

/** POST /api/project-mgmt/checklist/upload — admin uploads checklist for cell type */
async function uploadChecklist(req: Request, res: Response) {
  try {
    const { cellType } = req.body;
    const file = (req as any).file as Express.Multer.File | undefined;
    const userId = req.user?.id || '';
    const userName = (req as any).user?.name || userId;

    if (!['Block', 'IO', 'ESD', 'TOP'].includes(cellType)) {
      res.status(400).json({ error: 'Invalid cell type. Must be Block, IO, ESD, or TOP' });
      return;
    }
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    await CellTypeChecklistModel.findOneAndUpdate(
      { cellType },
      {
        $set: {
          fileName: file.originalname,
          fileData: file.buffer,
          mimeType: file.mimetype,
          uploadedBy: userId,
          uploadedByName: userName,
        },
        $setOnInsert: { cellType, items: [] },
      },
      { upsert: true, new: true }
    );

    res.json({
      cellType,
      fileName: file.originalname,
      uploadedBy: userName,
      message: `Checklist uploaded for ${cellType} cells`,
    });
  } catch (error) {
    console.error('Error uploading checklist:', error);
    res.status(500).json({ error: 'Failed to upload checklist' });
  }
}

/** GET /api/project-mgmt/checklist — admin: list all checklists (metadata only) */
async function getChecklists(_req: Request, res: Response) {
  try {
    const checklists = await CellTypeChecklistModel.find()
      .select('-fileData')
      .lean();
    res.json(
      checklists.map((c) => ({
        cellType: c.cellType,
        items: c.items || [],
        fileName: c.fileName,
        hasFile: Boolean(c.fileData?.length),
        uploadedBy: c.uploadedBy,
        uploadedByName: c.uploadedByName,
        updatedAt: c.updatedAt,
      }))
    );
  } catch (error) {
    console.error('Error fetching checklists:', error);
    res.status(500).json({ error: 'Failed to fetch checklists' });
  }
}

/** GET /api/project-mgmt/checklist/:cellType/items — get inline checklist items for a cell type */
async function getTypeChecklistItems(req: Request, res: Response) {
  try {
    const cellType = String(req.params.cellType);
    if (!['Block', 'IO', 'ESD', 'TOP'].includes(cellType)) {
      res.status(400).json({ error: 'Invalid cell type' });
      return;
    }
    const checklist = await CellTypeChecklistModel.findOne({ cellType })
      .select('-fileData')
      .lean();
    res.json({
      cellType,
      items: checklist?.items || [],
      fileName: checklist?.fileName,
      hasFile: Boolean(checklist?.fileData?.length),
    });
  } catch (error) {
    console.error('Error fetching type checklist items:', error);
    res.status(500).json({ error: 'Failed to fetch checklist items' });
  }
}

/** PUT /api/project-mgmt/checklist/:cellType/items — admin: set inline checklist items for cell type */
async function setTypeChecklistItems(req: Request, res: Response) {
  try {
    const cellType = String(req.params.cellType);
    const { items } = req.body as { items?: { label: string }[] };
    const userId = req.user?.id || '';
    const userName = (req as any).user?.name || userId;

    if (!['Block', 'IO', 'ESD', 'TOP'].includes(cellType)) {
      res.status(400).json({ error: 'Invalid cell type' });
      return;
    }
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items array is required' });
      return;
    }

    const mapped = items
      .filter((i) => i.label?.trim())
      .map((i) => ({ id: randomUUID(), label: i.label.trim() }));

    const existing = await CellTypeChecklistModel.findOne({ cellType });
    if (existing) {
      existing.items = mapped;
      existing.uploadedBy = userId;
      existing.uploadedByName = userName;
      await existing.save();
    } else {
      await CellTypeChecklistModel.create({
        cellType,
        items: mapped,
        uploadedBy: userId,
        uploadedByName: userName,
      });
    }

    const updated = await CellTypeChecklistModel.findOne({ cellType }).select('-fileData').lean();
    res.json({
      cellType,
      items: updated?.items || [],
      fileName: updated?.fileName,
      hasFile: Boolean(updated?.fileData?.length),
    });
  } catch (error) {
    console.error('Error setting type checklist items:', error);
    res.status(500).json({ error: 'Failed to update checklist items' });
  }
}

/** GET /api/project-mgmt/checklist/:cellType — download checklist file attachment for a cell type */
async function downloadChecklist(req: Request, res: Response) {
  try {
    const cellType = String(req.params.cellType);
    if (!['Block', 'IO', 'ESD', 'TOP'].includes(cellType)) {
      res.status(400).json({ error: 'Invalid cell type' });
      return;
    }
    const checklist = await CellTypeChecklistModel.findOne({ cellType }).lean();
    if (!checklist?.fileData?.length) {
      res.status(404).json({ error: `No checklist file found for ${cellType} cells` });
      return;
    }
    res.setHeader('Content-Type', checklist.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${checklist.fileName}"`);
    res.send(checklist.fileData);
  } catch (error) {
    console.error('Error downloading checklist:', error);
    res.status(500).json({ error: 'Failed to download checklist' });
  }
}

/** POST /api/project-mgmt/cells/:cellId/views/:viewType — upload schematic/symbol/layout file */
async function uploadCellView(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    const viewType = param(req, 'viewType') as ViewType;
    const file = (req as any).file as Express.Multer.File | undefined;
    const userId = req.user?.id || '';
    const userName = (req as any).user?.name || userId;

    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    if (!VIEW_TYPES.includes(viewType)) {
      res.status(400).json({ error: 'Invalid view type. Must be schematic, symbol, or layout' });
      return;
    }
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    try {
      await assertCellAccess(req, cell, !isAdminRole(req.user?.role || ''));
    } catch (err: any) {
      res.status(err.status || 403).json({ error: err.message });
      return;
    }

    if (!cell.views) cell.views = {};
    cell.views[viewType] = {
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileData: file.buffer,
      uploadedAt: new Date(),
      uploadedBy: userId,
      uploadedByName: userName,
    };
    cell.markModified('views');
    await cell.save();

    res.json({
      cellId: cell._id.toString(),
      viewType,
      view: stripViewFileData(cell.views)[viewType],
      message: `${viewType} file uploaded`,
    });
  } catch (error) {
    console.error('Error uploading cell view:', error);
    res.status(500).json({ error: 'Failed to upload view file' });
  }
}

/** GET /api/project-mgmt/cells/:cellId/views/:viewType — download view file */
async function downloadCellView(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    const viewType = param(req, 'viewType') as ViewType;

    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    if (!VIEW_TYPES.includes(viewType)) {
      res.status(400).json({ error: 'Invalid view type' });
      return;
    }

    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    try {
      await assertCellAccess(req, cell);
    } catch (err: any) {
      res.status(err.status || 403).json({ error: err.message });
      return;
    }

    const view = cell.views?.[viewType];
    if (!view?.fileData?.length) {
      res.status(404).json({ error: `No ${viewType} file uploaded for this cell` });
      return;
    }

    res.setHeader('Content-Type', view.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${view.fileName || viewType}"`);
    res.send(view.fileData);
  } catch (error) {
    console.error('Error downloading cell view:', error);
    res.status(500).json({ error: 'Failed to download view file' });
  }
}

/* ================================================================
   PER-CELL CUSTOM CHECKLIST
   ================================================================ */

/** PUT /api/project-mgmt/cells/:cellId/checklist-items — admin: set checklist items */
async function setCellChecklistItems(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    const { items } = req.body as { items?: { label: string; required?: boolean }[] };

    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items array is required' });
      return;
    }

    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    const existingByLabel = new Map(
      (cell.checklistItems || []).map((i) => [i.label.toLowerCase(), i])
    );

    cell.checklistItems = items
      .filter((i) => i.label?.trim())
      .map((i) => {
        const existing = existingByLabel.get(i.label.trim().toLowerCase());
        if (existing) {
          return {
            ...existing,
            label: i.label.trim(),
            required: i.required !== false,
          };
        }
        return {
          id: randomUUID(),
          label: i.label.trim(),
          required: i.required !== false,
          checked: false,
        };
      });

    await cell.save();
    res.json({ checklistItems: serializeChecklistItems(cell.checklistItems) });
  } catch (error) {
    console.error('Error setting checklist items:', error);
    res.status(500).json({ error: 'Failed to update checklist items' });
  }
}

/** PATCH /api/project-mgmt/cells/:cellId/checklist-items/:itemId — toggle checklist item */
async function toggleCellChecklistItem(req: Request, res: Response) {
  try {
    const cellId = param(req, 'cellId');
    const itemId = param(req, 'itemId');
    const { checked } = req.body as { checked?: boolean };
    const userId = req.user?.id || '';
    const userName = (req as any).user?.name || userId;

    if (!Types.ObjectId.isValid(cellId)) {
      res.status(400).json({ error: 'Invalid cell ID' });
      return;
    }

    const cell = await CellModel.findById(cellId);
    if (!cell) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    const item = (cell.checklistItems || []).find((i) => i.id === itemId);
    if (!item) {
      res.status(404).json({ error: 'Checklist item not found' });
      return;
    }

    const nextChecked = typeof checked === 'boolean' ? checked : !item.checked;
    item.checked = nextChecked;
    item.checkedBy = nextChecked ? userId : undefined;
    item.checkedByName = nextChecked ? userName : undefined;
    item.checkedAt = nextChecked ? new Date() : undefined;

    cell.markModified('checklistItems');
    await cell.save();

    res.json({ checklistItems: serializeChecklistItems(cell.checklistItems) });
  } catch (error) {
    console.error('Error toggling checklist item:', error);
    res.status(500).json({ error: 'Failed to toggle checklist item' });
  }
}

/** GET /api/project-mgmt/cells/for-review/count — admin: count of cells awaiting review */
async function getReviewCount(_req: Request, res: Response) {
  try {
    const count = await CellModel.countDocuments({ stageStatus: 'for_review' });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching review count:', error);
    res.status(500).json({ error: 'Failed to fetch review count' });
  }
}

export const projectMgmtController = {
  getAllProjects,
  getProjectOverview,
  createProject,
  getLibraries,
  createLibrary,
  getCells,
  createCell,
  getCellDetail,
  updateCell,
  advanceCellStage,
  submitForReview,
  reviewCell,
  getCellsForReview,
  getReviewCount,
  addFeedback,
  getFeedbacks,
  getMyAssignedCells,
  uploadChecklist,
  getChecklists,
  getTypeChecklistItems,
  setTypeChecklistItems,
  downloadChecklist,
  setCellChecklistItems,
  toggleCellChecklistItem,
  uploadCellView,
  downloadCellView,
};
