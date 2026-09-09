import { Router } from 'express';
import { EvidenceClustersController } from '../controllers/evidenceClusters.controller';
import { requireAuth } from '../middleware/auth.middleware';

const evidenceClustersRouter = Router();

// POST /api/v1/evidence-clusters/run
evidenceClustersRouter.post('/run', requireAuth, EvidenceClustersController.run);

// GET /api/v1/evidence-clusters
evidenceClustersRouter.get('/', requireAuth, EvidenceClustersController.list);

// GET /api/v1/evidence-clusters/:runId
evidenceClustersRouter.get('/:runId', requireAuth, EvidenceClustersController.getByRunId);

export default evidenceClustersRouter;
