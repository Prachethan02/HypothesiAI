import { Router } from 'express';
import { EvidenceController } from '../controllers/evidence.controller';
import { requireAuth } from '../middleware/auth.middleware';

const evidenceRouter = Router();

// POST /api/v1/evidence/aggregate
evidenceRouter.post('/aggregate', requireAuth, EvidenceController.aggregate);

// GET /api/v1/evidence
evidenceRouter.get('/', requireAuth, EvidenceController.list);

// GET /api/v1/evidence/weights
evidenceRouter.get('/weights', requireAuth, EvidenceController.getWeights);

// GET /api/v1/evidence/:id
evidenceRouter.get('/:id', requireAuth, EvidenceController.getById);

export default evidenceRouter;
