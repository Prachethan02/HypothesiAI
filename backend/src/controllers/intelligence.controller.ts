import { Request, Response } from 'express';
import { IntelligenceService } from '../services/intelligence.service';
import { logger } from '../utils/logger';

export const intelligenceController = {
  /**
   * GET /api/v1/intelligence/dashboard
   * Returns unified intelligence statistics, 7 evidence charts, and graph payload.
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const data = await IntelligenceService.getDashboardData();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      logger.error('intelligenceController.getDashboardData error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
