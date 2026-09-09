import { Router } from 'express';
import { searchController } from '../controllers/search.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ArxivSearchProvider } from '../services/search/arxivSearchProvider';
import { CorpusService } from '../services/corpus.service';
import { logger } from '../utils/logger';

const searchRouter = Router();

searchRouter.get('/counts', requireAuth, searchController.getCounts);
searchRouter.get('/', requireAuth, searchController.search);

/**
 * GET /api/v1/search/academic?q=...&page=1&limit=10
 * Searches academic papers via arXiv. No API key required.
 */
searchRouter.get('/academic', requireAuth, async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.status(400).json({ success: false, error: { message: 'Query parameter q is required', statusCode: 400 } });
      return;
    }
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(25, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));

    const provider = new ArxivSearchProvider();
    const results = await provider.search({ query, page, limit });

    res.status(200).json({ success: true, data: results });
  } catch (err: any) {
    logger.error('Academic search error:', err);
    res.status(502).json({ success: false, error: { message: err.message || 'Academic search failed', statusCode: 502 } });
  }
});

export default searchRouter;
