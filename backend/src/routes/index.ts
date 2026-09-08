import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { papersRouter } from './papers.routes';
import resolutionRouter from './resolution.routes';
import graphRouter from './graph.routes';

export const apiV1Router = Router();

// Health routes
apiV1Router.use('/', healthRouter);

// Auth routes
apiV1Router.use('/auth', authRouter);

// Papers (Stages 5–8)
apiV1Router.use('/papers', papersRouter);

// Entity Resolution (Stage 8)
apiV1Router.use('/resolution', resolutionRouter);

// Knowledge Graph (Stage 9)
apiV1Router.use('/graph', graphRouter);


