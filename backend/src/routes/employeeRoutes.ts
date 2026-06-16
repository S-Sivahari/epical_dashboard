import { Router } from 'express';
import multer from 'multer';
import { employeeController } from '../controllers/employeeController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authMiddleware);

router.get('/me', employeeController.getMyEmployee);

router.get('/', adminOnly, employeeController.getAllEmployees);
router.get('/search', adminOnly, employeeController.searchEmployees);
router.get('/check-id', adminOnly, employeeController.checkEmployeeId);
router.get('/daily-activity', adminOnly, employeeController.getDailyActivityLog);
router.get('/import/template', adminOnly, employeeController.downloadImportTemplate);
router.post('/import/parse', adminOnly, upload.single('file'), employeeController.parseImportUpload);
router.post('/import/bulk', adminOnly, employeeController.bulkCreateEmployees);
router.patch('/bulk-status', adminOnly, employeeController.bulkUpdateStatus);

router.get('/:id', employeeController.getEmployeeById);

router.post('/', adminOnly, employeeController.createEmployee);
router.put('/:id', adminOnly, employeeController.updateEmployee);
router.patch('/:id/status', adminOnly, employeeController.updateStatus);
router.delete('/:id', adminOnly, employeeController.deleteEmployee);

export const employeeRoutes = router;
