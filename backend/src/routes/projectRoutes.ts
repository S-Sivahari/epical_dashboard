import { Router } from 'express';
import multer from 'multer';
import { projectController } from '../controllers/projectController';
import { projectWorkspaceController } from '../controllers/projectWorkspaceController';
import { projectTypeChecklistController } from '../controllers/projectTypeChecklistController';
import { employeeProjectController } from '../controllers/employeeProjectController';
import { checklistController } from '../controllers/checklistController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');
const checklistUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.use(authMiddleware);

router.get('/assigned/me', projectController.getAssignedForCurrentUser);
router.get('/mine/reviews', employeeProjectController.listMyRequestedReviews);
router.get('/:projectId/mine/workspace', employeeProjectController.getMyWorkspace);
router.get('/:projectId/mine/dependency-graph', employeeProjectController.getMyDependencyGraph);
router.get('/:projectId/cells/:cellId/mine', employeeProjectController.getMyCell);
router.patch('/:projectId/cells/:cellId/mine/workflow', employeeProjectController.updateWorkflow);
router.post('/:projectId/cells/:cellId/mine/reviews', employeeProjectController.requestReview);
router.get('/:projectId/cells/:cellId/mine/reviews', employeeProjectController.listMyCellReviews);
router.get('/:projectId/cells/:cellId/mine/checklist', employeeProjectController.getMyCellChecklist);
router.patch(
  '/:projectId/cells/:cellId/mine/checklist/:mappingId',
  employeeProjectController.updateMyCellChecklistItem,
);

router.get('/', adminOnly, projectController.getAll);
router.get('/archived', adminOnly, projectController.getArchivedProjects);
router.get('/archived/:id', adminOnly, projectController.getArchivedProjectById);
router.delete('/archived/:id', adminOnly, projectController.deleteArchivedProject);
router.post('/archived/:id/restore', adminOnly, projectController.restoreProject);
router.post('/:id/archive', adminOnly, projectController.archiveProject);
router.get('/:projectId/type-checklists/template', adminOnly, projectTypeChecklistController.downloadTemplate);
router.get('/:projectId/type-checklists', adminOnly, projectTypeChecklistController.list);
router.get('/:projectId/type-checklists/:cellType/download', adminOnly, projectTypeChecklistController.download);
router.post(
  '/:projectId/type-checklists/:cellType',
  adminOnly,
  checklistUpload.single('file'),
  projectTypeChecklistController.upload,
);
router.delete('/:projectId/type-checklists/:cellType', adminOnly, projectTypeChecklistController.remove);
router.get('/:projectId/cells/:cellId/type-checklist', adminOnly, projectTypeChecklistController.getForCell);
router.get(
  '/:projectId/cells/:cellId/type-checklist/responses',
  adminOnly,
  projectTypeChecklistController.getCellResponses,
);
router.patch(
  '/:projectId/cells/:cellId/type-checklist/responses/:itemIndex',
  adminOnly,
  projectTypeChecklistController.updateCellResponse,
);
router.post(
  '/:projectId/cells/:cellId/type-checklist/custom-items',
  adminOnly,
  projectTypeChecklistController.addCustomItem,
);
router.delete(
  '/:projectId/cells/:cellId/type-checklist/items/:itemKey',
  adminOnly,
  projectTypeChecklistController.deleteItem,
);
router.patch(
  '/:projectId/cells/:cellId/type-checklist/custom-items/:customItemId',
  adminOnly,
  projectTypeChecklistController.updateCustomItemResponse,
);
router.patch(
  '/:projectId/cells/:cellId/type-checklist/extension',
  adminOnly,
  projectTypeChecklistController.updateExtension,
);
router.get(
  '/:projectId/cells/:cellId/type-checklist/download',
  adminOnly,
  projectTypeChecklistController.downloadCellChecklist,
);

router.get('/:projectId/workspace', adminOnly, projectWorkspaceController.getWorkspaceSummary);
router.get('/:projectId/checklist', adminOnly, checklistController.getProjectChecklist);
router.get('/:projectId/checklist/cells', adminOnly, checklistController.getProjectCellsChecklist);
router.get('/:projectId/checklist/export', adminOnly, checklistController.exportProjectCellChecklist);
router.post('/:projectId/checklist/import', adminOnly, checklistController.importProjectCellChecklist);
router.post('/:projectId/checklist/apply-all', adminOnly, checklistController.applyToAll);
router.get('/:projectId/cells/:cellId/checklist', adminOnly, checklistController.getCellChecklist);
router.patch('/:projectId/cells/:cellId/checklist/:mappingId', adminOnly, checklistController.updateCellChecklistItem);
router.get('/:projectId/dependency-graph', adminOnly, projectWorkspaceController.getDependencyGraph);
router.get('/:projectId/libraries', adminOnly, projectWorkspaceController.listLibraries);
router.post('/:projectId/libraries', adminOnly, projectWorkspaceController.createLibrary);
router.put('/:projectId/libraries/:libraryId', adminOnly, projectWorkspaceController.updateLibrary);
router.delete('/:projectId/libraries/:libraryId', adminOnly, projectWorkspaceController.deleteLibrary);
router.get('/:projectId/libraries/:libraryId/cells', adminOnly, projectWorkspaceController.listCells);
router.post('/:projectId/libraries/:libraryId/cells', adminOnly, projectWorkspaceController.createCell);
router.put('/:projectId/cells/:cellId', adminOnly, projectWorkspaceController.updateCell);
router.delete('/:projectId/cells/:cellId', adminOnly, projectWorkspaceController.deleteCell);
router.patch('/:projectId/cells/:cellId/status', adminOnly, projectWorkspaceController.updateCellStatus);
router.patch('/:projectId/cells/:cellId/workflow/:stageKey', adminOnly, projectWorkspaceController.updateWorkflowStage);
router.patch('/:projectId/cells/:cellId/touch', adminOnly, projectWorkspaceController.touchCell);
router.get('/:projectId/cells/:cellId/completion-readiness', adminOnly, projectWorkspaceController.getCellCompletionReadiness);
router.patch('/:projectId/cells/:cellId/complete', adminOnly, projectWorkspaceController.completeCell);
router.patch('/:projectId/cells/:cellId/uncomplete', adminOnly, projectWorkspaceController.uncompleteCell);
router.get('/:projectId/cells/:cellId/reviews', adminOnly, projectWorkspaceController.listCellReviews);
router.post('/:projectId/cells/:cellId/reviews', adminOnly, projectWorkspaceController.createCellReview);
router.post('/:projectId/cells/:cellId/reviews/:reviewId/messages', adminOnly, projectWorkspaceController.addReviewMessage);
router.patch('/:projectId/cells/:cellId/reviews/:reviewId/resolve', adminOnly, projectWorkspaceController.resolveCellReview);

router.get('/:id/assigned-tasks', adminOnly, projectController.getProjectAssignedTasks);
router.get('/:id/audit-trail', adminOnly, projectController.getAuditTrail);
router.get('/:id', adminOnly, projectController.getById);
router.post('/', adminOnly, projectController.create);
router.put('/:id', adminOnly, projectController.update);
router.delete('/:id', adminOnly, projectController.delete);
router.patch('/:id/sync-status', adminOnly, projectController.syncStatus);
router.patch('/:id/complete', adminOnly, projectController.markCompleted);
router.patch('/:id/task-approve', adminOnly, projectController.taskApprove);
router.patch('/:id/task-complete', adminOnly, projectController.taskComplete);
router.patch('/:id/assigned-tasks/:taskId/complete', adminOnly, projectController.assignedTaskComplete);

export const projectRoutes = router;
