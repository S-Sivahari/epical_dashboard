import { Router } from 'express'
import multer from 'multer'
import { achievementController } from '../controllers/achievementController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'

export const achievementRoutes = Router()

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp'
    if (ok) {
      cb(null, true)
      return
    }
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'))
  },
})

const authenticated = [authMiddleware]
const adminMutate = [authMiddleware, requireRole('Admin')]

// Readable by any logged-in user (admin or employee)
achievementRoutes.get('/company-achievements/page', ...authenticated, achievementController.getPageMeta)
achievementRoutes.get(
  '/company-achievements/page/cover-image',
  ...authenticated,
  achievementController.getCoverImage
)
achievementRoutes.get('/company-achievements', ...authenticated, achievementController.list)
achievementRoutes.get(
  '/company-achievements/:id/image',
  ...authenticated,
  achievementController.getAchievementImage
)

// Admin only
achievementRoutes.put(
  '/company-achievements/page',
  ...adminMutate,
  imageUpload.single('cover'),
  achievementController.updatePage
)
achievementRoutes.post(
  '/company-achievements',
  ...adminMutate,
  imageUpload.single('image'),
  achievementController.create
)
achievementRoutes.put(
  '/company-achievements/:id',
  ...adminMutate,
  imageUpload.single('image'),
  achievementController.update
)
achievementRoutes.delete('/company-achievements/:id', ...adminMutate, achievementController.remove)
