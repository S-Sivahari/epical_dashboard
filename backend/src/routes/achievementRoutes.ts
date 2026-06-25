import { Router, Request, Response, NextFunction } from 'express'
import { achievementController } from '../controllers/achievementController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'
import { createImageUpload } from '../utils/imageUploadFilter'

export const achievementRoutes = Router()

const achievementImageUpload = createImageUpload({ maxFileSize: 4 * 1024 * 1024 })

function uploadAchievementImage(req: Request, res: Response, next: NextFunction): void {
  achievementImageUpload.single('image')(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : 'Image upload failed'
      res.status(400).json({ error: msg })
      return
    }
    next()
  })
}

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
  uploadAchievementImage,
  achievementController.create
)
achievementRoutes.put(
  '/company-achievements/:id',
  ...adminMutate,
  uploadAchievementImage,
  achievementController.update
)
achievementRoutes.delete('/company-achievements/:id', ...adminMutate, achievementController.remove)
