import { Router } from 'express';
import { intelligenceController } from '../controllers/intelligence.controller';
import { requireAuth } from '../middleware/auth.middleware';

const intelligenceRouter = Router();

intelligenceRouter.get('/dashboard', requireAuth, intelligenceController.getDashboardData);
intelligenceRouter.get('/', requireAuth, intelligenceController.getDashboardData);

export default intelligenceRouter;
