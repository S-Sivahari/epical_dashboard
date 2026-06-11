import { Router } from 'express';
import multer from 'multer';
import { pmController } from '../controllers/pmController';
import { pmHierarchicalController } from '../controllers/pmHierarchicalController';
import { authMiddleware, requireRole } from '../../../middleware/authMiddleware';
import { pmSessionMiddleware } from '../middleware/pmSessionMiddleware';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

const adminOnly = requireRole('Admin');
const adminOrEmployee = requireRole('Admin', 'Employee');

router.use(authMiddleware);

// ──────────────────────────────────────────────────────────────
// SHARED / DASHBOARD
// ──────────────────────────────────────────────────────────────
router.get('/dashboard/metrics', adminOnly, pmController.getDashboardStats);
router.get('/audit-logs', adminOnly, pmController.getAuditLogs);

// ──────────────────────────────────────────────────────────────
// HIERARCHICAL NAVIGATION (NEW - CRITICAL)
// ──────────────────────────────────────────────────────────────
router.get('/projects/:projectId/details', adminOrEmployee, pmHierarchicalController.getProjectDetails);
router.get('/projects/:projectId/libraries', adminOrEmployee, pmHierarchicalController.getProjectLibraries);
router.get('/projects/:projectId/cells', adminOrEmployee, pmHierarchicalController.getProjectCells);

router.get('/libraries/:libraryId/details', adminOrEmployee, pmHierarchicalController.getLibraryDetails);
router.get('/libraries/:libraryId/cells', adminOrEmployee, pmHierarchicalController.getLibraryCells);

router.get('/cells/:cellId/details', adminOrEmployee, pmSessionMiddleware, pmHierarchicalController.getCellDetails);

// ──────────────────────────────────────────────────────────────
// LIBRARIES (Admin can write, Employee can read)
// ──────────────────────────────────────────────────────────────
router.get('/libraries', adminOrEmployee, pmSessionMiddleware, pmController.getLibraries);
router.post('/libraries', adminOnly, pmController.createLibrary);
router.put('/libraries/:id', adminOnly, pmController.updateLibrary);
router.post('/libraries/:id/archive', adminOnly, pmController.archiveLibrary);
router.post('/libraries/:id/restore', adminOnly, pmController.restoreLibrary);

// ──────────────────────────────────────────────────────────────
// CELLS
// ──────────────────────────────────────────────────────────────
router.get('/cells', adminOrEmployee, pmSessionMiddleware, pmController.getCells);
router.post('/cells', adminOrEmployee, pmSessionMiddleware, pmController.createCell);
router.put('/cells/:id', adminOrEmployee, pmSessionMiddleware, pmController.updateCell);
router.post('/cells/:id/archive', adminOrEmployee, pmSessionMiddleware, pmController.archiveCell);
router.post('/cells/:id/restore', adminOnly, pmController.restoreCell);

// ──────────────────────────────────────────────────────────────
// VIEWS (Shared updates, stage progression, reviews)
// ──────────────────────────────────────────────────────────────
router.get('/views/:id', adminOrEmployee, pmSessionMiddleware, pmController.getViewDetails);
router.get('/workspace/views', adminOrEmployee, pmSessionMiddleware, pmController.getWorkspaceViews);
router.post('/views/:id/stage', adminOrEmployee, pmSessionMiddleware, pmController.updateViewStage);
router.post('/views/:id/submit', adminOrEmployee, pmSessionMiddleware, pmController.submitView);
router.post('/views/:id/override', adminOnly, pmController.overrideViewWorkflow);

// ──────────────────────────────────────────────────────────────
// ASSIGNMENTS (Admin only)
// ──────────────────────────────────────────────────────────────
router.get('/assignments', adminOnly, pmController.getAssignments);
router.post('/assignments', adminOnly, pmController.assignEmployee);
router.post('/assignments/:id/archive', adminOnly, pmController.archiveAssignment);
router.post('/assignments/:id/restore', adminOnly, pmController.restoreAssignment);

// ──────────────────────────────────────────────────────────────
// REVIEWS QUEUES
// ──────────────────────────────────────────────────────────────
router.get('/reviews/admin', adminOnly, pmController.getAdminReviews);
router.get('/workspace/reviews', adminOrEmployee, pmSessionMiddleware, pmController.getEmployeeReviews);
router.post('/reviews/:id/action', adminOnly, pmController.actionReview);

// ──────────────────────────────────────────────────────────────
// CHECKLISTS
// ──────────────────────────────────────────────────────────────
router.post('/checklists/upload', adminOnly, upload.single('file'), pmController.uploadChecklistTemplate);
router.get('/checklists/templates', adminOrEmployee, pmSessionMiddleware, pmController.getTemplates);
router.get('/checklists/templates/compare', adminOrEmployee, pmSessionMiddleware, pmController.compareTemplateVersions);
router.get('/checklists/templates/:versionId', adminOrEmployee, pmSessionMiddleware, pmController.getTemplateItems);
router.post('/checklists/migrate-cell', adminOnly, pmController.migrateCellChecklist);

router.get('/checklists/cell/:cellId', adminOrEmployee, pmSessionMiddleware, pmController.getCellChecklistInstance);
router.put('/checklists/cell/:cellId/autosave', adminOrEmployee, pmSessionMiddleware, pmController.autosaveChecklist);
router.post('/checklists/cell/:cellId/custom', adminOrEmployee, pmSessionMiddleware, pmController.addCustomChecklistItem);
router.get('/checklists/view/:viewId', adminOrEmployee, pmSessionMiddleware, pmController.getViewChecklistResponse);
router.put('/checklists/view/:viewId/autosave', adminOrEmployee, pmSessionMiddleware, pmController.autosaveViewChecklist);

// ──────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ──────────────────────────────────────────────────────────────
router.get('/notifications', adminOrEmployee, pmSessionMiddleware, pmController.getNotifications);
router.put('/notifications/:id/read', adminOrEmployee, pmSessionMiddleware, pmController.markNotificationRead);

// ──────────────────────────────────────────────────────────────
// EMPLOYEE WORKSPACE SPECIFIC ADDITIONS
// ──────────────────────────────────────────────────────────────
router.get('/workspace/my-cells', adminOrEmployee, pmSessionMiddleware, pmController.getWorkspaceViews);
router.post('/workspace/auto-pause', adminOrEmployee, pmSessionMiddleware, pmController.autoPauseWorkspace);
router.get('/workspace/audit-logs', adminOrEmployee, pmSessionMiddleware, pmController.getEmployeeAuditLogs);
router.get('/workspace/dashboard-metrics', adminOrEmployee, pmSessionMiddleware, pmController.getEmployeeDashboardMetrics);

export const projectManagementRoutes = router;
