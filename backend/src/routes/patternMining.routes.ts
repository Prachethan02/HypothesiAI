import { Router } from 'express';
import { PatternMiningController } from '../controllers/patternMining.controller';
import { requireAuth } from '../middleware/auth.middleware';

const patternMiningRouter = Router();

// POST /api/v1/patterns/run
patternMiningRouter.post('/run', requireAuth, PatternMiningController.run);

// GET /api/v1/patterns
patternMiningRouter.get('/', requireAuth, PatternMiningController.listRuns);

// GET /api/v1/patterns/:runId
patternMiningRouter.get('/:runId', requireAuth, PatternMiningController.getRunDetails);

export default patternMiningRouter;
