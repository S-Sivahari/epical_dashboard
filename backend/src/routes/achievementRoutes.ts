import path from 'path'
import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { achievementController } from '../controllers/achievementController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'

export const achievementRoutes = Router()

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
])

const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function isAllowedAchievementImage(file: Express.Multer.File): boolean {
  const mime = (file.mimetype || '').toLowerCase()
  if (ALLOWED_IMAGE_MIMES.has(mime)) return true
  const ext = path.extname(file.originalname || '').toLowerCase()
  return ALLOWED_IMAGE_EXT.has(ext)
}

const achievementImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAchievementImage(file)) {
      cb(null, true)
      return
    }
    cb(new Error('Only JPEG, PNG, or WebP images are allowed (max 4 MB)'))
  },
})
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
