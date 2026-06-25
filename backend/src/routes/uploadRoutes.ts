import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/uploadController';
import { authMiddleware } from '../middleware/authMiddleware';
import { createImageUpload, imageUploadFileFilter } from '../utils/imageUploadFilter';

const router = Router();

// Configure multer to store files in memory as buffers
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
      return
    }
    imageUploadFileFilter(req, file, cb)
  },
});

const photoUpload = createImageUpload({ maxFileSize: 2 * 1024 * 1024 });

router.use(authMiddleware);

// Fetch profile photo or document (admin or owning employee only)
router.get('/employees/:id/photo', uploadController.getPhoto);
router.get('/employees/:id/documents/:docType', uploadController.getDocument);

// Upload multiple documents for an employee
router.post(
  '/employees/:id/documents',
  upload.fields([
    { name: 'aadhaarPan', maxCount: 1 },
    { name: 'aadhaar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'offerLetter', maxCount: 1 },
    { name: 'certificates', maxCount: 1 },
    { name: 'certificate10th', maxCount: 1 },
    { name: 'certificate12th', maxCount: 1 },
    { name: 'certificateDiploma', maxCount: 1 },
    { name: 'certificateDegree', maxCount: 1 },
    { name: 'agreement', maxCount: 1 },
  ]),
  uploadController.uploadDocuments
);

// Upload profile photo for an employee
router.post('/employees/:id/photo', photoUpload.single('photo'), uploadController.uploadPhoto);

// List uploaded documents for an employee
router.get('/employees/:id/documents', uploadController.listDocuments);

// Delete a specific document
router.delete('/employees/:id/documents/:docType', uploadController.deleteDocument);

export const uploadRoutes = router;
