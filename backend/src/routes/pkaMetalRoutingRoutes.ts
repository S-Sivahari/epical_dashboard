import { Router } from 'express';
import { pkaMetalRoutingController } from '../controllers/pkaMetalRoutingController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

router.use(authMiddleware);

router.get('/context', pkaMetalRoutingController.getContext);
router.get('/route', pkaMetalRoutingController.lookupRoute);
router.post('/route/resolve', pkaMetalRoutingController.resolveRoute);
router.post('/route/metals/preview', pkaMetalRoutingController.previewMetal);
router.post('/route/metals', pkaMetalRoutingController.addMetal);
router.delete('/route/metals/:metalId', pkaMetalRoutingController.removeMetal);

router.get('/pka-modules', pkaMetalRoutingController.listPkaModules);
router.get('/pka-modules/:id', pkaMetalRoutingController.getPkaModule);

router.get('/routes', pkaMetalRoutingController.listRoutes);
router.get('/routes/:id', pkaMetalRoutingController.getRoute);
router.get('/routes/:id/export', pkaMetalRoutingController.exportRoute);

router.post('/pka-modules', adminOnly, pkaMetalRoutingController.createPkaModule);
router.put('/pka-modules/:id', adminOnly, pkaMetalRoutingController.updatePkaModule);
router.delete('/pka-modules/:id', adminOnly, pkaMetalRoutingController.deletePkaModule);
router.delete('/routes/:id', adminOnly, pkaMetalRoutingController.deleteRoute);

export const pkaMetalRoutingRoutes = router;
