import { Router } from 'express';
import multer from 'multer';
import { projectMgmtController } from '../controllers/projectMgmtController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

// Project routes
router.get('/projects', adminOnly, projectMgmtController.getAllProjects);
router.post('/projects', adminOnly, projectMgmtController.createProject);
router.get('/projects/:projectId/overview', adminOnly, projectMgmtController.getProjectOverview);

// Library routes
router.get('/projects/:projectId/libraries', adminOnly, projectMgmtController.getLibraries);
router.post('/projects/:projectId/libraries', adminOnly, projectMgmtController.createLibrary);

// Cell routes
router.get('/libraries/:libraryId/cells', adminOnly, projectMgmtController.getCells);
router.post('/libraries/:libraryId/cells', adminOnly, projectMgmtController.createCell);
router.get('/cells/for-review', adminOnly, projectMgmtController.getCellsForReview);
router.get('/cells/for-review/count', adminOnly, projectMgmtController.getReviewCount);
router.get('/cells/my-cells', projectMgmtController.getMyAssignedCells);
router.get('/cells/:cellId', projectMgmtController.getCellDetail);
router.put('/cells/:cellId', adminOnly, projectMgmtController.updateCell);
router.put('/cells/:cellId/checklist-items', adminOnly, projectMgmtController.setCellChecklistItems);
router.patch('/cells/:cellId/checklist-items/:itemId', adminOnly, projectMgmtController.toggleCellChecklistItem);
router.post('/cells/:cellId/views/:viewType', upload.single('file'), projectMgmtController.uploadCellView);
router.get('/cells/:cellId/views/:viewType', projectMgmtController.downloadCellView);

// Stage workflow
router.patch('/cells/:cellId/advance', projectMgmtController.advanceCellStage);
router.patch('/cells/:cellId/submit-review', projectMgmtController.submitForReview);
router.patch('/cells/:cellId/review', adminOnly, projectMgmtController.reviewCell);

// Feedback
router.post('/cells/:cellId/feedback', projectMgmtController.addFeedback);
router.get('/cells/:cellId/feedbacks', projectMgmtController.getFeedbacks);

// Checklist
router.post('/checklist/upload', adminOnly, upload.single('file'), projectMgmtController.uploadChecklist);
router.get('/checklist', adminOnly, projectMgmtController.getChecklists);
router.get('/checklist/:cellType/items', projectMgmtController.getTypeChecklistItems);
router.put('/checklist/:cellType/items', adminOnly, projectMgmtController.setTypeChecklistItems);
router.get('/checklist/:cellType', projectMgmtController.downloadChecklist);

export const projectMgmtRoutes = router;
