import { Router } from 'express';
import multer from 'multer';
import { leaveController } from '../controllers/leaveController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authMiddleware);

// Public endpoints (authenticated users can view)
router.get('/', leaveController.getHolidays);

// Admin-only endpoints
router.get('/import/template', roleMiddleware('Admin'), leaveController.downloadHolidayImportTemplate);
router.post(
  '/import/upload',
  roleMiddleware('Admin'),
  upload.single('file'),
  leaveController.importHolidaysFromExcel,
);
router.post('/', roleMiddleware('Admin'), leaveController.createHoliday);
router.post('/bulk', roleMiddleware('Admin'), leaveController.createHolidaysBulk);
router.put('/:id', roleMiddleware('Admin'), leaveController.updateHoliday);
router.patch('/:id/skip', roleMiddleware('Admin'), leaveController.skipHoliday);
router.delete('/:id', roleMiddleware('Admin'), leaveController.deleteHoliday);

export const holidayRoutes = router;
