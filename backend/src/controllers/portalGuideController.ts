import { Response } from 'express'
import { AuthRequest } from '../middleware/authMiddleware'
import { isAdminRole, isEmployeeRole } from '../utils/generateToken'
import {
  adminPortalGuideSections,
  employeePortalGuideSections,
} from '../data/portalGuides'

export const portalGuideController = {
  getAdminGuide: (_req: AuthRequest, res: Response): void => {
    res.json({ sections: adminPortalGuideSections })
  },

  getEmployeeGuide: (_req: AuthRequest, res: Response): void => {
    res.json({ sections: employeePortalGuideSections })
  },

  getGuideForRole: (req: AuthRequest, res: Response): void => {
    const role = req.user?.role ?? ''
    if (isAdminRole(role)) {
      res.json({ sections: adminPortalGuideSections })
      return
    }
    if (isEmployeeRole(role)) {
      res.json({ sections: employeePortalGuideSections })
      return
    }
    res.status(403).json({ error: 'Forbidden' })
  },
}
