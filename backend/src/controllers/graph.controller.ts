import type { Request, Response, NextFunction } from 'express';
import { GraphService } from '../services/graph.service';
import { logger } from '../utils/logger';

export class GraphController {
  /**
   * POST /api/v1/graph/sync/:paperId
   * Manually sync a paper and its entities to the Neo4j graph.
   */
  static async syncGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paperId = req.params['paperId'] as string;
      await GraphService.syncPaperToGraph(paperId);
      res.json({ success: true, message: `Paper ${paperId} synced to graph.` });
    } catch (err) {
      logger.error('[GraphController] syncGraph failed', err);
      next(err);
    }
  }

  /**
   * GET /api/v1/graph/visualize
   * Fetch graph nodes and links for UI visualization.
   */
  static async getGraphData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query['limit'] as string, 10) || 200;
      const data = await GraphService.getGraphVisualization(limit);
      res.json({ success: true, ...data });
    } catch (err) {
      logger.error('[GraphController] getGraphData failed', err);
      next(err);
    }
  }

  /**
   * GET /api/v1/graph/stats
   * Fetch graph statistics (node and relationship counts).
   */
  static async getGraphStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await GraphService.getGraphStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      logger.error('[GraphController] getGraphStats failed', err);
      next(err);
    }
  }
}
