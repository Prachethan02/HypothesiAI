import { Router } from 'express';
import { CorpusController } from '../controllers/corpus.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const corpusRouter = Router();

// Enforce authentication across all corpus routes
corpusRouter.use(requireAuth);

// Purge whole corpus (MUST be before /:id)
corpusRouter.post('/purge', CorpusController.purgeWholeCorpus);
corpusRouter.delete('/purge', CorpusController.purgeWholeCorpus);

// Core CRUD
corpusRouter.post('/', CorpusController.create);
corpusRouter.get('/', CorpusController.list);
corpusRouter.get('/:id', CorpusController.getById);
corpusRouter.delete('/:id', CorpusController.delete);

// Paper membership
corpusRouter.post('/:id/papers', CorpusController.addPaper);                  // Link existing paper to corpus
corpusRouter.delete('/:id/papers/:paperId', CorpusController.removePaper);    // Unlink paper from corpus

// Analysis orchestration
corpusRouter.post('/:id/analyze', CorpusController.startAnalysis);            // Start full pipeline
corpusRouter.get('/:id/analysis-status', CorpusController.getAnalysisStatus); // Poll progress
