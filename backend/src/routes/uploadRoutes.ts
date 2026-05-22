import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/uploadController';

const router = Router();

// Configure multer to store files in memory as buffers
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.'));
    }
  },
});

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
router.post('/employees/:id/photo', upload.single('photo'), uploadController.uploadPhoto);

// List uploaded documents for an employee
router.get('/employees/:id/documents', uploadController.listDocuments);

// Get a specific document
router.get('/employees/:id/documents/:docType', uploadController.getDocument);

// Delete a specific document
router.delete('/employees/:id/documents/:docType', uploadController.deleteDocument);

// Get profile photo
router.get('/employees/:id/photo', uploadController.getPhoto);

export const uploadRoutes = router;
