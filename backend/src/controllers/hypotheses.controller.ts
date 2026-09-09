import { Request, Response } from 'express';
import { HypothesesService } from '../services/hypotheses.service';
import { logger } from '../utils/logger';

export const hypothesesController = {
  /**
   * POST /api/v1/hypotheses/generate
   * Formulate an evidence-grounded hypothesis for a ranked research gap.
   */
  async generateHypothesis(req: Request, res: Response): Promise<void> {
    try {
      const { gap_id, force_regenerate, temperature, provider, model, api_key } = req.body;
      if (!gap_id) {
        res.status(400).json({ success: false, error: 'gap_id is required.' });
        return;
      }

      const result = await HypothesesService.generateHypothesis({
        gap_id,
        force_regenerate: Boolean(force_regenerate),
        temperature: typeof temperature === 'number' ? temperature : 0.2,
        provider,
        model,
        api_key,
      });

      res.status(200).json({
        success: true,
        data: result.hypothesis,
        evidence_used: result.evidence_used,
        message: result.message,
      });
    } catch (err: any) {
      logger.error('generateHypothesis controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/v1/hypotheses
   * List all generated hypotheses.
   */
  async listHypotheses(req: Request, res: Response): Promise<void> {
    try {
      const gap_id = req.query.gap_id as string | undefined;
      const list = await HypothesesService.listHypotheses(gap_id);
      res.status(200).json({
        success: true,
        total: list.length,
        data: list,
      });
    } catch (err: any) {
      logger.error('listHypotheses controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/v1/hypotheses/:id
   * Get hypothesis by ID with evidence bundle.
   */
  async getHypothesisById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const hypothesis = await HypothesesService.getHypothesisById(id);
      if (!hypothesis) {
        res.status(404).json({ success: false, error: `Hypothesis '${id}' not found.` });
        return;
      }
      res.status(200).json({
        success: true,
        data: hypothesis,
        evidence_used: hypothesis.evidence_bundle,
      });
    } catch (err: any) {
      logger.error('getHypothesisById controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/v1/hypotheses/gap/:gapId
   * Get hypothesis by gap ID.
   */
  async getHypothesisByGapId(req: Request, res: Response): Promise<void> {
    try {
      const gapId = req.params.gapId as string;
      const hypothesis = await HypothesesService.getHypothesisByGapId(gapId);
      if (!hypothesis) {
        res.status(404).json({ success: false, error: `No hypothesis found for gap '${gapId}'.` });
        return;
      }
      res.status(200).json({
        success: true,
        data: hypothesis,
        evidence_used: hypothesis.evidence_bundle,
      });
    } catch (err: any) {
      logger.error('getHypothesisByGapId controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/v1/hypotheses/:id/regenerate
   * Regenerate hypothesis for the gap associated with this hypothesis.
   */
  async regenerateHypothesis(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const existing = await HypothesesService.getHypothesisById(id);
      if (!existing) {
        res.status(404).json({ success: false, error: `Hypothesis '${id}' not found.` });
        return;
      }

      const result = await HypothesesService.generateHypothesis({
        gap_id: existing.gap_id,
        force_regenerate: true,
        temperature: req.body.temperature,
      });

      res.status(200).json({
        success: true,
        data: result.hypothesis,
        evidence_used: result.evidence_used,
        message: 'Hypothesis successfully regenerated.',
      });
    } catch (err: any) {
      logger.error('regenerateHypothesis controller error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
