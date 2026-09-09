import { Router } from 'express';
import { gapRankingController } from '../controllers/gapRanking.controller';
import { requireAuth } from '../middleware/auth.middleware';

const gapRankingRouter = Router();

// NOTE: /weights must be registered BEFORE /:id to avoid routing conflict
gapRankingRouter.get('/weights', requireAuth, gapRankingController.getWeights);
gapRankingRouter.post('/rank', requireAuth, gapRankingController.rankGaps);
gapRankingRouter.get('/', requireAuth, gapRankingController.listGaps);
gapRankingRouter.get('/:id', requireAuth, gapRankingController.getGapById);

export default gapRankingRouter;
