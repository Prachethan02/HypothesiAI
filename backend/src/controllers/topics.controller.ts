import type { Request, Response, NextFunction } from 'express';
import { TopicsService } from '../services/topics.service';
import { logger } from '../utils/logger';

export class TopicsController {
  /**
   * POST /api/v1/topics/generate
   */
  static async generateTopics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await TopicsService.generateTopics();
      res.status(200).json({ success: true, data: run });
    } catch (err) {
      logger.error('[TopicsController] generateTopics failed', err);
      next(err);
    }
  }

  /**
   * GET /api/v1/topics
   */
  static async getTopics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TopicsService.getLatestTopics();
      res.status(200).json({ success: true, data: data || { run: null, topics: [] } });
    } catch (err) {
      logger.error('[TopicsController] getTopics failed', err);
      next(err);
    }
  }
}
