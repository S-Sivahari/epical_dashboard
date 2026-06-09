import { Router } from 'express';
import { pdkMetalRoutingController } from '../controllers/pdkMetalRoutingController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

router.use(authMiddleware);

router.get('/dashboard/projects', pdkMetalRoutingController.listDashboardProjects);
router.patch('/projects/:projectId/pdk', adminOnly, pdkMetalRoutingController.assignPdkToProject);
router.get('/projects/:projectId/context', pdkMetalRoutingController.getProjectContext);

router.get('/route', pdkMetalRoutingController.lookupRoute);
router.post('/route/resolve', pdkMetalRoutingController.resolveRoute);
router.post('/route/metals/preview', pdkMetalRoutingController.previewMetal);
router.post('/route/metals', pdkMetalRoutingController.addMetal);
router.delete('/route/metals/:metalId', pdkMetalRoutingController.removeMetal);
router.get('/routes/:id/export', pdkMetalRoutingController.exportRoute);

router.get('/pdk-modules', pdkMetalRoutingController.listPdkModules);
router.get('/pdk-modules/:id', pdkMetalRoutingController.getPdkModule);
router.post('/pdk-modules', adminOnly, pdkMetalRoutingController.createPdkModule);
router.put('/pdk-modules/:id', adminOnly, pdkMetalRoutingController.updatePdkModule);
router.delete('/pdk-modules/:id', adminOnly, pdkMetalRoutingController.deletePdkModule);

export const pdkMetalRoutingRoutes = router;
