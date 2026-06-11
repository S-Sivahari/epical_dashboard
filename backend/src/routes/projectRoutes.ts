import { Router } from 'express';
import multer from 'multer';
import { projectController } from '../controllers/projectController';
import { projectWorkspaceController } from '../controllers/projectWorkspaceController';
import { projectTypeChecklistController } from '../controllers/projectTypeChecklistController';
import { employeeProjectController } from '../controllers/employeeProjectController';
import { checklistController } from '../controllers/checklistController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';
import { requireProjectAccess } from '../middleware/projectAccessMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');
const projectMember = requireRole('Admin', 'Employee');
const projectScoped = [projectMember, requireProjectAccess] as const;
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
router.patch(
  '/:projectId/cells/:cellId/mine/checklist-extension',
  employeeProjectController.updateMyCellChecklistExtension,
);

router.get('/', adminOnly, projectController.getAll);
router.get('/archived', adminOnly, projectController.getArchivedProjects);
router.get('/archived/:id', adminOnly, projectController.getArchivedProjectById);
router.delete('/archived/:id', adminOnly, projectController.deleteArchivedProject);
router.post('/archived/:id/restore', adminOnly, projectController.restoreProject);
router.post('/:id/archive', adminOnly, projectController.archiveProject);
router.get('/:projectId/type-checklists/template', ...projectScoped, projectTypeChecklistController.downloadTemplate);
router.get('/:projectId/type-checklists', ...projectScoped, projectTypeChecklistController.list);
router.get('/:projectId/type-checklists/:cellType/download', ...projectScoped, projectTypeChecklistController.download);
router.post(
  '/:projectId/type-checklists/:cellType',
  ...projectScoped,
  checklistUpload.single('file'),
  projectTypeChecklistController.upload,
);
router.delete('/:projectId/type-checklists/:cellType', ...projectScoped, projectTypeChecklistController.remove);
router.get('/:projectId/cells/:cellId/type-checklist', ...projectScoped, projectTypeChecklistController.getForCell);
router.get(
  '/:projectId/cells/:cellId/type-checklist/responses',
  ...projectScoped,
  projectTypeChecklistController.getCellResponses,
);
router.patch(
  '/:projectId/cells/:cellId/type-checklist/responses/:itemIndex',
  ...projectScoped,
  projectTypeChecklistController.updateCellResponse,
);
router.post(
  '/:projectId/cells/:cellId/type-checklist/custom-items',
  ...projectScoped,
  projectTypeChecklistController.addCustomItem,
);
router.delete(
  '/:projectId/cells/:cellId/type-checklist/items/:itemKey',
  ...projectScoped,
  projectTypeChecklistController.deleteItem,
);
router.patch(
  '/:projectId/cells/:cellId/type-checklist/custom-items/:customItemId',
  ...projectScoped,
  projectTypeChecklistController.updateCustomItemResponse,
);
router.patch(
  '/:projectId/cells/:cellId/type-checklist/extension',
  ...projectScoped,
  projectTypeChecklistController.updateExtension,
);
router.get(
  '/:projectId/cells/:cellId/type-checklist/download',
  ...projectScoped,
  projectTypeChecklistController.downloadCellChecklist,
);

router.get('/:projectId/workspace', ...projectScoped, projectWorkspaceController.getWorkspaceSummary);
router.get('/:projectId/checklist', ...projectScoped, checklistController.getProjectChecklist);
router.get('/:projectId/checklist/cells', ...projectScoped, checklistController.getProjectCellsChecklist);
router.get('/:projectId/checklist/export', ...projectScoped, checklistController.exportProjectCellChecklist);
router.post('/:projectId/checklist/import', ...projectScoped, checklistController.importProjectCellChecklist);
router.post('/:projectId/checklist/apply-all', ...projectScoped, checklistController.applyToAll);
router.get('/:projectId/cells/:cellId/checklist', ...projectScoped, checklistController.getCellChecklist);
router.patch('/:projectId/cells/:cellId/checklist/:mappingId', ...projectScoped, checklistController.updateCellChecklistItem);
router.get('/:projectId/dependency-graph', ...projectScoped, projectWorkspaceController.getDependencyGraph);
router.get('/:projectId/libraries', ...projectScoped, projectWorkspaceController.listLibraries);
router.post('/:projectId/libraries', ...projectScoped, projectWorkspaceController.createLibrary);
router.put('/:projectId/libraries/:libraryId', ...projectScoped, projectWorkspaceController.updateLibrary);
router.delete('/:projectId/libraries/:libraryId', ...projectScoped, projectWorkspaceController.deleteLibrary);
router.get('/:projectId/libraries/:libraryId/cells', ...projectScoped, projectWorkspaceController.listCells);
router.post('/:projectId/libraries/:libraryId/cells', ...projectScoped, projectWorkspaceController.createCell);
router.put('/:projectId/cells/:cellId', ...projectScoped, projectWorkspaceController.updateCell);
router.delete('/:projectId/cells/:cellId', ...projectScoped, projectWorkspaceController.deleteCell);
router.patch('/:projectId/cells/:cellId/status', ...projectScoped, projectWorkspaceController.updateCellStatus);
router.patch('/:projectId/cells/:cellId/workflow/:stageKey', ...projectScoped, projectWorkspaceController.updateWorkflowStage);
router.patch('/:projectId/cells/:cellId/touch', ...projectScoped, projectWorkspaceController.touchCell);
router.get('/:projectId/cells/:cellId/completion-readiness', ...projectScoped, projectWorkspaceController.getCellCompletionReadiness);
router.patch('/:projectId/cells/:cellId/complete', ...projectScoped, projectWorkspaceController.completeCell);
router.patch('/:projectId/cells/:cellId/uncomplete', ...projectScoped, projectWorkspaceController.uncompleteCell);
router.get('/:projectId/cells/:cellId/reviews', ...projectScoped, projectWorkspaceController.listCellReviews);
router.post('/:projectId/cells/:cellId/reviews', ...projectScoped, projectWorkspaceController.createCellReview);
router.post('/:projectId/cells/:cellId/reviews/:reviewId/messages', ...projectScoped, projectWorkspaceController.addReviewMessage);
router.patch('/:projectId/cells/:cellId/reviews/:reviewId/resolve', ...projectScoped, projectWorkspaceController.resolveCellReview);

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
