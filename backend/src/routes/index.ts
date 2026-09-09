import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { papersRouter } from './papers.routes';
import resolutionRouter from './resolution.routes';
import graphRouter from './graph.routes';
import topicsRouter from './topics.routes';
import evidenceClustersRouter from './evidenceClusters.routes';
import patternMiningRouter from './patternMining.routes';
import contradictionsRouter from './contradictions.routes';
import evidenceRouter from './evidence.routes';
import gapRankingRouter from './gapRanking.routes';
import hypothesesRouter from './hypotheses.routes';
import searchRouter from './search.routes';
import intelligenceRouter from './intelligence.routes';
import { corpusRouter } from './corpus.routes';

export const apiV1Router = Router();

// Health routes
apiV1Router.use('/', healthRouter);

// Auth routes
apiV1Router.use('/auth', authRouter);

// Research Corpora (Phase A)
apiV1Router.use('/corpora', corpusRouter);

// Papers (Stages 5–8)
apiV1Router.use('/papers', papersRouter);

// Entity Resolution (Stage 8)
apiV1Router.use('/resolution', resolutionRouter);

// Knowledge Graph (Stage 9)
apiV1Router.use('/graph', graphRouter);

// Topic Modeling (Stage 10)
apiV1Router.use('/topics', topicsRouter);

// Evidence Clustering (Stage 11)
apiV1Router.use('/evidence-clusters', evidenceClustersRouter);

// Research Pattern Mining (Stage 12)
apiV1Router.use('/patterns', patternMiningRouter);

// Contradiction Analysis (Stage 13)
apiV1Router.use('/contradictions', contradictionsRouter);

// Unified Evidence Aggregation (Stage 14)
apiV1Router.use('/evidence', evidenceRouter);

// Research-Gap Ranking (Stage 15)
apiV1Router.use('/research-gaps', gapRankingRouter);

// Evidence-Grounded Hypotheses (Stage 16)
apiV1Router.use('/hypotheses', hypothesesRouter);

// Global Research Search (Stage 17)
apiV1Router.use('/search', searchRouter);

// Final Research Intelligence Dashboard (Stage 18)
apiV1Router.use('/intelligence', intelligenceRouter);




