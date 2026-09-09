import { Router } from 'express';
import { hypothesesController } from '../controllers/hypotheses.controller';
import { requireAuth } from '../middleware/auth.middleware';

const hypothesesRouter = Router();

hypothesesRouter.post('/generate', requireAuth, hypothesesController.generateHypothesis);
hypothesesRouter.post('/', requireAuth, hypothesesController.generateHypothesis);
hypothesesRouter.get('/', requireAuth, hypothesesController.listHypotheses);
hypothesesRouter.get('/gap/:gapId', requireAuth, hypothesesController.getHypothesisByGapId);
hypothesesRouter.get('/:id', requireAuth, hypothesesController.getHypothesisById);
hypothesesRouter.post('/:id/regenerate', requireAuth, hypothesesController.regenerateHypothesis);

export default hypothesesRouter;
