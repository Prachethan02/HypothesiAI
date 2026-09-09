import { Router } from 'express';
import { getHealth, getReadiness, getLiveness } from '../controllers/health.controller';

export const healthRouter = Router();

healthRouter.get('/health', getHealth);
healthRouter.get('/health/live', getLiveness);
healthRouter.get('/health/ready', getReadiness);
healthRouter.get('/health/readiness', getReadiness);
