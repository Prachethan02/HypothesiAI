import { Router } from 'express';
import { GraphController } from '../controllers/graph.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Graph synchronization and queries (Stage 9)
router.post('/sync/:paperId', requireAuth, GraphController.syncGraph);
router.get('/visualize', requireAuth, GraphController.getGraphData);
router.get('/stats', requireAuth, GraphController.getGraphStats);

export default router;
