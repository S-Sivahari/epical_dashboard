import { Router } from 'express'
import multer from 'multer'
import { newsController } from '../controllers/newsController'

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

newsRoutes.get('/news', newsController.list)
newsRoutes.get('/news/:id/image', newsController.getImage)
newsRoutes.post('/news', imageUpload.single('image'), newsController.create)
newsRoutes.put('/news/:id', imageUpload.single('image'), newsController.update)
newsRoutes.delete('/news/:id', newsController.remove)
