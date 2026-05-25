import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { documentRequestController } from '../controllers/documentRequestController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF and images are allowed.'));
  },
});

/** Pass multer rejection (wrong type / size) as JSON instead of hanging on default error handling. */
function uploadSinglePdfOrImage(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single(field)(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  };
}

router.use(authMiddleware);

router.post('/', requireRole('Employee'), documentRequestController.createMine);
router.get('/me', requireRole('Employee'), documentRequestController.listMine);

router.get('/', requireRole('Admin'), documentRequestController.listAdmin);
router.patch(
  '/:id/fulfillment',
  requireRole('Admin'),
  uploadSinglePdfOrImage('file'),
  documentRequestController.uploadFulfillment
);
router.patch('/:id/approve', requireRole('Admin'), documentRequestController.approve);
router.patch('/:id/reject', requireRole('Admin'), documentRequestController.reject);
router.get('/:id/download', documentRequestController.download);

export const documentRequestRoutes = router;
