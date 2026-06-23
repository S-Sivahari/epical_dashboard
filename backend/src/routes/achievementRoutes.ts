import { Router } from 'express'
import multer from 'multer'
import { achievementController } from '../controllers/achievementController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'

export const achievementRoutes = Router()

const achievementImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg'
    if (ok) {
      cb(null, true)
      return
    }
    cb(new Error('Only JPEG/JPG images are allowed'))
  },
})

const authenticated = [authMiddleware]
const adminMutate = [authMiddleware, requireRole('Admin')]

achievementRoutes.get('/company-achievements/page', ...authenticated, achievementController.getPageMeta)
achievementRoutes.get('/company-achievements', ...authenticated, achievementController.list)
achievementRoutes.get(
  '/company-achievements/categories',
  ...authenticated,
  achievementController.listCategories
)
achievementRoutes.get(
  '/company-achievements/:id/image',
  ...authenticated,
  achievementController.getAchievementImage
)

achievementRoutes.put('/company-achievements/page', ...adminMutate, achievementController.updatePage)
achievementRoutes.post(
  '/company-achievements',
  ...adminMutate,
  achievementImageUpload.single('image'),
  achievementController.create
)
achievementRoutes.put(
  '/company-achievements/:id',
  ...adminMutate,
  achievementImageUpload.single('image'),
  achievementController.update
)
achievementRoutes.delete('/company-achievements/:id', ...adminMutate, achievementController.remove)
