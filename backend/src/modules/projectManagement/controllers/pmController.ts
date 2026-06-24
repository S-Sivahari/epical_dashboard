import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { getDB } from '../../../config/db';
import { ProjectModel } from '../../../models/Project';
import { PMLibraryModel } from '../models/PMLibrary';
import { PMCellModel } from '../models/PMCell';
import { PMViewModel } from '../models/PMView';
import { PMAssignmentModel } from '../models/PMAssignment';
import { PMReviewModel } from '../models/PMReview';
import { PMProjectStateModel } from '../models/PMProjectState';
import { ChecklistTemplateModel } from '../models/ChecklistTemplate';
import { ChecklistTemplateVersionModel } from '../models/ChecklistTemplateVersion';
import { CellChecklistInstanceModel } from '../models/CellChecklistInstance';
import { PMAuditLogModel } from '../models/PMAuditLog';
import { PMNotificationModel } from '../models/PMNotification';
import { pmService, LAYOUT_STAGES } from '../services/pmService';
import { resolveEmployeeForAuthUser } from '../../../utils/employeeAuth';
import { resolveNotificationRecipient } from '../../../services/notificationService';
import { ChecklistResponseModel } from '../models/ChecklistResponse';
import { EmployeeAuditLogModel } from '../models/EmployeeAuditLog';
import { AdminAuditLogModel } from '../models/AdminAuditLog';
import { WorkflowHistoryModel } from '../models/WorkflowHistory';
import { ReviewSubmissionModel } from '../models/ReviewSubmission';
import { ReviewHistoryModel } from '../models/ReviewHistory';

export const pmController = {
  // ──────────────────────────────────────────────────────────────
  // MONITORING DASHBOARD STATS
  // ──────────────────────────────────────────────────────────────
  getDashboardStats: async (req: Request, res: Response): Promise<void> => {
    try {
      // ── Project-level cards ──────────────────────────────────
      const projects = await ProjectModel.find({ status: { $ne: 'Archived' } }).lean();
      const projectCards = await Promise.all(
        projects.map(async (proj) => {
          const libs = await PMLibraryModel.find({ projectId: proj._id, isArchived: false });
          const libIds = libs.map(l => l._id);
          const cells = await PMCellModel.find({ libraryId: { $in: libIds }, isArchived: false });
          const completedCells = cells.filter(c => c.status === 'Completed').length;
          const pendingReviewCells = cells.filter(c => c.status === 'Submitted For Review').length;

          const totalProgress = cells.length > 0
            ? Math.round(cells.reduce((s, c) => s + c.progress, 0) / cells.length)
            : 0;

          const assignmentDocs = await PMAssignmentModel.find({
            projectId: proj._id, isArchived: false,
          });
          const uniqueEmps = new Set(assignmentDocs.map(a => a.employeeId));

          let projectStatus = 'Not Started';
          if (cells.length > 0 && completedCells === cells.length) {
            projectStatus = 'Completed';
          } else if (pendingReviewCells > 0) {
            projectStatus = 'Pending Review';
          } else if (cells.some(c => c.status === 'In Progress' || c.status === 'Rejected')) {
            projectStatus = 'In Progress';
          }

          return {
            id: proj._id.toString(),
            projectName: (proj as any).projectName || (proj as any).name || 'Unnamed',
            description: (proj as any).description || '',
            teamLead: (proj as any).teamLead || (proj as any).projectLead || '',
            assignedEmployeesCount: uniqueEmps.size,
            totalLibraries: libs.length,
            totalCells: cells.length,
            completedCells,
            pendingReviews: pendingReviewCells,
            progress: totalProgress,
            status: projectStatus,
          };
        })
      );

      // ── Summary metrics ──────────────────────────────────────
      const allCells = await PMCellModel.find({ isArchived: false });
      const allAssignments = await PMAssignmentModel.find({ isArchived: false });
      const allReviews = await PMReviewModel.find({ status: 'Pending' });

      const projectsSummary = {
        total: projects.length,
        active: projectCards.filter(p => p.status === 'In Progress').length,
        completed: projectCards.filter(p => p.status === 'Completed').length,
        pendingReview: projectCards.filter(p => p.status === 'Pending Review').length,
      };

      const workflowSummary = {
        totalLibraries: await PMLibraryModel.countDocuments({ isArchived: false }),
        totalCells: allCells.length,
        cellsInProgress: allCells.filter(c => c.status === 'In Progress').length,
        cellsPendingReview: allCells.filter(c => c.status === 'Submitted For Review').length,
        cellsCompleted: allCells.filter(c => c.status === 'Completed').length,
      };

      const uniqueAssignedEmps = new Set(allAssignments.map(a => a.employeeId));
      const reworkCells = allCells.filter(c => c.status === 'Rejected').length;

      const employeeSummary = {
        assignedEmployees: uniqueAssignedEmps.size,
        activeEmployees: uniqueAssignedEmps.size, // all assigned are considered active
        reworkTasks: reworkCells,
      };

      // ── Layout stage distribution ────────────────────────────
      const layoutViews = await PMViewModel.find({ viewType: 'Layout', isArchived: false });
      const stageDistribution: Record<string, number> = {};
      LAYOUT_STAGES.forEach(s => { stageDistribution[s] = 0; });
      stageDistribution['Completed'] = 0;
      layoutViews.forEach(v => {
        const current = v.status === 'Completed' ? 'Completed' : v.currentStage;
        stageDistribution[current] = (stageDistribution[current] || 0) + 1;
      });

      // ── Checklist completion ─────────────────────────────────
      const checklistInstances = await CellChecklistInstanceModel.find();
      let totalItems = 0;
      let completedItems = 0;
      checklistInstances.forEach(c => {
        totalItems += c.totalCount || 0;
        completedItems += c.completedCount || 0;
      });
      const checklistCompletion = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      // ── Recently updated cells ───────────────────────────────
      const recentViews = await PMViewModel.find({ isArchived: false }).sort({ lastUpdated: -1 }).limit(8);
      const recentlyUpdatedCells = await Promise.all(
        recentViews.map(async v => {
          const cell = await PMCellModel.findById(v.cellId);
          return {
            cellId: v.cellId,
            cellName: cell?.name || 'Unknown',
            viewType: v.viewType,
            status: v.status,
            progress: v.progress,
            lastUpdated: v.lastUpdated,
          };
        })
      );

      res.json({
        projectCards,
        projectsSummary,
        workflowSummary,
        employeeSummary,
        layoutStageDistribution: stageDistribution,
        checklistCompletion,
        recentlyUpdatedCells,
        // Legacy compat fields
        totalProjects: projects.length,
        totalLibraries: workflowSummary.totalLibraries,
        totalCells: workflowSummary.totalCells,
        assignedEmployees: employeeSummary.assignedEmployees,
        pendingReviews: allReviews.length,
        completedWork: workflowSummary.cellsCompleted,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch dashboard stats' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // LIBRARIES ENDPOINTS
  // ──────────────────────────────────────────────────────────────
  getLibraries: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.query;
      const filter: any = { isArchived: req.query.archived === 'true' };
      if (projectId) filter.projectId = new Types.ObjectId(projectId as string);

      const libraries = await PMLibraryModel.find(filter).sort({ createdAt: -1 });
      res.json(libraries);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch libraries' });
    }
  },

  createLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, name, description } = req.body;
      if (!projectId || !name) {
        res.status(400).json({ error: 'Project ID and Library Name are required' });
        return;
      }

      // Check if project exists
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const user = req.user?.email || 'Admin';
      const library = await PMLibraryModel.create({
        projectId: new Types.ObjectId(projectId),
        name: name.trim(),
        description: description?.trim(),
        progress: 0,
        status: 'In Progress',
        isArchived: false,
        createdBy: user
      });

      // Isolated PM project state
      await PMProjectStateModel.findOneAndUpdate(
        { projectId: library.projectId },
        { $setOnInsert: { progress: 0, status: 'In Progress' } },
        { upsert: true }
      );

      await pmService.logAuditTrail(user, 'Library Creation', library._id, 'Library', null, library);
      res.status(201).json(library);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create library' });
    }
  },

  updateLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description } = req.body;
      const library = await PMLibraryModel.findById(req.params.id);
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }

      const prev = { name: library.name, description: library.description };
      if (name) library.name = name.trim();
      if (description !== undefined) library.description = description.trim();
      await library.save();

      const user = req.user?.email || 'Admin';
      await pmService.logAuditTrail(user, 'Library Edit', library._id, 'Library', prev, library);
      res.json(library);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to edit library' });
    }
  },

  archiveLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const library = await PMLibraryModel.findById(req.params.id);
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }
      library.isArchived = true;
      await library.save();

      const user = req.user?.email || 'Admin';
      await pmService.logAuditTrail(user, 'Library Archive', library._id, 'Library', null, { isArchived: true });

      // Trigger recalculation on any view of any cell in this library to roll up progress changes
      const cells = await PMCellModel.find({ libraryId: library._id, isArchived: false });
      if (cells.length > 0) {
        const cellViews = await PMViewModel.find({ cellId: cells[0]._id, isArchived: false });
        if (cellViews.length > 0) {
          await pmService.recalculateProgress(cellViews[0]._id);
        }
      }

      res.json({ message: 'Library archived successfully', library });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to archive library' });
    }
  },

  restoreLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const library = await PMLibraryModel.findById(req.params.id);
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }
      library.isArchived = false;
      await library.save();

      const user = req.user?.email || 'Admin';
      await pmService.logAuditTrail(user, 'Library Restore', library._id, 'Library', null, { isArchived: false });

      // Roll up progress
      const cells = await PMCellModel.find({ libraryId: library._id, isArchived: false });
      if (cells.length > 0) {
        const cellViews = await PMViewModel.find({ cellId: cells[0]._id, isArchived: false });
        if (cellViews.length > 0) {
          await pmService.recalculateProgress(cellViews[0]._id);
        }
      }

      res.json({ message: 'Library restored successfully', library });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to restore library' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // CELLS ENDPOINTS (Employee can create)
  // ──────────────────────────────────────────────────────────────
  getCells: async (req: Request, res: Response): Promise<void> => {
    try {
      const { libraryId } = req.query;
      const filter: any = { isArchived: req.query.archived === 'true' };
      if (libraryId) filter.libraryId = new Types.ObjectId(libraryId as string);

      const cells = await PMCellModel.find(filter).sort({ createdAt: -1 }).lean();
      const cellsWithView = await Promise.all(
        cells.map(async (cell) => {
          const view = await PMViewModel.findOne({ cellId: cell._id, isArchived: false });
          return {
            ...cell,
            view: view || null,
            // Legacy compat: wrap single view in array for any downstream that expects views[]
            views: view ? [view] : [],
          };
        })
      );
      res.json(cellsWithView);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch cells' });
    }
  },

  createCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const { libraryId, name, checklistType, viewType } = req.body;
      if (!libraryId || !name || !checklistType || !viewType) {
        res.status(400).json({ error: 'Library ID, Cell Name, Checklist Type, and View Type are required' });
        return;
      }

      // Validate viewType
      if (!['Schematic', 'Symbol', 'Layout'].includes(viewType)) {
        res.status(400).json({ error: 'View Type must be Schematic, Symbol, or Layout' });
        return;
      }

      const library = await PMLibraryModel.findById(libraryId);
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }

      const project = await ProjectModel.findById(library.projectId);
      if (!project) {
        res.status(404).json({ error: 'Parent Project not found' });
        return;
      }

      // Fetch checklist template details to attach latest version
      const template = await ChecklistTemplateModel.findOne({ checklistType, isArchived: false });
      let templateVersionId: Types.ObjectId | undefined;
      let instanceItems: any[] = [];

      if (template) {
        const versionDoc = await ChecklistTemplateVersionModel.findOne({
          templateId: template._id,
          version: template.latestVersion,
        });
        if (versionDoc) {
          templateVersionId = versionDoc._id as Types.ObjectId;
          instanceItems = versionDoc.items.map(item => ({
            itemId: item.itemId,
            text: item.text,
            category: item.category,
            isMandatory: item.isMandatory,
            isCompleted: false,
            isCustom: false,
            isArchived: false,
            order: item.order,
          }));
        }
      }

      if (!templateVersionId) {
        console.warn(`No active checklist template or version found for type: ${checklistType}. Falling back to empty checklist.`);
        templateVersionId = new Types.ObjectId();
      }

      const user = req.user?.email || 'Employee';
      const employee = await resolveEmployeeForAuthUser(req.user?.id || '', req.user?.email);
      const employeeId = employee?.id || '';

      // ── Create Cell with viewType (immutable after creation) ──
      const cell = await PMCellModel.create({
        libraryId: new Types.ObjectId(libraryId),
        name: name.trim(),
        viewType,
        checklistType,
        progress: 0,
        status: 'Not Started',
        isArchived: false,
        createdBy: user,
        createdByEmployee: employeeId || undefined,
        assignedEmployee: employeeId || undefined,
      });

      // Create cell checklist instance
      await CellChecklistInstanceModel.create({
        cellId: cell._id,
        templateVersionId,
        checklistType,
        items: instanceItems,
        completedCount: 0,
        totalCount: instanceItems.length,
      });

      // ── Create exactly ONE view matching the selected viewType ──
      const currentStage = viewType === 'Layout' ? 'Floor Plan' : 'Design';
      const view = await PMViewModel.create({
        cellId: cell._id,
        viewType,
        currentStage,
        progress: 0,
      });

      // ── Create ONE ChecklistResponse for this single view ──
      const answers = instanceItems.map(item => ({
        itemId: item.itemId,
        text: item.text,
        category: item.category,
        isMandatory: item.isMandatory,
        response: 'None' as const,
        notes: '',
        remarks: '',
        order: item.order,
      }));

      await ChecklistResponseModel.create({
        cellId: cell._id,
        viewId: view._id,
        viewType,
        checklistType,
        templateVersionId,
        answers,
        status: 'Not Started',
        completedCount: 0,
        totalCount: answers.length,
      });

      // ── Create ONE assignment to the creator employee ──
      if (employeeId) {
        await PMAssignmentModel.create({
          projectId: library.projectId,
          libraryId: library._id,
          cellId: cell._id,
          viewId: view._id,
          viewType,
          employeeId,
          assignedBy: user,
          isArchived: false,
        });

        await PMNotificationModel.create({
          recipientId: employeeId,
          recipientType: 'Employee',
          title: 'Assigned to Cell Workspace',
          message: `You created Cell "${cell.name}" (${viewType}) and have been assigned to its workspace.`,
          relatedData: { cellId: cell._id.toString() },
        });
      }

      await pmService.logAuditTrail(user, 'Cell Creation', cell._id, 'Cell', null, cell);

      if (req.user?.role === 'admin') {
        await AdminAuditLogModel.create({
          adminEmail: req.user.email,
          action: 'Cell Created',
          details: `Cell ${cell.name} (${viewType}) created under library ${library.name}`,
          relatedId: cell._id,
          relatedType: 'Cell',
          newState: cell,
        });
      } else {
        await EmployeeAuditLogModel.create({
          employeeId: employeeId || req.user?.id || 'unknown',
          employeeName: employee?.employeeName || employee?.name || user,
          action: 'Cell Created',
          details: `Cell ${cell.name} (${viewType}) created under library ${library.name}`,
          relatedId: cell._id,
          relatedType: 'Cell',
        });
      }

      res.status(201).json({ cell, view, views: [view] });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create cell' });
    }
  },

  updateCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.body;
      const cell = await PMCellModel.findById(req.params.id);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const prev = { name: cell.name };
      if (name) cell.name = name.trim();
      await cell.save();

      const user = req.user?.email || 'Employee';
      await pmService.logAuditTrail(user, 'Cell Edit', cell._id, 'Cell', prev, cell);
      res.json(cell);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to edit cell' });
    }
  },

  archiveCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const cell = await PMCellModel.findById(req.params.id);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }
      cell.isArchived = true;
      await cell.save();

      const user = req.user?.email || 'Employee';
      await pmService.logAuditTrail(user, 'Cell Archive', cell._id, 'Cell', null, { isArchived: true });

      // Recalculate library progress
      const views = await PMViewModel.find({ cellId: cell._id, isArchived: false });
      if (views.length > 0) {
        await pmService.recalculateProgress(views[0]._id);
      }

      res.json({ message: 'Cell archived successfully', cell });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to archive cell' });
    }
  },

  restoreCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const cell = await PMCellModel.findById(req.params.id);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }
      cell.isArchived = false;
      await cell.save();

      const user = req.user?.email || 'Employee';
      await pmService.logAuditTrail(user, 'Cell Restore', cell._id, 'Cell', null, { isArchived: false });

      // Recalculate library progress
      const views = await PMViewModel.find({ cellId: cell._id, isArchived: false });
      if (views.length > 0) {
        await pmService.recalculateProgress(views[0]._id);
      }

      res.json({ message: 'Cell restored successfully', cell });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to restore cell' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // VIEWS ENDPOINTS
  // ──────────────────────────────────────────────────────────────
  getViewDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const view = await PMViewModel.findById(req.params.id);
      if (!view) {
        res.status(404).json({ error: 'View not found' });
        return;
      }
      const cell = await PMCellModel.findById(view.cellId);
      const assignments = await PMAssignmentModel.find({ viewId: view._id, isArchived: false });

      res.json({
        view,
        cellName: cell?.name,
        assignments
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch view' });
    }
  },

  // Serves both GET /workspace/views and GET /workspace/my-cells
  getWorkspaceViews: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const employee = await resolveEmployeeForAuthUser(authUser.id || '', authUser.email);
      if (!employee) {
        res.status(404).json({ error: 'Employee record not found for user' });
        return;
      }

      // Find cells assigned to employee (1 cell = 1 view)
      const assignments = await PMAssignmentModel.find({ employeeId: employee.id, isArchived: false });

      const populated = await Promise.all(
        assignments.map(async (asn) => {
          const cell = await PMCellModel.findById(asn.cellId);
          if (!cell || cell.isArchived) return null;

          const view = await PMViewModel.findOne({ cellId: cell._id, isArchived: false });
          if (!view) return null;

          const library = await PMLibraryModel.findById(cell.libraryId);
          const project = await ProjectModel.findById(asn.projectId);

          return {
            id: view._id.toString(),
            cellId: cell._id.toString(),
            cellName: cell.name,
            viewType: cell.viewType || view.viewType,
            checklistType: cell.checklistType,
            status: view.status,
            currentStage: view.currentStage,
            completedStages: view.completedStages,
            checkpointStatus: view.checkpointStatus,
            reviewStatus: view.reviewStatus,
            progress: view.progress,
            libraryId: cell.libraryId.toString(),
            libraryName: library?.name || '',
            projectId: asn.projectId.toString(),
            projectName: (project as any)?.projectName || '',
          };
        })
      );

      res.json(populated.filter(Boolean));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch employee workspace' });
    }
  },

  updateViewStage: async (req: Request, res: Response): Promise<void> => {
    try {
      const { stage } = req.body;
      const view = await PMViewModel.findById(req.params.id);
      if (!view) {
        res.status(404).json({ error: 'View not found' });
        return;
      }

      if (view.status === 'Submitted For Review' || view.status === 'Completed') {
        res.status(400).json({ error: 'View is currently locked' });
        return;
      }

      if (view.viewType !== 'Layout') {
        res.status(400).json({ error: 'Stage updates are only allowed for Layout views' });
        return;
      }

      if (!LAYOUT_STAGES.includes(stage)) {
        res.status(400).json({ error: `Invalid stage Layout: ${stage}` });
        return;
      }

      const prevStage = view.currentStage;
      const targetIndex = LAYOUT_STAGES.indexOf(stage);

      // Verify that Checkpoint 1 occurs ONLY after Floor Plan & DRC Review
      // If moving beyond DRC Review, Checkpoint 1 must be approved
      if (targetIndex > 1 && view.checkpointStatus.checkpoint1 !== 'Approved') {
        res.status(400).json({
          error: 'Checkpoint 1 must be Approved before moving to Routing or subsequent stages.'
        });
        return;
      }

      // Enforce sequential natural stage progression for employees (no skipping stages)
      const currentStageIndex = LAYOUT_STAGES.indexOf(prevStage);
      if (targetIndex > currentStageIndex + 1) {
        res.status(400).json({ error: 'Cannot skip workflow stages.' });
        return;
      }

      view.currentStage = stage;
      
      // Update completed stages
      const completedSet = new Set(view.completedStages);
      for (let i = 0; i < targetIndex; i++) {
        completedSet.add(LAYOUT_STAGES[i]);
      }
      view.completedStages = Array.from(completedSet);
      view.lastUpdated = new Date();
      await view.save();

      const user = req.user?.email || 'Employee';
      const employee = await resolveEmployeeForAuthUser(req.user?.id || '', req.user?.email);
      const changedBy = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : (req.user?.email || 'Employee');

      await pmService.logAuditTrail(
        user,
        'Stage Movement',
        view._id,
        'View',
        { stage: prevStage },
        { stage }
      );

      await WorkflowHistoryModel.create({
        viewId: view._id,
        viewType: view.viewType,
        cellId: view.cellId,
        stageFrom: prevStage,
        stageTo: stage,
        action: 'Stage Moved',
        changedBy,
        timestamp: new Date()
      });

      if (req.user?.role === 'admin') {
        await AdminAuditLogModel.create({
          adminEmail: req.user.email,
          action: 'Stage Progressed',
          details: `View ${view.viewType} stage updated from ${prevStage} to ${stage}`,
          relatedId: view._id,
          relatedType: 'View',
          previousState: { stage: prevStage },
          newState: { stage }
        });
      } else {
        await EmployeeAuditLogModel.create({
          employeeId: employee?.id || req.user?.id || 'unknown',
          employeeName: changedBy,
          action: 'Stage Progressed',
          details: `View ${view.viewType} stage updated from ${prevStage} to ${stage}`,
          relatedId: view._id,
          relatedType: 'View'
        });
      }

      await pmService.recalculateProgress(view._id);
      res.json(view);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update stage' });
    }
  },

  submitView: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const employee = await resolveEmployeeForAuthUser(authUser.id, authUser.email);
      const viewId = new Types.ObjectId(req.params.id as string);

      const view = await pmService.submitViewForReview(viewId, employee?.id || authUser.id);
      res.json(view);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Submission failed' });
    }
  },

  overrideViewWorkflow: async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, currentStage, completedStages, checkpointStatus } = req.body;
      const view = await PMViewModel.findById(req.params.id);
      if (!view) {
        res.status(404).json({ error: 'View not found' });
        return;
      }

      const prev = {
        status: view.status,
        currentStage: view.currentStage,
        completedStages: view.completedStages,
        checkpointStatus: view.checkpointStatus
      };

      if (status) view.status = status;
      if (currentStage) view.currentStage = currentStage;
      if (completedStages) view.completedStages = completedStages;
      if (checkpointStatus) view.checkpointStatus = checkpointStatus;

      view.lastUpdated = new Date();
      await view.save();

      const user = req.user?.email || 'Admin';
      await pmService.logAuditTrail(user, 'Workflow Override', view._id, 'View', prev, view);
      await pmService.recalculateProgress(view._id);

      res.json(view);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to override workflow status' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // ASSIGNMENTS ENDPOINTS
  // ──────────────────────────────────────────────────────────────
  getAssignments: async (req: Request, res: Response): Promise<void> => {
    try {
      const { viewId, cellId, projectId } = req.query;
      const filter: any = { isArchived: req.query.archived === 'true' };
      if (viewId) filter.viewId = new Types.ObjectId(viewId as string);
      if (cellId) filter.cellId = new Types.ObjectId(cellId as string);
      if (projectId) filter.projectId = new Types.ObjectId(projectId as string);

      const list = await PMAssignmentModel.find(filter);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch assignments' });
    }
  },

  assignEmployee: async (req: Request, res: Response): Promise<void> => {
    try {
      // Accept either cellId (new) or viewId (legacy compat)
      const { cellId, viewId, employeeId } = req.body;
      if ((!cellId && !viewId) || !employeeId) {
        res.status(400).json({ error: 'Cell ID (or View ID) and Employee ID are required' });
        return;
      }

      let cell;
      let view;

      if (cellId) {
        cell = await PMCellModel.findById(cellId);
        if (!cell) { res.status(404).json({ error: 'Cell not found' }); return; }
        view = await PMViewModel.findOne({ cellId: cell._id, isArchived: false });
        if (!view) { res.status(404).json({ error: 'View not found for this cell' }); return; }
      } else {
        view = await PMViewModel.findById(viewId);
        if (!view) { res.status(404).json({ error: 'View not found' }); return; }
        cell = await PMCellModel.findById(view.cellId);
        if (!cell) { res.status(404).json({ error: 'Cell not found' }); return; }
      }

      const library = await PMLibraryModel.findById(cell.libraryId);
      if (!library) { res.status(404).json({ error: 'Library not found' }); return; }
      if (!library.projectId) { res.status(400).json({ error: 'Library is not linked to a valid Project' }); return; }

      // Archive existing assignments for this cell to ensure 1 employee per cell
      await PMAssignmentModel.updateMany({ cellId: cell._id }, { $set: { isArchived: true } });

      const adminUser = req.user?.email || 'Admin';
      const assignment = await PMAssignmentModel.create({
        projectId: library.projectId,
        libraryId: library._id,
        cellId: cell._id,
        viewId: view._id,
        viewType: cell.viewType || view.viewType,
        employeeId,
        assignedBy: adminUser,
        isArchived: false,
      });

      // Update primary assigned employee on Cell
      cell.assignedEmployee = employeeId;
      await cell.save();

      // Send persistent notification
      await PMNotificationModel.create({
        recipientId: employeeId,
        recipientType: 'Employee',
        title: 'Assigned to Cell Workspace',
        message: `Admin assigned you to work on Cell ${cell.name} (${cell.viewType}).`,
        relatedData: {
          cellId: cell._id.toString(),
          viewType: cell.viewType,
        },
      });

      await pmService.logAuditTrail(adminUser, 'Employee Assignment', cell._id, 'Cell', null, { employeeId });

      res.status(201).json(assignment);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Assignment failed' });
    }
  },

  archiveAssignment: async (req: Request, res: Response): Promise<void> => {
    try {
      const assignment = await PMAssignmentModel.findById(req.params.id);
      if (!assignment) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }

      assignment.isArchived = true;
      await assignment.save();

      const adminUser = req.user?.email || 'Admin';
      await pmService.logAuditTrail(
        adminUser,
        'Employee Reassignment',
        assignment.viewId,
        'View',
        { employeeId: assignment.employeeId },
        { employeeId: null }
      );

      res.json({ message: 'Employee unassigned (assignment archived) successfully', assignment });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Archive assignment failed' });
    }
  },

  restoreAssignment: async (req: Request, res: Response): Promise<void> => {
    try {
      const assignment = await PMAssignmentModel.findById(req.params.id);
      if (!assignment) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }

      assignment.isArchived = false;
      await assignment.save();

      const adminUser = req.user?.email || 'Admin';
      await pmService.logAuditTrail(
        adminUser,
        'Employee Assignment',
        assignment.viewId,
        'View',
        null,
        { employeeId: assignment.employeeId }
      );

      res.json({ message: 'Employee assignment restored successfully', assignment });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Restore assignment failed' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // REVIEWS QUEUE (ADMIN & EMPLOYEE LISTS)
  // ──────────────────────────────────────────────────────────────
  getAdminReviews: async (req: Request, res: Response): Promise<void> => {
    try {
      // Fetch reviews with basic aggregation
      const reviews = await PMReviewModel.find({ isArchived: false }).sort({ createdAt: -1 });
      
      const populated = await Promise.all(
        reviews.map(async r => {
          const view = await PMViewModel.findById(r.viewId);
          const cell = await PMCellModel.findById(r.cellId);
          const library = await PMLibraryModel.findById(r.libraryId);
          const project = await ProjectModel.findById(r.projectId);
          
          return {
            id: r._id.toString(),
            viewId: r.viewId,
            viewType: r.viewType,
            reviewType: r.reviewType,
            status: r.status,
            comments: r.comments,
            correctiveAction: r.correctiveAction,
            returnStage: r.returnStage,
            submittedBy: r.submittedBy,
            reviewedBy: r.reviewedBy,
            reviewedAt: r.reviewedAt,
            createdAt: r.createdAt,
            cellName: cell?.name,
            libraryName: library?.name,
            projectName: project?.projectName,
            stagesCompleted: view?.completedStages ?? []
          };
        })
      );

      // Group into queues
      const pending = populated.filter(r => r.status === 'Pending' && r.reviewType === 'Standard');
      const checkpoint1 = populated.filter(r => r.status === 'Pending' && r.reviewType === 'Checkpoint 1');
      const checkpoint2 = populated.filter(r => r.status === 'Pending' && r.reviewType === 'Checkpoint 2');
      const rejected = populated.filter(r => r.status === 'Rejected');
      const approved = populated.filter(r => r.status === 'Approved');
      const recentlySubmitted = populated.slice(0, 10);

      res.json({
        pendingReviews: pending,
        checkpoint1Reviews: checkpoint1,
        checkpoint2Reviews: checkpoint2,
        rejectedWork: rejected,
        approvedWork: approved,
        recentlySubmitted
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch review queues' });
    }
  },

  getEmployeeReviews: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const employee = await resolveEmployeeForAuthUser(authUser.id || '', authUser.email);
      const employeeId = employee?.id || authUser.id;

      const reviews = await PMReviewModel.find({ submittedBy: employeeId, isArchived: false })
        .sort({ createdAt: -1 });

    const populated = await Promise.all(
        reviews.map(async r => {
          const cell = await PMCellModel.findById(r.cellId);
          const library = await PMLibraryModel.findById(r.libraryId);
          const project = await ProjectModel.findById(r.projectId);
          
          return {
            id: r._id.toString(),
            viewType: r.viewType,
            reviewType: r.reviewType,
            status: r.status,
            comments: r.comments,
            correctiveAction: r.correctiveAction,
            returnStage: r.returnStage,
            reviewedBy: r.reviewedBy,
            reviewedAt: r.reviewedAt,
            createdAt: r.createdAt,
            cellName: cell?.name,
            libraryName: library?.name,
            projectName: project?.projectName
          };
        })
      );

      res.json(populated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch employee reviews' });
    }
  },

  actionReview: async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, returnStage, comments, correctiveAction } = req.body;
      if (!status || !['Approved', 'Rejected'].includes(status)) {
        res.status(400).json({ error: 'Invalid review action. Must be Approved or Rejected.' });
        return;
      }

      const adminUser = req.user?.email || 'Admin';
      const reviewId = new Types.ObjectId(req.params.id as string);

      if (status === 'Approved') {
        await pmService.approveReview(reviewId, adminUser, comments || '');
      } else {
        if (!returnStage) {
          res.status(400).json({ error: 'Return Stage is required for rejection.' });
          return;
        }
        await pmService.rejectReview(reviewId, adminUser, returnStage, comments || '', correctiveAction || '');
      }

      res.json({ message: `Review successfully marked as ${status}` });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Action failed' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // CHECKLISTS TEMPLATES & EXECUTION
  // ──────────────────────────────────────────────────────────────
  uploadChecklistTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { checklistType } = req.body;
      if (!checklistType || !['Block', 'IO', 'ESD', 'TOP'].includes(checklistType)) {
        res.status(400).json({ error: 'Valid Checklist Type is required.' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Checklist Excel file (.xlsx/.xls) is required.' });
        return;
      }

      // Parse Excel buffer
      const parsedItems = await pmService.parseChecklistExcel(req.file.buffer);

      let template = await ChecklistTemplateModel.findOne({ checklistType });
      let versionNumber = 1;

      if (template) {
        versionNumber = template.latestVersion + 1;
        template.latestVersion = versionNumber;
        await template.save();
      } else {
        template = await ChecklistTemplateModel.create({
          checklistType,
          latestVersion: versionNumber,
          isArchived: false
        });
      }

      const adminUser = req.user?.email || 'Admin';
      const templateVersion = await ChecklistTemplateVersionModel.create({
        templateId: template._id,
        checklistType,
        version: versionNumber,
        items: parsedItems,
        fileName: req.file.originalname,
        uploadedBy: adminUser
      });

      await pmService.logAuditTrail(
        adminUser,
        `Checklist Template Version v${versionNumber} Uploaded`,
        template._id,
        'ChecklistTemplate',
        null,
        { version: versionNumber, itemsCount: parsedItems.length }
      );

      res.status(201).json({
        message: 'Checklist parsed and versioned successfully',
        template,
        version: templateVersion
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to upload checklist template' });
    }
  },

  getTemplates: async (req: Request, res: Response): Promise<void> => {
    try {
      const templates = await ChecklistTemplateModel.find({ isArchived: false });
      const populated = await Promise.all(
        templates.map(async t => {
          const versions = await ChecklistTemplateVersionModel.find({ templateId: t._id }).sort({ version: -1 });
          return {
            id: t._id.toString(),
            checklistType: t.checklistType,
            latestVersion: t.latestVersion,
            versions: versions.map(v => ({
              id: v._id.toString(),
              version: v.version,
              fileName: v.fileName,
              itemsCount: v.items.length,
              uploadedBy: v.uploadedBy,
              createdAt: v.createdAt
            }))
          };
        })
      );

      res.json(populated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch templates' });
    }
  },

  getTemplateItems: async (req: Request, res: Response): Promise<void> => {
    try {
      const { versionId } = req.params;
      const versionDoc = await ChecklistTemplateVersionModel.findById(versionId);
      if (!versionDoc) {
        res.status(404).json({ error: 'Template version not found' });
        return;
      }
      res.json(versionDoc.items);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch items' });
    }
  },

  migrateCellChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const { cellId, versionId } = req.body;
      const cell = await PMCellModel.findById(cellId);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const newVersion = await ChecklistTemplateVersionModel.findById(versionId);
      if (!newVersion) {
        res.status(404).json({ error: 'Target version not found' });
        return;
      }

      const instance = await CellChecklistInstanceModel.findOne({ cellId: cell._id });
      if (!instance) {
        res.status(404).json({ error: 'Cell Checklist instance not found' });
        return;
      }

      // Map current checked items to preserve progress where items text match
      const prevItemsMap = new Map(instance.items.map(item => [item.text, item]));

      const newItems = newVersion.items.map(item => {
        const existing = prevItemsMap.get(item.text);
        return {
          itemId: item.itemId,
          text: item.text,
          category: item.category,
          isMandatory: item.isMandatory,
          isCompleted: existing ? existing.isCompleted : false,
          notes: existing ? existing.notes : '',
          observations: existing ? existing.observations : '',
          isCustom: false,
          isArchived: false,
          order: item.order
        };
      });

      // Keep custom execution items added by employees
      const customItems = instance.items.filter(item => item.isCustom);
      const mergedItems = [...newItems, ...customItems];

      instance.templateVersionId = newVersion._id;
      instance.items = mergedItems;
      instance.completedCount = mergedItems.filter(item => item.isCompleted && !item.isArchived).length;
      instance.totalCount = mergedItems.filter(item => !item.isArchived).length;
      await instance.save();

      const user = req.user?.email || 'Admin';
      await pmService.logAuditTrail(
        user,
        `Checklist Migrated to Version v${newVersion.version}`,
        cell._id,
        'Cell',
        null,
        { version: newVersion.version }
      );

      res.json({ message: 'Cell checklist successfully migrated', instance });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Migration failed' });
    }
  },

  getCellChecklistInstance: async (req: Request, res: Response): Promise<void> => {
    try {
      const instance = await CellChecklistInstanceModel.findOne({
        cellId: new Types.ObjectId(req.params.cellId as string)
      });
      if (!instance) {
        res.status(404).json({ error: 'Instance not found' });
        return;
      }
      res.json(instance);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch instance' });
    }
  },

  autosaveChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items } = req.body;
      const instance = await CellChecklistInstanceModel.findOne({
        cellId: new Types.ObjectId(req.params.cellId as string)
      });

      if (!instance) {
        res.status(404).json({ error: 'Instance not found' });
        return;
      }

      // Check if view locked
      const view = await PMViewModel.findOne({ cellId: instance.cellId, status: { $in: ['Submitted For Review', 'Completed'] } });
      if (view) {
        res.status(400).json({ error: 'Cell view checklist is currently locked' });
        return;
      }

      // Save list execution
      instance.items = items;
      instance.completedCount = items.filter((item: any) => item.isCompleted && !item.isArchived).length;
      instance.totalCount = items.filter((item: any) => !item.isArchived).length;
      await instance.save();

      const user = req.user?.email || 'Employee';
      await pmService.logAuditTrail(
        user,
        'Checklist Modifications',
        instance._id,
        'CellChecklistInstance',
        null,
        { completedCount: instance.completedCount, totalCount: instance.totalCount }
      );

      res.json(instance);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Autosave failed' });
    }
  },

  addCustomChecklistItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, category, isMandatory } = req.body;
      if (!text) {
        res.status(400).json({ error: 'Item Text is required' });
        return;
      }

      const instance = await CellChecklistInstanceModel.findOne({
        cellId: new Types.ObjectId(req.params.cellId as string)
      });

      if (!instance) {
        res.status(404).json({ error: 'Instance not found' });
        return;
      }

      const user = req.user?.email || 'Employee';
      const newItem = {
        itemId: `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        text: text.trim(),
        category: category || 'Custom',
        isMandatory: !!isMandatory,
        isCompleted: false,
        notes: '',
        observations: '',
        isCustom: true,
        isArchived: false,
        order: instance.items.length + 1
      };

      instance.items.push(newItem);
      instance.totalCount += 1;
      await instance.save();

      await pmService.logAuditTrail(
        user,
        'Checklist Item Custom Add',
        instance._id,
        'CellChecklistInstance',
        null,
        newItem
      );

      res.status(201).json(instance);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to add custom checklist item' });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // AUDIT LOGS ENDPOINT
  // ──────────────────────────────────────────────────────────────
  getAuditLogs: async (req: Request, res: Response): Promise<void> => {
    try {
      const { search } = req.query;
      const filter: any = {};
      if (search) {
        const searchRegex = new RegExp(search as string, 'i');
        filter.$or = [
          { user: searchRegex },
          { action: searchRegex },
          { targetType: searchRegex }
        ];
      }

      const logs = await PMAuditLogModel.find(filter).sort({ timestamp: -1 }).limit(100);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
  },

  getNotifications: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const recipient = await resolveNotificationRecipient(
        authUser.id || '',
        authUser.email,
        authUser.role || 'employee',
      );

      const notifications = await PMNotificationModel.find({
        recipientId: recipient.recipientId,
        recipientType: recipient.recipientType === 'Manager' ? 'Admin' : recipient.recipientType,
      }).sort({ createdAt: -1 }).limit(50);

      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
    }
  },

  markNotificationRead: async (req: Request, res: Response): Promise<void> => {
    try {
      const notification = await PMNotificationModel.findById(req.params.id);
      if (!notification) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }
      notification.isRead = true;
      await notification.save();
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update notification' });
    }
  },

  autoPauseWorkspace: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const employee = await resolveEmployeeForAuthUser(authUser.id, authUser.email);
      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const identityTokens = [
        employee.id,
        employee.firstName + ' ' + (employee.lastName || ''),
        employee.email,
        employee.employeeId
      ].filter(Boolean);

      const openLog = await mongoose.model('Timesheet').findOne({
        $and: [
          {
            $or: [
              { employeeId: { $in: identityTokens } },
              { employee: { $in: identityTokens } },
            ],
          },
          {
            $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }]
          }
        ],
        taskStatus: { $in: ['In Progress', 'Session Incomplete'] }
      });

      if (!openLog) {
        res.json({ message: 'No active task running' });
        return;
      }

      const now = new Date();
      openLog.taskStatus = 'Paused';
      openLog.pausedAt = now;
      await openLog.save();
      
      const { syncProjectForTimesheet } = require('../../../utils/syncProject');
      await syncProjectForTimesheet(openLog);

      // Log to EmployeeAuditLog
      await EmployeeAuditLogModel.create({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
        action: 'Auto Pause',
        details: `Workspace auto-paused due to 10 minutes of inactivity. Task paused: ${openLog.task}`,
        relatedId: openLog._id,
        relatedType: 'Timesheet'
      });

      res.json({ message: 'Workspace task auto-paused successfully', timesheet: openLog });
    } catch (error: any) {
      console.error('Workspace auto-pause error:', error);
      res.status(500).json({ error: error.message || 'Auto pause failed' });
    }
  },

  getEmployeeAuditLogs: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const employee = await resolveEmployeeForAuthUser(authUser.id, authUser.email);
      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const logs = await EmployeeAuditLogModel.find({ employeeId: employee.id })
        .sort({ timestamp: -1 })
        .limit(100);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch employee audit logs' });
    }
  },

  getEmployeeDashboardMetrics: async (req: Request, res: Response): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const employee = await resolveEmployeeForAuthUser(authUser.id, authUser.email);
      if (!employee) {
        res.status(404).json({ error: 'Employee record not found' });
        return;
      }

      const assignments = await PMAssignmentModel.find({ employeeId: employee.id, isArchived: false });
      
      const projectIds = Array.from(new Set(assignments.map(a => a.projectId.toString())));
      const libraryIds = Array.from(new Set(assignments.map(a => a.libraryId.toString())));
      const cellIds = Array.from(new Set(assignments.map(a => a.cellId.toString())));
      const viewIds = assignments.map(a => a.viewId);

      const [completedViewsCount, reviews] = await Promise.all([
        PMViewModel.countDocuments({ _id: { $in: viewIds }, status: 'Completed', isArchived: false }),
        PMReviewModel.find({ submittedBy: employee.id, isArchived: false })
      ]);

      const pendingReviews = reviews.filter(r => r.status === 'Pending').length;
      const approvedReviews = reviews.filter(r => r.status === 'Approved').length;
      const rejectedReviews = reviews.filter(r => r.status === 'Rejected').length;

      res.json({
        assignedProjects: projectIds.length,
        assignedLibraries: libraryIds.length,
        assignedCells: cellIds.length,
        assignedViews: viewIds.length,
        completedViews: completedViewsCount,
        pendingReviews,
        approvedReviews,
        rejectedReviews
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch employee dashboard metrics' });
    }
  },

  compareTemplateVersions: async (req: Request, res: Response): Promise<void> => {
    try {
      const { versionAId, versionBId } = req.query;
      if (!versionAId || !versionBId) {
        res.status(400).json({ error: 'versionAId and versionBId are required query parameters' });
        return;
      }

      const [versionA, versionB] = await Promise.all([
        ChecklistTemplateVersionModel.findById(versionAId),
        ChecklistTemplateVersionModel.findById(versionBId)
      ]);

      if (!versionA || !versionB) {
        res.status(404).json({ error: 'One or both checklist template versions not found' });
        return;
      }

      res.json({
        versionA: {
          version: versionA.version,
          fileName: versionA.fileName,
          uploadedBy: versionA.uploadedBy,
          createdAt: versionA.createdAt,
          items: versionA.items
        },
        versionB: {
          version: versionB.version,
          fileName: versionB.fileName,
          uploadedBy: versionB.uploadedBy,
          createdAt: versionB.createdAt,
          items: versionB.items
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to compare template versions' });
    }
  },

  getViewChecklistResponse: async (req: Request, res: Response): Promise<void> => {
    try {
      const { viewId } = req.params;
      const response = await ChecklistResponseModel.findOne({ viewId: new Types.ObjectId(String(viewId)) });
      if (!response) {
        res.status(404).json({ error: 'Checklist response not found for this view' });
        return;
      }
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch checklist response' });
    }
  },

  autosaveViewChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const { viewId } = req.params;
      const { answers } = req.body;

      const checklistResponse = await ChecklistResponseModel.findOne({ viewId: new Types.ObjectId(String(viewId)) });
      if (!checklistResponse) {
        res.status(404).json({ error: 'Checklist response not found' });
        return;
      }

      // Check if view locked
      const view = await PMViewModel.findById(String(viewId));
      if (!view) {
        res.status(404).json({ error: 'View not found' });
        return;
      }
      if (view.status === 'Submitted For Review' || view.status === 'Completed') {
        res.status(400).json({ error: 'Checklist is locked because this view is submitted or completed' });
        return;
      }

      checklistResponse.answers = answers;
      checklistResponse.completedCount = answers.filter((a: any) => a.response === 'Pass' || a.response === 'Fail').length;
      checklistResponse.totalCount = answers.length;
      await checklistResponse.save();

      const user = req.user?.email || 'Employee';
      await pmService.logAuditTrail(
        user,
        'Checklist Response Save',
        checklistResponse._id,
        'CellChecklistInstance',
        null,
        { completedCount: checklistResponse.completedCount, totalCount: checklistResponse.totalCount }
      );

      res.json(checklistResponse);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Autosave failed' });
    }
  }
};
