import { Router } from 'express';
import { ResolutionController } from '../controllers/resolution.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Standalone entity resolution (no paper context)
router.post('/resolve', requireAuth, ResolutionController.resolveEntities);
router.post('/compare', requireAuth, ResolutionController.comparePair);

export default router;
