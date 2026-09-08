import { Router } from 'express';
import { TopicsController } from '../controllers/topics.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/generate', requireAuth, TopicsController.generateTopics);
router.get('/', requireAuth, TopicsController.getTopics);

export default router;
