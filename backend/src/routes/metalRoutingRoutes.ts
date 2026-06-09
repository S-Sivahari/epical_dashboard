import { Router } from 'express';
import { metalRoutingController } from '../controllers/metalRoutingController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole('Admin'));

// ──────────────────────────────────────────────────────────────
// PDK MODULE ROUTES (Admin only)
// ──────────────────────────────────────────────────────────────
router.get('/pdk-modules', metalRoutingController.listPDKModules);
router.get('/pdk-modules/:id', metalRoutingController.getPDKModule);
router.post('/pdk-modules', metalRoutingController.createPDKModule);
router.put('/pdk-modules/:id', metalRoutingController.updatePDKModule);
router.delete('/pdk-modules/:id', metalRoutingController.deletePDKModule);

// ──────────────────────────────────────────────────────────────
// PROJECT PDK ASSIGNMENT ROUTES (Admin only)
// ──────────────────────────────────────────────────────────────
router.post('/projects/:projectId/assign-pdk', metalRoutingController.assignPDKToProject);
router.get('/projects/:projectId/pdk-assignment', metalRoutingController.getProjectPDKAssignment);
router.delete('/projects/:projectId/pdk-assignment', metalRoutingController.removeProjectPDKAssignment);

// ──────────────────────────────────────────────────────────────
// ROUTING ANALYSIS ROUTES
// ──────────────────────────────────────────────────────────────
router.get('/projects/:projectId/routing', metalRoutingController.getProjectRoutingData);

// ──────────────────────────────────────────────────────────────
// ENHANCED PROJECTS LIST
// ──────────────────────────────────────────────────────────────
router.get('/projects-with-pdk', metalRoutingController.getProjectsWithPDK);

export default router;
