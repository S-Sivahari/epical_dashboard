import { Router } from 'express'
import multer from 'multer'
import { newsController } from '../controllers/newsController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'

export const newsRoutes = Router()

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp'
    cb(null, ok)
  },
})

newsRoutes.get('/news', authMiddleware, newsController.list)
newsRoutes.get('/news/external', authMiddleware, requireRole('Admin'), newsController.fetchExternal)
newsRoutes.post('/news/import', authMiddleware, requireRole('Admin'), newsController.importExternal)
newsRoutes.get('/news/:id/image', authMiddleware, newsController.getImage)
newsRoutes.post(
  '/news',
  authMiddleware,
  requireRole('Admin'),
  imageUpload.single('image'),
  newsController.create
)
newsRoutes.put(
  '/news/:id',
  authMiddleware,
  requireRole('Admin'),
  imageUpload.single('image'),
  newsController.update
)
newsRoutes.delete('/news/:id', authMiddleware, requireRole('Admin'), newsController.remove)
