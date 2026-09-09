import { Request, Response } from 'express';
import { SearchService } from '../services/search/search.service';
import type { SearchEntityType, SearchSortBy } from '../services/search/types';
import { logger } from '../utils/logger';

export const searchController = {
  /**
   * GET /api/v1/search
   * Execute global search across papers, methods, datasets, metrics, concepts,
   * topics, limitations, research gaps, and hypotheses.
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const entity_type = (typeof req.query.type === 'string' ? req.query.type : 'all') as SearchEntityType;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const sort_by = (typeof req.query.sort_by === 'string' ? req.query.sort_by : 'relevance') as SearchSortBy;

      const response = await SearchService.search({
        query,
        entity_type,
        page: isNaN(page) ? 1 : page,
        limit: isNaN(limit) ? 20 : limit,
        sort_by,
      });

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (err: any) {
      logger.error('searchController error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/v1/search/counts
   * Fast breakdown counts across all 9 research entity types.
   */
  async getCounts(req: Request, res: Response): Promise<void> {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const counts = await SearchService.getCounts(query);
      res.status(200).json({
        success: true,
        data: counts,
      });
    } catch (err: any) {
      logger.error('getCounts controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
