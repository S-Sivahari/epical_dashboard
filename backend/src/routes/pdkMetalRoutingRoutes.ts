import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { pdkMetalRoutingController } from '../controllers/pdkMetalRoutingController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

const pdkExcelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    const ext = file.originalname.toLowerCase();
    if (allowed.includes(file.mimetype) || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) files are allowed.'));
    }
  },
});

function uploadPdkExcel(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    pdkExcelUpload.single(field)(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Excel upload failed';
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  };
}

router.use(authMiddleware);

router.get('/dashboard/projects', pdkMetalRoutingController.listDashboardProjects);
router.get('/dashboard/metrics', pdkMetalRoutingController.getDashboardMetrics);
router.patch('/projects/:projectId/pdk', pdkMetalRoutingController.assignPdkToProject);
router.get('/projects/:projectId/context', pdkMetalRoutingController.getProjectContext);
router.get('/projects/:projectId/routes/export', pdkMetalRoutingController.exportProjectRoutes);
router.get(
  '/projects/:projectId/routes/template/download',
  pdkMetalRoutingController.downloadProjectMetalRoutingTemplate,
);
router.post(
  '/projects/:projectId/routes/import',
  uploadPdkExcel('file'),
  pdkMetalRoutingController.importProjectRoutes,
);

router.get('/route', pdkMetalRoutingController.lookupRoute);
router.post('/route/resolve', pdkMetalRoutingController.resolveRoute);
router.post('/route/metals/preview', pdkMetalRoutingController.previewMetal);
router.post('/route/metals', pdkMetalRoutingController.addMetal);
router.put('/route/metals/:metalId', pdkMetalRoutingController.updateMetal);
router.delete('/route/metals/:metalId', pdkMetalRoutingController.removeMetal);
router.get('/routes/template/download', pdkMetalRoutingController.downloadMetalRoutingTemplate);
router.patch('/routes/:id', pdkMetalRoutingController.updateRoute);
router.get('/routes/:id/export', pdkMetalRoutingController.exportRoute);

router.get('/pdk-modules', pdkMetalRoutingController.listPdkModules);
router.get('/pdk-modules/template/download', pdkMetalRoutingController.downloadPdkTemplate);
router.post('/pdk-modules/import', uploadPdkExcel('file'), pdkMetalRoutingController.importPdkModule);
router.get('/pdk-modules/:id', pdkMetalRoutingController.getPdkModule);
router.post('/pdk-modules', pdkMetalRoutingController.createPdkModule);
router.put('/pdk-modules/:id', adminOnly, pdkMetalRoutingController.updatePdkModule);
router.delete('/pdk-modules/:id', adminOnly, pdkMetalRoutingController.deletePdkModule);

export const pdkMetalRoutingRoutes = router;
