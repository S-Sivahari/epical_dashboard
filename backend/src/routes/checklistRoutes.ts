import { Router } from 'express';
import multer from 'multer';
import { checklistController } from '../controllers/checklistController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(adminOnly);

router.get('/', checklistController.list);
router.get('/cell-types', checklistController.listCellTypeDefinitions);
router.get('/cell-types/:cellType', checklistController.getCellTypeDefinition);
router.get('/export-report', checklistController.exportReport);
router.get('/export-template', checklistController.exportTemplate);
router.post('/', checklistController.create);
router.post('/import', checklistController.importReport);
router.post('/import-file', upload.single('file'), checklistController.parseUpload);
router.post('/import-template', checklistController.importTemplate);
router.post('/import-template-file', upload.single('file'), checklistController.parseTemplateUpload);
router.post('/assign', checklistController.assignToProject);
router.get('/:id', checklistController.getById);
router.put('/:id', checklistController.update);
router.delete('/:id', checklistController.delete);

export const checklistRoutes = router;
