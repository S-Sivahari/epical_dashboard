import { Router } from 'express';
import * as compensationController from '../controllers/compensationController';

export const compensationRoutes = Router();

compensationRoutes.get('/', compensationController.list);
compensationRoutes.post('/', compensationController.create);
compensationRoutes.put('/:id', compensationController.update);
compensationRoutes.post('/:id/cancel', compensationController.cancel);
compensationRoutes.delete('/:id', compensationController.remove);
