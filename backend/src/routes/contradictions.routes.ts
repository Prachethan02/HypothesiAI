import { Router } from 'express';
import { ContradictionsController } from '../controllers/contradictions.controller';
import { requireAuth } from '../middleware/auth.middleware';

const contradictionsRouter = Router();

// POST /api/v1/contradictions/analyze
contradictionsRouter.post('/analyze', requireAuth, ContradictionsController.analyze);

// GET /api/v1/contradictions
contradictionsRouter.get('/', requireAuth, ContradictionsController.list);

// GET /api/v1/contradictions/:id
contradictionsRouter.get('/:id', requireAuth, ContradictionsController.getById);

// PATCH /api/v1/contradictions/:id/status
contradictionsRouter.patch('/:id/status', requireAuth, ContradictionsController.updateStatus);

export default contradictionsRouter;
