import { Router } from 'express';
import multer from 'multer';
import { ticketController } from '../controllers/ticketController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.'));
  },
});

router.use(authMiddleware);

router.get('/', ticketController.getAll);
router.get('/project/:projectId', requireRole('Admin'), ticketController.getByProjectId);
router.get('/:id/attachment', ticketController.getAttachment);
router.get('/:id', ticketController.getById);
router.post('/', ticketController.create);
router.post('/:id/attachment', upload.single('attachment'), ticketController.uploadAttachment);
router.post('/:id/comments', requireRole('Admin'), ticketController.addComment);
router.patch('/:id/status', requireRole('Admin'), ticketController.updateStatus);
router.delete('/:id', requireRole('Admin'), ticketController.delete);

export const ticketRoutes = router;