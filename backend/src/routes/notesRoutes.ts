import { Router } from 'express';
import { notesController } from '../controllers/notesController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

router.use(authMiddleware);

router.get('/access', notesController.getAccess);

router.get('/delegations', adminOnly, notesController.listDelegations);
router.post('/delegations', adminOnly, notesController.createDelegation);
router.delete('/delegations/:id', adminOnly, notesController.removeDelegation);

router.get('/', notesController.listInRange);
router.get('/search', notesController.search);
router.get('/search/options', notesController.searchOptions);
router.get('/by-date/:date', notesController.getByDate);
router.get('/latest-before/:date', notesController.getLatestBefore);
router.get('/projects', notesController.listProjects);
router.get('/employees', notesController.listEmployees);
router.get('/projects/:projectId/employees', notesController.listProjectEmployees);
router.get('/:id/email/preview', notesController.previewEmail);
router.post('/:id/email/send', notesController.sendEmail);
router.get('/:id', notesController.getById);
router.post('/', notesController.create);
router.patch('/:id', notesController.update);
router.delete('/:id', adminOnly, notesController.remove);

router.put('/:id/child-blocks/reorder', notesController.reorderChildren);
router.post('/:id/child-blocks', notesController.createChild);
router.patch('/:id/child-blocks/:childId', notesController.updateChild);
router.delete('/:id/child-blocks/:childId', notesController.removeChild);

export { router as notesRoutes };
