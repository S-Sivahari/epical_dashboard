import { Router } from 'express'
import { portalGuideController } from '../controllers/portalGuideController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'

export const portalGuideRoutes = Router()

portalGuideRoutes.use(authMiddleware)

portalGuideRoutes.get('/admin', requireRole('Admin'), portalGuideController.getAdminGuide)
portalGuideRoutes.get('/employee', requireRole('Employee'), portalGuideController.getEmployeeGuide)
portalGuideRoutes.get('/me', portalGuideController.getGuideForRole)
