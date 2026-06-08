import { Router } from 'express';
import { projectController } from '../controllers/projectController';
import { projectWorkspaceController } from '../controllers/projectWorkspaceController';
import { checklistController } from '../controllers/checklistController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

router.use(authMiddleware);

router.get('/assigned/me', projectController.getAssignedForCurrentUser);

router.get('/checklist-report', adminOnly, checklistController.exportReport);

router.get('/', adminOnly, projectController.getAll);
router.get('/archived', adminOnly, projectController.getArchivedProjects);
router.get('/archived/:id', adminOnly, projectController.getArchivedProjectById);
router.delete('/archived/:id', adminOnly, projectController.deleteArchivedProject);
router.post('/archived/:id/restore', adminOnly, projectController.restoreProject);
router.post('/:id/archive', adminOnly, projectController.archiveProject);
router.get('/:projectId/workspace', adminOnly, projectWorkspaceController.getWorkspaceSummary);
router.get('/:projectId/checklist', adminOnly, checklistController.getProjectChecklist);
router.post('/:projectId/checklist/apply-all', adminOnly, checklistController.applyToAll);
router.get('/:projectId/cells/:cellId/checklist', adminOnly, checklistController.getCellChecklist);
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
router.patch('/:projectId/cells/:cellId/complete', adminOnly, projectWorkspaceController.completeCell);
router.get('/:projectId/cells/:cellId/reviews', adminOnly, projectWorkspaceController.listCellReviews);
router.post('/:projectId/cells/:cellId/reviews', adminOnly, projectWorkspaceController.createCellReview);
router.post('/:projectId/cells/:cellId/reviews/:reviewId/messages', adminOnly, projectWorkspaceController.addReviewMessage);

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
