import { Request, Response } from 'express';
import { GapRankingService } from '../services/gapRanking.service';
import { logger } from '../utils/logger';

export const gapRankingController = {
  /**
   * POST /api/v1/research-gaps/rank
   * Trigger gap ranking engine.
   */
  async rankGaps(req: Request, res: Response): Promise<void> {
    try {
      const { weights, min_composite_score, min_evidence_count, top_k } = req.body;
      const corpusId = (req.body?.corpus_id || req.body?.corpusId) as string | undefined;
      const result = await GapRankingService.rankGaps({
        weights,
        min_composite_score: typeof min_composite_score === 'number' ? min_composite_score : 0.10,
        min_evidence_count: typeof min_evidence_count === 'number' ? min_evidence_count : 1,
        top_k: typeof top_k === 'number' ? top_k : undefined,
        corpusId,
      });
      res.status(200).json({
        success: true,
        data: {
          run_id: result.run.id,
          status: result.run.status,
          total_candidates: result.total_candidates,
          ranked_count: result.ranked_gaps.length,
          weights_used: result.weights_used,
          ranked_gaps: result.ranked_gaps,
        },
      });
    } catch (err: any) {
      logger.error('rankGaps controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/v1/research-gaps
   * List ranked research gaps.
   */
  async listGaps(req: Request, res: Response): Promise<void> {
    try {
      const min_score = req.query.min_score ? parseFloat(req.query.min_score as string) : undefined;
      const top_k = req.query.top_k ? parseInt(req.query.top_k as string, 10) : undefined;
      const evidence_type = req.query.evidence_type as string | undefined;
      const corpusId = (req.query.corpus_id || req.query.corpusId) as string | undefined;

      const gaps = await GapRankingService.listGaps({ min_score, top_k, evidence_type, corpusId });
      res.status(200).json({
        success: true,
        total: gaps.length,
        data: gaps,
      });
    } catch (err: any) {
      logger.error('listGaps controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/v1/research-gaps/weights
   * Return default ranking weight configuration.
   */
  async getWeights(req: Request, res: Response): Promise<void> {
    try {
      const weights = await GapRankingService.getDefaultWeights();
      res.status(200).json({ success: true, data: weights });
    } catch (err: any) {
      logger.error('getWeights controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/v1/research-gaps/:id
   * Return full detail for a single ranked gap.
   */
  async getGapById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const gap = await GapRankingService.getGapById(id);
      if (!gap) {
        res.status(404).json({ success: false, error: `Gap '${id}' not found.` });
        return;
      }
      res.status(200).json({ success: true, data: gap });
    } catch (err: any) {
      logger.error('getGapById controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
